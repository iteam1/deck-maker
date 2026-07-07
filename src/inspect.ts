import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

/**
 * Reads an existing .pptx and extracts its content, visual style, AND layout — text,
 * tables, chart data, image references, colors, fonts, and per-element geometry — as
 * plain JSON an agent can read. Handles real-PowerPoint files (grouped shapes with
 * child-coordinate transforms, p:bg slide backgrounds, gradient fills, theme color and
 * font references), not just decks this engine emitted. This is deliberately NOT a
 * re-editable Deck reconstruction (see docs/IR.md); it answers "what does this deck
 * say and look like — and how is it laid out", not "let me edit it as HTML".
 */

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	isArray: (name) =>
		[
			"p:sldId",
			"Relationship",
			"p:sp",
			"p:pic",
			"p:grpSp",
			"p:graphicFrame",
			"a:p",
			"a:r",
			"a:tr",
			"a:tc",
			"a:gs",
			"c:ser",
			"c:pt",
		].includes(name),
});

// biome-ignore lint/suspicious/noExplicitAny: parsed XML has no fixed shape
type Xml = any;

function arr<T>(v: T | T[] | undefined | null): T[] {
	if (v === undefined || v === null) return [];
	return Array.isArray(v) ? v : [v];
}

async function readXml(zip: JSZip, path: string): Promise<Xml | null> {
	const f = zip.file(path);
	if (!f) return null;
	return parser.parse(await f.async("string"));
}

async function readRels(
	zip: JSZip,
	path: string,
): Promise<Record<string, string>> {
	const doc = await readXml(zip, path);
	const out: Record<string, string> = {};
	for (const r of arr(doc?.Relationships?.Relationship))
		out[r["@_Id"]] = r["@_Target"];
	return out;
}

const emuToPx = (v: number) => Math.round(v / 9525);
/** OOXML `sz` is hundredths of a point; our own contract's sizes are px (see emit.ts's px*0.75). */
const ptCentiToPx = (sz: string | number | undefined): number | undefined =>
	sz === undefined
		? undefined
		: Math.round((Number(sz) / 100 / 0.75) * 100) / 100;

// ---------- theme (colors + fonts) ----------

/** PowerPoint aliases these scheme names to the theme's actual color slots. */
const SCHEME_ALIASES: Record<string, string> = {
	bg1: "lt1",
	tx1: "dk1",
	bg2: "lt2",
	tx2: "dk2",
};

type Theme = {
	colors: Record<string, string>;
	fonts: { major?: string; minor?: string };
};

async function readTheme(zip: JSZip): Promise<Theme> {
	let doc = await readXml(zip, "ppt/theme/theme1.xml");
	if (!doc) {
		const path = Object.keys(zip.files).find((p) =>
			/^ppt\/theme\/theme\d+\.xml$/.test(p),
		);
		if (path) doc = await readXml(zip, path);
	}
	const els = doc?.["a:theme"]?.["a:themeElements"];
	const colors: Record<string, string> = {};
	const clrScheme = els?.["a:clrScheme"];
	if (clrScheme) {
		for (const key of [
			"dk1",
			"lt1",
			"dk2",
			"lt2",
			"accent1",
			"accent2",
			"accent3",
			"accent4",
			"accent5",
			"accent6",
			"hlink",
			"folHlink",
		]) {
			const node = clrScheme[`a:${key}`];
			const hex: string | undefined =
				node?.["a:srgbClr"]?.["@_val"] ?? node?.["a:sysClr"]?.["@_lastClr"];
			if (hex) colors[key] = `#${hex.toLowerCase()}`;
		}
	}
	const fontScheme = els?.["a:fontScheme"];
	const fonts = {
		major: fontScheme?.["a:majorFont"]?.["a:latin"]?.["@_typeface"] as
			| string
			| undefined,
		minor: fontScheme?.["a:minorFont"]?.["a:latin"]?.["@_typeface"] as
			| string
			| undefined,
	};
	return { colors, fonts };
}

/** Read the color of a node that contains a:srgbClr or a:schemeClr (a fill, a gradient stop, a bgRef). */
function clr(node: Xml, theme: Theme): string | undefined {
	const srgb = node?.["a:srgbClr"]?.["@_val"];
	if (srgb) return `#${String(srgb).toLowerCase()}`;
	const scheme = node?.["a:schemeClr"]?.["@_val"];
	if (scheme) return theme.colors[SCHEME_ALIASES[scheme] ?? scheme];
	return undefined;
}

/**
 * All colors of a container's fill: one for solidFill, every stop for gradFill.
 * Real templates lean on gradients (e.g. a slide bg blending accent1→accent2).
 */
function fillColors(container: Xml, theme: Theme): string[] {
	const solid = container?.["a:solidFill"];
	if (solid) {
		const c = clr(solid, theme);
		return c ? [c] : [];
	}
	const grad = container?.["a:gradFill"];
	if (grad) {
		return arr(grad["a:gsLst"]?.["a:gs"])
			.map((g: Xml) => clr(g, theme))
			.filter((c): c is string => !!c);
	}
	return [];
}

/** First fill color — the representative one. */
function resolveFill(container: Xml, theme: Theme): string | undefined {
	return fillColors(container, theme)[0];
}

/** Resolve a run's typeface, mapping theme references (+mj-lt / +mn-lt) to real faces. */
function resolveFont(
	typeface: string | undefined,
	theme: Theme,
): string | undefined {
	if (!typeface) return undefined;
	if (typeface === "+mj-lt") return theme.fonts.major;
	if (typeface === "+mn-lt") return theme.fonts.minor;
	return typeface;
}

// ---------- geometry (groups carry their own child coordinate space) ----------

/** EMU-space affine: maps a child x to parent space as ox + x*sx. */
type Affine = { ox: number; oy: number; sx: number; sy: number };
const IDENTITY: Affine = { ox: 0, oy: 0, sx: 1, sy: 1 };

type Box = { x: number; y: number; w: number; h: number };

function readBoxEmu(
	xfrm: Xml,
): { x: number; y: number; cx: number; cy: number } | null {
	const off = xfrm?.["a:off"];
	const ext = xfrm?.["a:ext"];
	if (!off || !ext) return null;
	return {
		x: Number(off["@_x"] ?? 0),
		y: Number(off["@_y"] ?? 0),
		cx: Number(ext["@_cx"] ?? 0),
		cy: Number(ext["@_cy"] ?? 0),
	};
}

function mapBox(t: Affine, xfrm: Xml): Box | null {
	const b = readBoxEmu(xfrm);
	if (!b) return null;
	return {
		x: emuToPx(t.ox + b.x * t.sx),
		y: emuToPx(t.oy + b.y * t.sy),
		w: emuToPx(b.cx * t.sx),
		h: emuToPx(b.cy * t.sy),
	};
}

/**
 * Compose a group's transform onto the incoming one. A grpSp positions its children in
 * its own space (chOff/chExt) and maps that space into its parent box (off/ext):
 * parentX = off.x + (childX − chOff.x) · ext.cx/chExt.cx.
 */
function composeGroup(t: Affine, grpXfrm: Xml): Affine {
	const b = readBoxEmu(grpXfrm);
	if (!b) return t;
	const chOff = grpXfrm?.["a:chOff"];
	const chExt = grpXfrm?.["a:chExt"];
	const cx0 = Number(chOff?.["@_x"] ?? b.x);
	const cy0 = Number(chOff?.["@_y"] ?? b.y);
	const cw = Number(chExt?.["@_cx"] ?? b.cx) || b.cx || 1;
	const ch = Number(chExt?.["@_cy"] ?? b.cy) || b.cy || 1;
	const kx = b.cx / cw;
	const ky = b.cy / ch;
	return {
		ox: t.ox + (b.x - cx0 * kx) * t.sx,
		oy: t.oy + (b.y - cy0 * ky) * t.sy,
		sx: t.sx * kx,
		sy: t.sy * ky,
	};
}

// ---------- content extraction ----------

function paragraphText(p: Xml): string {
	return arr(p?.["a:r"])
		.map((r: Xml) => {
			const t = r?.["a:t"];
			return typeof t === "string" ? t : (t?.["#text"] ?? "");
		})
		.join("");
}

function shapeText(sp: Xml): string | null {
	const paras = arr(sp?.["p:txBody"]?.["a:p"]);
	if (!paras.length) return null;
	const text = paras.map(paragraphText).join("\n").trim();
	return text || null;
}

function tableRows(tbl: Xml): string[][] {
	return arr(tbl?.["a:tr"]).map((tr: Xml) =>
		arr(tr?.["a:tc"]).map((tc: Xml) =>
			arr(tc?.["a:txBody"]?.["a:p"]).map(paragraphText).join(" ").trim(),
		),
	);
}

const CHART_TAGS: Record<string, string> = {
	"c:barChart": "bar",
	"c:lineChart": "line",
	"c:pieChart": "pie",
	"c:doughnutChart": "doughnut",
	"c:areaChart": "area",
	"c:scatterChart": "scatter",
	"c:radarChart": "radar",
};

function numCache(numRef: Xml): number[] {
	return arr(numRef?.["c:numCache"]?.["c:pt"]).map((p: Xml) =>
		Number(p?.["c:v"] ?? 0),
	);
}
function strCache(strRef: Xml): string[] {
	return arr(strRef?.["c:strCache"]?.["c:pt"]).map((p: Xml) =>
		String(p?.["c:v"] ?? ""),
	);
}
function strCacheFirst(strRef: Xml): string {
	return strCache(strRef)[0] ?? "";
}

/**
 * Category values: PptxGenJS (and others) may emit c:strRef, c:numRef, or
 * c:multiLvlStrRef (a multi-level ref even for flat, single-level categories).
 */
function catValues(cat: Xml): string[] {
	if (cat?.["c:strRef"]) return strCache(cat["c:strRef"]);
	if (cat?.["c:numRef"]) return numCache(cat["c:numRef"]).map(String);
	const multi = cat?.["c:multiLvlStrRef"];
	if (multi) {
		const lvl = arr(multi["c:multiLvlStrCache"]?.["c:lvl"])[0];
		return arr(lvl?.["c:pt"]).map((p: Xml) => String(p?.["c:v"] ?? ""));
	}
	return [];
}

export type InspectedChart = {
	type: string;
	categories: string[];
	series: { name: string; values: number[] }[];
};

async function readChart(
	zip: JSZip,
	chartPath: string,
): Promise<InspectedChart | null> {
	const doc = await readXml(zip, chartPath);
	const plotArea = doc?.["c:chartSpace"]?.["c:chart"]?.["c:plotArea"];
	if (!plotArea) return null;
	for (const [tag, type] of Object.entries(CHART_TAGS)) {
		const node = plotArea[tag];
		if (!node) continue;
		const seriesNodes = arr(node["c:ser"]);
		const categories = seriesNodes[0] ? catValues(seriesNodes[0]["c:cat"]) : [];
		const series = seriesNodes.map((s: Xml) => ({
			name: strCacheFirst(s?.["c:tx"]?.["c:strRef"]),
			values: numCache(s?.["c:val"]?.["c:numRef"]),
		}));
		return { type, categories, series };
	}
	return null;
}

// ---------- output types ----------

export type InspectedElement = {
	kind: "text" | "shape" | "image" | "table" | "chart";
	/** Box in px on this deck's own canvas (see InspectedDeck.canvas). */
	x: number;
	y: number;
	w: number;
	h: number;
	/** Text preview (first ~80 chars) for text elements. */
	text?: string;
	/** Largest run size in the element, px. */
	fontSizePx?: number;
	/** Shape fill, or first text color. */
	color?: string;
	rounded?: boolean;
};

export type SlideStyle = {
	/** The slide surface color: its p:bg fill, or a shape covering ~the whole slide. */
	background?: string;
	/** Distinct colors seen on this slide (bg + shape fills + text), first-appearance order. */
	colors: string[];
	/** Distinct font faces seen on this slide (theme refs resolved). */
	fonts: string[];
	/** Distinct text sizes seen, in px (our own contract's unit), sorted descending. */
	fontSizesPx: number[];
	/** Any shape uses a rounded-rect preset geometry. */
	roundedShapes: boolean;
};

export type DeckStyle = {
	/** Colors ranked by how many slides they appear on (most common first). */
	palette: string[];
	/** Font faces ranked by frequency across the deck. */
	fonts: string[];
	/** The theme's declared font pair (major = headings, minor = body), if any. */
	themeFonts: { major?: string; minor?: string };
	/** All distinct text sizes across the deck, in px, sorted descending. */
	fontSizesPx: number[];
	/** True if any slide uses a rounded-rect shape. */
	roundedShapes: boolean;
	/** Distinct per-slide surface/background colors, first-appearance order. */
	backgrounds: string[];
};

export type InspectedSlide = {
	texts: string[];
	tables: string[][][];
	charts: InspectedChart[];
	images: string[];
	/** Every visible element with its geometry, in z-order — the slide's layout. */
	elements: InspectedElement[];
	style: SlideStyle;
};

export type InspectedDeck = {
	/** Slide size in px (16:9 decks are 1280×720; 4:3 are 960×720). */
	canvas: { w: number; h: number };
	slides: InspectedSlide[];
	style: DeckStyle;
};

// ---------- the walk ----------

/** Flat pick of sp/pic/graphicFrame from a shape tree, descending into groups. */
type Collected = {
	sps: { node: Xml; box: Box | null }[];
	pics: { node: Xml; box: Box | null }[];
	frames: { node: Xml; box: Box | null }[];
};

function walkTree(tree: Xml, t: Affine, out: Collected): void {
	for (const sp of arr(tree?.["p:sp"]))
		out.sps.push({ node: sp, box: mapBox(t, sp?.["p:spPr"]?.["a:xfrm"]) });
	for (const pic of arr(tree?.["p:pic"]))
		out.pics.push({ node: pic, box: mapBox(t, pic?.["p:spPr"]?.["a:xfrm"]) });
	for (const gf of arr(tree?.["p:graphicFrame"]))
		out.frames.push({ node: gf, box: mapBox(t, gf?.["p:xfrm"]) });
	for (const grp of arr(tree?.["p:grpSp"]))
		walkTree(grp, composeGroup(t, grp?.["p:grpSpPr"]?.["a:xfrm"]), out);
}

export async function inspect(pptxBytes: Uint8Array): Promise<InspectedDeck> {
	const zip = await JSZip.loadAsync(pptxBytes);
	const theme = await readTheme(zip);

	const pres = await readXml(zip, "ppt/presentation.xml");
	const presRels = await readRels(zip, "ppt/_rels/presentation.xml.rels");
	const slideIds = arr(pres?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"]);
	const slidePaths = slideIds
		.map((s: Xml) => presRels[s["@_r:id"]])
		.filter((p): p is string => !!p)
		.map((p) => `ppt/${p.replace(/^\//, "").replace(/^ppt\//, "")}`);
	const sldSz = pres?.["p:presentation"]?.["p:sldSz"];
	const slideW = emuToPx(Number(sldSz?.["@_cx"] ?? 12192000));
	const slideH = emuToPx(Number(sldSz?.["@_cy"] ?? 6858000));

	const slides: InspectedSlide[] = [];
	for (const slidePath of slidePaths) {
		const doc = await readXml(zip, slidePath);
		const relsPath = slidePath.replace(/^(.*\/)([^/]+)$/, "$1_rels/$2.rels");
		const slideRels = await readRels(zip, relsPath);
		const cSld = doc?.["p:sld"]?.["p:cSld"];
		const spTree = cSld?.["p:spTree"];

		const texts: string[] = [];
		const tables: string[][][] = [];
		const charts: InspectedChart[] = [];
		const images: string[] = [];
		const elements: InspectedElement[] = [];
		const colors: string[] = [];
		const fonts: string[] = [];
		const fontSizesPx: number[] = [];
		let background: string | undefined;
		let roundedShapes = false;

		const noteColor = (c: string | undefined) => {
			if (c && !colors.includes(c)) colors.push(c);
		};
		const noteFont = (f: string | undefined) => {
			if (f && !fonts.includes(f)) fonts.push(f);
		};
		const noteSize = (s: number | undefined) => {
			if (s !== undefined && !fontSizesPx.includes(s)) fontSizesPx.push(s);
		};

		// Slide background: the p:bg element (solid, gradient, or a bgRef style link).
		const bg = cSld?.["p:bg"];
		if (bg) {
			const bgColors = bg["p:bgPr"]
				? fillColors(bg["p:bgPr"], theme)
				: [clr(bg["p:bgRef"], theme)].filter((c): c is string => !!c);
			if (bgColors[0]) background = bgColors[0];
			for (const c of bgColors) noteColor(c);
		}

		const found: Collected = { sps: [], pics: [], frames: [] };
		walkTree(spTree, IDENTITY, found);

		for (const { node: sp, box } of found.sps) {
			const t = shapeText(sp);
			if (t) texts.push(t);

			const spPr = sp?.["p:spPr"];
			const fillAll = fillColors(spPr, theme);
			const fill = fillAll[0];
			for (const c of fillAll) noteColor(c);
			const rounded = spPr?.["a:prstGeom"]?.["@_prst"] === "roundRect";
			if (rounded) roundedShapes = true;

			if (fill && box && box.w >= slideW * 0.9 && box.h >= slideH * 0.9) {
				background = fill; // a full-bleed shape paints over the p:bg
			}

			let maxSize: number | undefined;
			let firstTextColor: string | undefined;
			for (const p of arr(sp?.["p:txBody"]?.["a:p"])) {
				for (const r of arr(p?.["a:r"])) {
					const rPr = r?.["a:rPr"];
					const c = resolveFill(rPr, theme);
					noteColor(c);
					if (!firstTextColor && c) firstTextColor = c;
					noteFont(resolveFont(rPr?.["a:latin"]?.["@_typeface"], theme));
					const s = ptCentiToPx(rPr?.["@_sz"]);
					noteSize(s);
					if (s !== undefined && (maxSize === undefined || s > maxSize))
						maxSize = s;
				}
			}

			if (box) {
				const color = t ? firstTextColor : fill;
				elements.push({
					kind: t ? "text" : "shape",
					...box,
					...(t ? { text: t.slice(0, 80) } : {}),
					...(maxSize !== undefined ? { fontSizePx: maxSize } : {}),
					...(color ? { color } : {}),
					...(rounded ? { rounded: true } : {}),
				});
			}
		}

		for (const { node: pic, box } of found.pics) {
			const embed = pic?.["p:blipFill"]?.["a:blip"]?.["@_r:embed"];
			const target = embed ? slideRels[embed] : undefined;
			if (target) images.push(target.replace(/^\.\.\//, "ppt/"));
			if (box) elements.push({ kind: "image", ...box });
		}

		for (const { node: gf, box } of found.frames) {
			const graphicData = gf?.["a:graphic"]?.["a:graphicData"];
			const uri: string = graphicData?.["@_uri"] ?? "";
			if (uri.includes("/table")) {
				tables.push(tableRows(graphicData["a:tbl"]));
				if (box) elements.push({ kind: "table", ...box });
			} else if (uri.includes("/chart")) {
				const rId = graphicData?.["c:chart"]?.["@_r:id"];
				const target = rId ? slideRels[rId] : undefined;
				if (target) {
					const chartPath = `ppt/charts/${target.split("/").pop()}`;
					const chart = await readChart(zip, chartPath);
					if (chart) charts.push(chart);
				}
				if (box) elements.push({ kind: "chart", ...box });
			}
		}

		fontSizesPx.sort((a, b) => b - a);
		slides.push({
			texts,
			tables,
			charts,
			images,
			elements,
			style: { background, colors, fonts, fontSizesPx, roundedShapes },
		});
	}

	// Deck-level rollup.
	const colorCounts = new Map<string, number>();
	const fontCounts = new Map<string, number>();
	const allSizes = new Set<number>();
	const backgrounds: string[] = [];
	let roundedShapes = false;
	for (const s of slides) {
		for (const c of s.style.colors)
			colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
		for (const f of s.style.fonts)
			fontCounts.set(f, (fontCounts.get(f) ?? 0) + 1);
		for (const sz of s.style.fontSizesPx) allSizes.add(sz);
		if (s.style.background && !backgrounds.includes(s.style.background))
			backgrounds.push(s.style.background);
		if (s.style.roundedShapes) roundedShapes = true;
	}
	const byCountDesc = (a: [string, number], b: [string, number]) => b[1] - a[1];
	const palette = [...colorCounts.entries()].sort(byCountDesc).map(([c]) => c);
	const fonts = [...fontCounts.entries()].sort(byCountDesc).map(([f]) => f);
	const fontSizesPx = [...allSizes].sort((a, b) => b - a);

	return {
		canvas: { w: slideW, h: slideH },
		slides,
		style: {
			palette,
			fonts,
			themeFonts: theme.fonts,
			fontSizesPx,
			roundedShapes,
			backgrounds,
		},
	};
}
