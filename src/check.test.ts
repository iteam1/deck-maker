import { describe, expect, test } from "bun:test";
import { check } from "./check";
import type { Deck, Element } from "./types";

const deck = (...elements: Element[]): Deck => ({
	slides: [{ w: 1280, h: 720, elements }],
});
const text = (box: Element["box"], t = "hi"): Element => ({
	kind: "text",
	box,
	runs: [{ text: t, size: 16 }],
});

describe("check", () => {
	test("clean deck passes", () => {
		expect(check(deck(text({ x: 64, y: 150, w: 400, h: 40 })))).toEqual([]);
	});

	test("zero-size box is critical", () => {
		const v = check(deck(text({ x: 64, y: 150, w: 0, h: 0 })));
		expect(v[0]?.severity).toBe("critical");
		expect(v[0]?.message).toContain("width or height");
	});

	test("off-canvas box is critical", () => {
		const v = check(deck(text({ x: 1200, y: 150, w: 200, h: 40 })));
		expect(v[0]?.severity).toBe("critical");
		expect(v[0]?.message).toContain("off-canvas");
	});

	test("content crossing the footer rail is high", () => {
		const v = check(deck(text({ x: 64, y: 600, w: 400, h: 80 })));
		expect(v[0]?.severity).toBe("high");
		expect(v[0]?.message).toContain("footer rail");
	});

	test("footer chrome below FOOTER_TOP is exempt from the rail", () => {
		expect(check(deck(text({ x: 64, y: 668, w: 400, h: 22 })))).toEqual([]);
	});

	test("decorative shapes may bleed past the rail", () => {
		const bg: Element = {
			kind: "shape",
			box: { x: 0, y: 0, w: 1280, h: 720 },
			shape: "rect",
			fill: "#0f172a",
		};
		expect(check(deck(bg))).toEqual([]);
	});

	test("chart series/categories mismatch is critical", () => {
		const chart: Element = {
			kind: "chart",
			box: { x: 64, y: 150, w: 400, h: 300 },
			spec: {
				type: "bar",
				categories: ["Q1", "Q2", "Q3"],
				series: [{ name: "Rev", values: [1, 2] }],
			},
		};
		const v = check(deck(chart));
		expect(v[0]?.severity).toBe("critical");
		expect(v[0]?.message).toContain("2 values for 3 categories");
	});

	test("text crammed into a tiny box is flagged medium", () => {
		const v = check(
			deck(text({ x: 64, y: 150, w: 100, h: 20 }, "a".repeat(400))),
		);
		expect(v[0]?.severity).toBe("medium");
		expect(v[0]?.message).toContain("overflows");
	});

	test("flags literal ellipsis and straight quotes", () => {
		const v = check(
			deck(text({ x: 64, y: 150, w: 600, h: 40 }, 'he said "hi..."')),
		);
		const msgs = v.map((x) => x.message).join(" | ");
		expect(msgs).toContain("ellipsis");
		expect(msgs).toContain("curly quotes");
		expect(v.every((x) => x.severity === "medium")).toBe(true);
	});

	test("empty slide is high", () => {
		const v = check({ slides: [{ w: 1280, h: 720, elements: [] }] });
		expect(v[0]?.severity).toBe("high");
	});
});
