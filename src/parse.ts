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

/**
 * Extract CSS custom properties from the first `:root { … }` block found in any
 * `<style>` tag. This is a flat lookup, not a cascade — it lets a deck carry a
 * theme block and reference it with `var(--x)`, keeping the "no layout engine"
 * promise (see open-design's design-token model).
 */
function themeVars(root: HTMLElement): Record<string, string> {
	const vars: Record<string, string> = {};
	for (const style of root.querySelectorAll("style")) {
		const block = style.text.match(/:root\s*\{([^}]*)\}/);
		if (!block?.[1]) continue;
		for (const [k, v] of Object.entries(styleMap(block[1])))
			if (k.startsWith("--")) vars[k] = v;
	}
	return vars;
}

/** Replace `var(--x)` / `var(--x, fallback)` in a style string from the theme map. */
function resolveVars(style: string, vars: Record<string, string>): string {
	return style.replace(
		/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
		(_, name, fallback) => vars[name] ?? fallback?.trim() ?? "",
	);
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

/** Inheritable text styling carried down into runs. */
type RunStyle = {
	size?: number;
	bold?: boolean;
	italic?: boolean;
	color?: string;
	font?: string;
	spacing?: number;
};

/** letter-spacing → px ("2px" → 2, "0.14em" → 0.14 × size). */
function spacingFrom(
	v: string | undefined,
	size: number | undefined,
	base: number | undefined,
) {
	if (!v) return base;
	if (v.endsWith("em")) return parseFloat(v) * (size ?? 16) || base;
	return parseFloat(v) || base;
}

/** First family from a font-family list, unquoted ('"Fira Sans", Arial' → 'Fira Sans'). */
function firstFont(v: string | undefined): string | undefined {
	const first = v
		?.split(",")[0]
		?.trim()
		.replace(/^["']|["']$/g, "");
	return first || undefined;
}

function boldFrom(weight: string | undefined, base: boolean | undefined) {
	if (!weight) return base;
	if (weight === "bold" || weight === "bolder") return true;
	if (weight === "normal") return false;
	const n = Number.parseInt(weight, 10);
	return Number.isNaN(n) ? base : n >= 600;
}

function italicFrom(style: string | undefined, base: boolean | undefined) {
	if (!style) return base;
	return style === "italic" || style === "oblique";
}

/** Overlay an element's inline style onto an inherited run style. */
function mergeStyle(s: Record<string, string>, base: RunStyle): RunStyle {
	const size = px(s["font-size"]) || base.size;
	return {
		size,
		bold: boldFrom(s["font-weight"], base.bold),
		italic: italicFrom(s["font-style"], base.italic),
		color: s["color"] ?? base.color,
		font: firstFont(s["font-family"]) ?? base.font,
		spacing: spacingFrom(s["letter-spacing"], size, base.spacing),
	};
}

/**
 * Flatten an element's children into styled runs: text nodes carry the inherited
 * style; <b>/<strong> and <i>/<em> (and nested spans with inline style) refine it.
 */
function collectRuns(
	el: HTMLElement,
	style: RunStyle,
	vars: Record<string, string>,
	out: TextRun[],
	pre = false,
) {
	for (const child of el.childNodes) {
		if (child.nodeType === 3) {
			// .text decodes HTML entities (&copy; → ©); .rawText would not.
			if (pre) {
				// <pre> mode: preserve line structure (ASCII art, dot fields).
				const lines = child.text.replace(/^\n/, "").split("\n");
				lines.forEach((line, i) => {
					const text = line.trimEnd();
					if (text || i < lines.length - 1)
						out.push({
							text,
							...style,
							breakAfter: i < lines.length - 1 || undefined,
						});
				});
			} else {
				const text = child.text.replace(/\s+/g, " ");
				if (text) out.push({ text, ...style });
			}
		} else if (child.nodeType === 1) {
			const c = child as HTMLElement;
			const tag = c.tagName?.toLowerCase();
			const s = mergeStyle(
				styleMap(resolveVars(c.getAttribute("style") ?? "", vars)),
				style,
			);
			if (tag === "b" || tag === "strong") s.bold = true;
			if (tag === "i" || tag === "em") s.italic = true;
			collectRuns(c, s, vars, out, pre || tag === "pre");
		}
	}
}

/**
 * Classify one positioned element into an IR Element.
 * Detection precedence: chart → table → svg → shape → image → text.
 */
function classify(
	el: HTMLElement,
	vars: Record<string, string>,
): Element | null {
	const s = styleMap(resolveVars(el.getAttribute("style") ?? "", vars));
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
		// "border: 1px solid #e2e8f0" → stroke
		const border = s["border"]?.match(
			/^([\d.]+)px\s+solid\s+(#[0-9a-fA-F]{3,6})/,
		);
		return {
			kind: "shape",
			box,
			shape,
			fill: s["background"] ?? s["background-color"],
			radius: px(s["border-radius"]) || undefined,
			stroke:
				border?.[1] && border[2]
					? { color: border[2], width: parseFloat(border[1]) }
					: undefined,
		};
	}

	if (tag === "img")
		return { kind: "image", box, src: el.getAttribute("src") ?? "" };

	const base = mergeStyle(s, {});
	const pre = tag === "pre" || s["white-space"]?.startsWith("pre") === true;
	const runs: TextRun[] = [];
	collectRuns(el, base, vars, runs, pre);
	const first = runs[0];
	if (first && !pre) first.text = first.text.trimStart();
	const last = runs[runs.length - 1];
	if (last && !pre) last.text = last.text.trimEnd();
	const kept = runs.filter((r) => r.text.length > 0 || r.breakAfter);

	if (kept.length) {
		const a = s["text-align"];
		const lh = s["line-height"];
		const lhNum = lh ? parseFloat(lh) : Number.NaN;
		return {
			kind: "text",
			box,
			runs: kept,
			align: a === "left" || a === "center" || a === "right" ? a : undefined,
			// unitless multiple, or px ÷ font-size
			lineHeight: Number.isNaN(lhNum)
				? undefined
				: lh?.endsWith("px")
					? lhNum / (base.size ?? 16)
					: lhNum,
		};
	}

	return null;
}

export function parse(html: string): Deck {
	const root = parseHtml(html);
	const vars = themeVars(root);

	const slides: Slide[] = root.querySelectorAll(".slide").map((slideEl) => {
		const elements: Element[] = [];
		// Only direct element children of the slide are positioned primitives;
		// anything nested (table cells, svg innards, bold spans) belongs to its owner.
		for (const child of slideEl.childNodes) {
			if (child.nodeType !== 1) continue;
			const el = classify(child as HTMLElement, vars);
			if (el) elements.push(el);
		}
		return { w: 1280, h: 720, elements };
	});

	return { slides };
}
