import { Resvg } from "@resvg/resvg-js";
import JSZip from "jszip";
import pptxgen from "pptxgenjs";
import type { Deck, TextRun } from "./types";

/** px → inches for PptxGenJS (our canvas is 96dpi). */
const inch = (px: number) => px / 96;

/**
 * Re-serialize PptxGenJS's package into a strict OPC zip: DEFLATE-compressed,
 * `[Content_Types].xml` first, and NO directory entries. PptxGenJS emits an
 * uncompressed zip with 19 folder entries, which LibreOffice's OPC reader
 * rejects as corrupt ("could not be repaired"). python-pptx and PowerPoint are
 * lenient; LibreOffice is not.
 */
async function repackForOpc(pkg: Uint8Array): Promise<Uint8Array> {
	const zin = await JSZip.loadAsync(pkg);
	const names = Object.keys(zin.files).filter((n) => !zin.files[n]?.dir);
	// [Content_Types].xml must be the first part in a valid OPC package.
	names.sort((a, b) =>
		a === "[Content_Types].xml" ? -1 : b === "[Content_Types].xml" ? 1 : 0,
	);
	const zout = new JSZip();
	for (const name of names) {
		const f = zin.files[name];
		// createFolders:false stops JSZip from re-emitting the directory entries
		// (the whole reason we're repacking) for each nested path.
		if (f)
			zout.file(name, await f.async("uint8array"), { createFolders: false });
	}
	return zout.generateAsync({
		type: "uint8array",
		compression: "DEFLATE",
		compressionOptions: { level: 6 },
	});
}

/** CSS hex ("#111" or "#112233") → PptxGenJS hex ("111111", no leading #). */
function hex(color: string | undefined): string | undefined {
	if (!color) return undefined;
	let c = color.replace("#", "").trim();
	if (c.length === 3)
		c = c
			.split("")
			.map((ch) => ch + ch)
			.join("");
	return c || undefined;
}

/** Map our TextRun[] to PptxGenJS's { text, options } run format (px → pt). */
function textRuns(runs: TextRun[]) {
	return runs.map((run) => ({
		text: run.text,
		options: {
			fontSize: run.size ? Math.round(run.size * 0.75 * 100) / 100 : undefined,
			bold: run.bold,
			italic: run.italic,
			color: hex(run.color),
			fontFace: run.font,
			charSpacing: run.spacing
				? Math.round(run.spacing * 0.75 * 100) / 100
				: undefined,
			breakLine: run.breakAfter,
		},
	}));
}

/** Our shape names → PptxGenJS shape names. */
const SHAPE = {
	rect: "rect",
	ellipse: "ellipse",
	arrow: "rightArrow",
} as const;

export async function emit(deck: Deck, outPath: string): Promise<void> {
	const pptx = new pptxgen();

	// Match our 1280x720 px canvas: 13.333 x 7.5 in at 96dpi.
	pptx.defineLayout({ name: "DECK", width: 13.333, height: 7.5 });
	pptx.layout = "DECK";

	for (const slide of deck.slides) {
		const s = pptx.addSlide();

		for (const el of slide.elements) {
			const pos = {
				x: inch(el.box.x),
				y: inch(el.box.y),
				w: inch(el.box.w),
				h: inch(el.box.h),
			};

			switch (el.kind) {
				case "text":
					// valign top matches how the browser lays text in its box.
					s.addText(textRuns(el.runs), {
						...pos,
						align: el.align,
						valign: "top",
						lineSpacingMultiple: el.lineHeight,
					});
					break;
				case "shape":
					s.addShape(
						el.shape === "rect" && el.radius ? "roundRect" : SHAPE[el.shape],
						{
							...pos,
							fill: el.fill ? { color: hex(el.fill) ?? "000000" } : undefined,
							// rectRadius is in inches; PptxGenJS caps it at half the short side.
							rectRadius: el.radius ? inch(el.radius) : undefined,
							line: el.stroke
								? {
										color: hex(el.stroke.color) ?? "000000",
										width: el.stroke.width * 0.75, // px → pt
									}
								: undefined,
						},
					);
					break;
				case "table":
					s.addTable(
						el.rows.map((row) => row.map((cell) => ({ text: cell }))),
						pos,
					);
					break;
				case "chart": {
					const colors = el.spec.colors
						?.map((c) => hex(c))
						.filter((c): c is string => !!c);
					s.addChart(
						el.spec.type,
						el.spec.series.map((ser) => ({
							name: ser.name,
							labels: el.spec.categories,
							values: ser.values,
						})),
						{
							...pos,
							chartColors: colors,
							holeSize: el.spec.type === "doughnut" ? 60 : undefined,
						},
					);
					break;
				}
				case "svg": {
					// Rasterize to PNG at 2x. PptxGenJS embeds SVG as an image part
					// that LibreOffice rejects (whole file fails to open) and Google
					// Slides shows as a broken image — a real PNG works everywhere.
					const width = Math.max(1, Math.round(el.box.w * 2));
					const png = new Resvg(el.svg, {
						fitTo: { mode: "width", value: width },
					})
						.render()
						.asPng();
					s.addImage({
						data: `data:image/png;base64,${png.toString("base64")}`,
						...pos,
					});
					break;
				}
				case "image":
					s.addImage({ path: el.src, ...pos });
					break;
			}
		}
	}

	const pkg = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
	await Bun.write(outPath, await repackForOpc(new Uint8Array(pkg)));
}
