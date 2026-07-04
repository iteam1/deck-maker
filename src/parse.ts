import { parse as parseHtml } from "node-html-parser";
import type { Box, Deck, Element, Slide } from "./types";

/**
 * Turn an inline style string ("left: 96px; color: #111") into a { prop: value } lookup.
 */
function styleMap(style: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const piece of style.split(";")) {
		const i = piece.indexOf(":");
		if (i === -1) continue;
		const key = piece.slice(0, i).trim();
		const value = piece.slice(i + 1).trim();
		out[key] = value;
	}
	return out;
}

/** Read the px geometry from an inline style. Worked example — mirror this pattern. */
function readBox(style: string): Box {
	const s = styleMap(style);
	const px = (v: string | undefined) => parseFloat(v ?? "0") || 0;
	return {
		x: px(s["left"]),
		y: px(s["top"]),
		w: px(s["width"]),
		h: px(s["height"]),
	};
}

export function parse(html: string): Deck {
	const root = parseHtml(html);

	const slides: Slide[] = root.querySelectorAll(".slide").map((slideEl) => {
		const elements: Element[] = slideEl.querySelectorAll("h1").map((el) => {
			const style = el.getAttribute("style") ?? "";
			const s = styleMap(style);
			return {
				kind: "text",
				box: readBox(style),
				runs: [
					{
						text: el.text.trim(),
						size: parseFloat(s["font-size"] ?? "0") || 0,
						color: s["color"],
					},
				],
			};
		});

		return { w: 1280, h: 720, elements };
	});

	return { slides };
}
