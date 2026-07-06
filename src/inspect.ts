import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

/**
 * Reads an existing .pptx and extracts its content — text, tables, chart data,
 * and image references — as plain JSON an agent can read. This is deliberately
 * NOT a re-editable Deck reconstruction (see docs/IR.md); it answers "what does
 * this deck say", not "let me edit it as HTML". Positions/styling are dropped.
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

/** First value from a strCache — for single-value refs like a series name. */
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

export type InspectedSlide = {
	texts: string[];
	tables: string[][][];
	charts: InspectedChart[];
	images: string[];
};

export async function inspect(
	pptxBytes: Uint8Array,
): Promise<InspectedSlide[]> {
	const zip = await JSZip.loadAsync(pptxBytes);
	const pres = await readXml(zip, "ppt/presentation.xml");
	const presRels = await readRels(zip, "ppt/_rels/presentation.xml.rels");
	const slideIds = arr(pres?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"]);
	const slidePaths = slideIds
		.map((s: Xml) => presRels[s["@_r:id"]])
		.filter((p): p is string => !!p)
		.map((p) => `ppt/${p}`);

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

		for (const sp of arr(spTree?.["p:sp"])) {
			const t = shapeText(sp);
			if (t) texts.push(t);
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

		slides.push({ texts, tables, charts, images });
	}
	return slides;
}
