import type { HTMLElement } from "node-html-parser";
import { parse as parseHtml } from "node-html-parser";
import type { Box, ChartSpec, Deck, Element, Slide, TextRun } from "./types";

/** Turn an inline style string ("left: 96px; color: #111") into a { prop: value } lookup. */
function styleMap(style: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const piece of style.split(";")) {
		const i = piece.indexOf(":");
		if (i === -1) continue;
		out[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
	}
	return out;
}

/** Parse a px value ("96px" → 96), tolerating missing/garbage. */
const px = (v: string | undefined) => parseFloat(v ?? "0") || 0;

/** Read the px geometry from an element's inline style. */
function readBox(s: Record<string, string>): Box {
	return {
		x: px(s["left"]),
		y: px(s["top"]),
		w: px(s["width"]),
		h: px(s["height"]),
	};
}

/**
 * Classify one positioned element into an IR Element.
 * Detection precedence: chart → table → svg → shape → image → text.
 */
function classify(el: HTMLElement): Element | null {
	const s = styleMap(el.getAttribute("style") ?? "");
	const box = readBox(s);
	const tag = el.tagName?.toLowerCase();

	const chart = el.getAttribute("data-chart");
	if (chart)
		return { kind: "chart", box, spec: JSON.parse(chart) as ChartSpec };

	if (tag === "table") {
		const rows = el
			.querySelectorAll("tr")
			.map((tr) =>
				tr.querySelectorAll("td, th").map((cell) => cell.text.trim()),
			);
		return { kind: "table", box, rows };
	}

	if (tag === "svg") return { kind: "svg", box, svg: el.toString() };

	const shape = el.getAttribute("data-shape");
	if (shape === "rect" || shape === "ellipse" || shape === "arrow") {
		return {
			kind: "shape",
			box,
			shape,
			fill: s["background"] ?? s["background-color"],
		};
	}

	if (tag === "img")
		return { kind: "image", box, src: el.getAttribute("src") ?? "" };

	const text = el.text.trim();
	if (text) {
		const run: TextRun = {
			text,
			size: px(s["font-size"]) || undefined,
			bold: s["font-weight"] === "bold" || undefined,
			color: s["color"],
		};
		return { kind: "text", box, runs: [run] };
	}

	return null;
}

export function parse(html: string): Deck {
	const root = parseHtml(html);

	const slides: Slide[] = root.querySelectorAll(".slide").map((slideEl) => {
		const elements: Element[] = [];
		// Only direct element children of the slide are positioned primitives;
		// anything nested (table cells, svg innards) is handled by its owner.
		for (const child of slideEl.childNodes) {
			if (child.nodeType !== 1) continue;
			const el = classify(child as HTMLElement);
			if (el) elements.push(el);
		}
		return { w: 1280, h: 720, elements };
	});

	return { slides };
}
