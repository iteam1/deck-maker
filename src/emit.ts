import pptxgen from "pptxgenjs";
import type { Deck, TextRun } from "./types";

/** px → inches for PptxGenJS (our canvas is 96dpi). */
const inch = (px: number) => px / 96;

/** CSS hex ("#111" or "#112233") → PptxGenJS hex ("111111", no leading #). */
function hex(color: string | undefined): string | undefined {
	if (!color) return undefined;
	let c = color.replace("#", "");
	if (c.length === 3)
		c = c
			.split("")
			.map((ch) => ch + ch)
			.join("");
	return c;
}

/** Map our TextRun[] to PptxGenJS's { text, options } run format. */
function textRuns(runs: TextRun[]) {
	return runs.map((run) => ({
		text: run.text,
		options: {
			fontSize: run.size,
			bold: run.bold,
			color: hex(run.color),
		},
	}));
}

export async function emit(deck: Deck, outPath: string): Promise<void> {
	const pptx = new pptxgen();

	// Match our 1280x720 px canvas: 13.333 x 7.5 in at 96dpi.
	pptx.defineLayout({ name: "DECK", width: 13.333, height: 7.5 });
	pptx.layout = "DECK";

	for (const slide of deck.slides) {
		const s = pptx.addSlide();
		for (const element of slide.elements) {
			switch (element.kind) {
				case "text": {
					const { box } = element;
					s.addText(textRuns(element.runs), {
						x: inch(box.x),
						y: inch(box.y),
						w: inch(box.w),
						h: inch(box.h),
					});
					break;
				}
				default:
					throw new Error(
						`unsupported element kind: ${(element as { kind: string }).kind}`,
					);
			}
		}
	}

	await pptx.writeFile({ fileName: outPath });
}
