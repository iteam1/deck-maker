import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

/**
 * Reads an existing .pptx and extracts its content AND its visual style — text,
 * tables, chart data, image references, colors, fonts, and corner-radius usage
 * — as plain JSON an agent can read. This is deliberately NOT a re-editable Deck
 * reconstruction (see docs/IR.md); it answers "what does this deck say and look
 * like", not "let me edit it as HTML". Exact positions are used internally (to
 * detect full-slide background shapes) but not exposed per element.
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
			"p:graphicFrame",
			"a:p",
			"a:r",
			"a:tr",
			"a:tc",
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

// ---------- theme colors ----------

/** PowerPoint aliases these scheme names to the theme's actual color slots. */
const SCHEME_ALIASES: Record<string, string> = {
	bg1: "lt1",
	tx1: "dk1",
	bg2: "lt2",
	tx2: "dk2",
};

async function readThemeColors(zip: JSZip): Promise<Record<string, string>> {
	let doc = await readXml(zip, "ppt/theme/theme1.xml");
	if (!doc) {
		const path = Object.keys(zip.files).find((p) =>
			/^ppt\/theme\/theme\d+\.xml$/.test(p),
		);
		if (path) doc = await readXml(zip, path);
	}
	const clrScheme = doc?.["a:theme"]?.["a:themeElements"]?.["a:clrScheme"];
	const map: Record<string, string> = {};
	if (!clrScheme) return map;
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
		if (hex) map[key] = `#${hex.toLowerCase()}`;
	}
	return map;
}

/** Resolve a solidFill's color (literal RGB or a theme scheme reference) to hex. */
function resolveFill(
	container: Xml,
	theme: Record<string, string>,
): string | undefined {
	const solid = container?.["a:solidFill"];
	if (!solid) return undefined;
	const srgb = solid["a:srgbClr"]?.["@_val"];
	if (srgb) return `#${String(srgb).toLowerCase()}`;
	const schemeName = solid["a:schemeClr"]?.["@_val"];
	if (schemeName) return theme[SCHEME_ALIASES[schemeName] ?? schemeName];
	return undefined;
}

function readBox(
	spPr: Xml,
): { x: number; y: number; w: number; h: number } | null {
	const off = spPr?.["a:xfrm"]?.["a:off"];
	const ext = spPr?.["a:xfrm"]?.["a:ext"];
	if (!off || !ext) return null;
	return {
		x: emuToPx(Number(off["@_x"] ?? 0)),
		y: emuToPx(Number(off["@_y"] ?? 0)),
		w: emuToPx(Number(ext["@_cx"] ?? 0)),
		h: emuToPx(Number(ext["@_cy"] ?? 0)),
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

// ---------- style extraction ----------

export type SlideStyle = {
	/** Fill of the shape that covers ~the whole slide, if any — the surface color. */
	background?: string;
	/** Distinct colors seen on this slide (shape fills + text), first-appearance order. */
	colors: string[];
	/** Distinct font faces seen on this slide. */
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
	style: SlideStyle;
};

export type InspectedDeck = {
	slides: InspectedSlide[];
	style: DeckStyle;
};

export async function inspect(pptxBytes: Uint8Array): Promise<InspectedDeck> {
	const zip = await JSZip.loadAsync(pptxBytes);
	const theme = await readThemeColors(zip);

	const pres = await readXml(zip, "ppt/presentation.xml");
	const presRels = await readRels(zip, "ppt/_rels/presentation.xml.rels");
	const slideIds = arr(pres?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"]);
	const slidePaths = slideIds
		.map((s: Xml) => presRels[s["@_r:id"]])
		.filter((p): p is string => !!p)
		.map((p) => `ppt/${p}`);
	const sldSz = pres?.["p:presentation"]?.["p:sldSz"];
	const slideW = emuToPx(Number(sldSz?.["@_cx"] ?? 12192000));
	const slideH = emuToPx(Number(sldSz?.["@_cy"] ?? 6858000));

	const slides: InspectedSlide[] = [];
	for (const slidePath of slidePaths) {
		const doc = await readXml(zip, slidePath);
		const relsPath = slidePath.replace(/^(.*\/)([^/]+)$/, "$1_rels/$2.rels");
		const slideRels = await readRels(zip, relsPath);
		const spTree = doc?.["p:sld"]?.["p:cSld"]?.["p:spTree"];

		const texts: string[] = [];
		const tables: string[][][] = [];
		const charts: InspectedChart[] = [];
		const images: string[] = [];
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

		for (const sp of arr(spTree?.["p:sp"])) {
			const t = shapeText(sp);
			if (t) texts.push(t);

			const spPr = sp?.["p:spPr"];
			const fill = resolveFill(spPr, theme);
			noteColor(fill);
			if (spPr?.["a:prstGeom"]?.["@_prst"] === "roundRect")
				roundedShapes = true;

			const box = readBox(spPr);
			if (fill && box && box.w >= slideW * 0.9 && box.h >= slideH * 0.9) {
				background = fill;
			}

			for (const p of arr(sp?.["p:txBody"]?.["a:p"])) {
				for (const r of arr(p?.["a:r"])) {
					const rPr = r?.["a:rPr"];
					noteColor(resolveFill(rPr, theme));
					noteFont(rPr?.["a:latin"]?.["@_typeface"]);
					noteSize(ptCentiToPx(rPr?.["@_sz"]));
				}
			}
		}
		for (const pic of arr(spTree?.["p:pic"])) {
			const embed = pic?.["p:blipFill"]?.["a:blip"]?.["@_r:embed"];
			const target = embed ? slideRels[embed] : undefined;
			if (target) images.push(target.replace(/^\.\.\//, "ppt/"));
		}
		for (const gf of arr(spTree?.["p:graphicFrame"])) {
			const graphicData = gf?.["a:graphic"]?.["a:graphicData"];
			const uri: string = graphicData?.["@_uri"] ?? "";
			if (uri.includes("/table")) {
				tables.push(tableRows(graphicData["a:tbl"]));
			} else if (uri.includes("/chart")) {
				const rId = graphicData?.["c:chart"]?.["@_r:id"];
				const target = rId ? slideRels[rId] : undefined;
				if (target) {
					const chartPath = `ppt/charts/${target.split("/").pop()}`;
					const chart = await readChart(zip, chartPath);
					if (chart) charts.push(chart);
				}
			}
		}

		fontSizesPx.sort((a, b) => b - a);
		slides.push({
			texts,
			tables,
			charts,
			images,
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
		slides,
		style: { palette, fonts, fontSizesPx, roundedShapes, backgrounds },
	};
}
