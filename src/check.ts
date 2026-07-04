import type { Deck, Element } from "./types";

/**
 * Geometry verification — the pre-flight gate for a deck.
 * Adapted from the footer-rail discipline in open-design's
 * pptx-html-fidelity-audit skill: hard numeric rails catch the
 * 1-2mm overflows that eyes miss at zoom-out.
 */

export type Severity = "critical" | "high" | "medium";
export type Violation = { slide: number; severity: Severity; message: string };

export const SLIDE_W = 1280;
export const SLIDE_H = 720;
/** Content must end above this rail (px) — mirrors a 6.70in rail on a 7.5in slide. */
export const CONTENT_MAX_Y = 643;
/** Elements starting at/below this line are footer chrome, exempt from the rail. */
export const FOOTER_TOP = 658;

/** Kinds the footer rail applies to; shapes/svg are decoration and may bleed. */
const CONTENT_KINDS = new Set(["text", "table", "chart", "image"]);

export function check(deck: Deck): Violation[] {
	const out: Violation[] = [];

	deck.slides.forEach((slide, i) => {
		const n = i + 1;
		if (slide.elements.length === 0)
			out.push({
				slide: n,
				severity: "high",
				message: "slide has no elements",
			});

		for (const el of slide.elements) {
			const { x, y, w, h } = el.box;
			const what = describe(el);

			if (w <= 0 || h <= 0)
				out.push({
					slide: n,
					severity: "critical",
					message: `${what}: zero/missing width or height — left/top/width/height must all be set inline`,
				});
			else if (x < 0 || y < 0 || x + w > SLIDE_W || y + h > SLIDE_H)
				out.push({
					slide: n,
					severity: "critical",
					message: `${what}: off-canvas (box ${x},${y} ${w}x${h} exceeds ${SLIDE_W}x${SLIDE_H})`,
				});
			else if (
				CONTENT_KINDS.has(el.kind) &&
				y < FOOTER_TOP &&
				y + h > CONTENT_MAX_Y
			)
				out.push({
					slide: n,
					severity: "high",
					message: `${what}: crosses the footer rail (ends at ${y + h}px, rail is ${CONTENT_MAX_Y}px — move it up, shrink it, or move it into the footer zone at y >= ${FOOTER_TOP}px)`,
				});

			if (el.kind === "chart")
				for (const s of el.spec.series)
					if (s.values.length !== el.spec.categories.length)
						out.push({
							slide: n,
							severity: "critical",
							message: `${what}: series "${s.name}" has ${s.values.length} values for ${el.spec.categories.length} categories`,
						});

			if (el.kind === "text") {
				const s = el.runs.map((r) => r.text).join("");
				if (s.includes("..."))
					out.push({
						slide: n,
						severity: "medium",
						message: `${what}: literal "..." — use a real ellipsis … (or &hellip;)`,
					});
				if (/[\w][:,;]?\s*"|"\s*[\w.]/.test(s) || s.includes('"'))
					out.push({
						slide: n,
						severity: "medium",
						message: `${what}: straight quote " — use curly quotes “ ” “ ” (&ldquo; &rdquo;)`,
					});
			}

			if (el.kind === "text" && w > 0 && h > 0) {
				// Rough wrap estimate — PowerPoint wraps sooner than Chrome, so flag
				// boxes that look tight even in the browser's metrics.
				const size = el.runs[0]?.size ?? 16;
				const chars = el.runs.reduce((a, r) => a + r.text.length, 0);
				const perLine = Math.max(1, Math.floor(w / (size * 0.55)));
				const estH = Math.ceil(chars / perLine) * size * 1.25;
				if (estH > h * 1.35)
					out.push({
						slide: n,
						severity: "medium",
						message: `${what}: text likely overflows its ${h}px box (~${Math.round(estH)}px needed; PowerPoint wraps sooner than Chrome)`,
					});
			}
		}
	});

	return out;
}

function describe(el: Element): string {
	if (el.kind === "text") {
		const t = el.runs.map((r) => r.text).join("");
		return `text "${t.length > 36 ? `${t.slice(0, 36)}…` : t}"`;
	}
	return el.kind;
}

const ICON: Record<Severity, string> = {
	critical: "\u{1F534}", // red circle
	high: "\u{1F7E0}", // orange circle
	medium: "\u{1F7E1}", // yellow circle
};

export function formatViolations(violations: Violation[]): string {
	return violations
		.map((v) => `${ICON[v.severity]} slide ${v.slide}: ${v.message}`)
		.join("\n");
}
