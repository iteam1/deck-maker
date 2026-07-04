import pptxgen from "pptxgenjs";
import type { Deck, TextRun } from "./types";

/** px → inches for PptxGenJS (our canvas is 96dpi). */
const inch = (px: number) => px / 96;

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

/** Map our TextRun[] to PptxGenJS's { text, options } run format. */
function textRuns(runs: TextRun[]) {
	return runs.map((run) => ({
		text: run.text,
		options: { fontSize: run.size, bold: run.bold, color: hex(run.color) },
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
					s.addText(textRuns(el.runs), pos);
					break;
				case "shape":
					s.addShape(SHAPE[el.shape], {
						...pos,
						fill: el.fill ? { color: hex(el.fill) ?? "000000" } : undefined,
					});
					break;
				case "table":
					s.addTable(
						el.rows.map((row) => row.map((cell) => ({ text: cell }))),
						pos,
					);
					break;
				case "chart":
					s.addChart(
						el.spec.type,
						el.spec.series.map((ser) => ({
							name: ser.name,
							labels: el.spec.categories,
							values: ser.values,
						})),
						pos,
					);
					break;
				case "svg":
					s.addImage({
						data: `data:image/svg+xml;base64,${Buffer.from(el.svg).toString("base64")}`,
						...pos,
					});
					break;
				case "image":
					s.addImage({ path: el.src, ...pos });
					break;
			}
		}
	}

	await pptx.writeFile({ fileName: outPath });
}
