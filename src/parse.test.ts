import { describe, expect, test } from "bun:test";
import { parse } from "./parse";

/** Wrap slide body in a minimal conforming document. */
const slide = (body: string) =>
	`<!doctype html><html lang="en"><body>${`<section class="slide" style="width:1280px;height:720px;position:relative">${body}</section>`}</body></html>`;

describe("parse", () => {
	test("reads a text element's geometry and style", () => {
		const deck = parse(
			slide(
				`<h1 style="position:absolute;left:96px;top:240px;width:1088px;height:120px;font-size:72px;color:#111">Hello</h1>`,
			),
		);
		expect(deck.slides).toHaveLength(1);
		const el = deck.slides[0]?.elements[0];
		expect(el?.kind).toBe("text");
		expect(el?.box).toEqual({ x: 96, y: 240, w: 1088, h: 120 });
		if (el?.kind === "text") {
			expect(el.runs[0]?.text).toBe("Hello");
			expect(el.runs[0]?.size).toBe(72);
			expect(el.runs[0]?.color).toBe("#111");
		}
	});

	test("classifies every primitive by DOM order", () => {
		const deck = parse(
			slide(`
				<div data-shape="rect" style="position:absolute;left:0;top:0;width:10px;height:10px;background:#4f46e5"></div>
				<table style="position:absolute;left:0;top:0;width:10px;height:10px"><tr><td>a</td></tr></table>
				<div data-chart='{"type":"bar","categories":["Q1"],"series":[{"name":"A","values":[1]}]}' style="position:absolute;left:0;top:0;width:10px;height:10px"></div>
				<svg style="position:absolute;left:0;top:0;width:10px;height:10px"><title>t</title></svg>
				<img src="x.png" style="position:absolute;left:0;top:0;width:10px;height:10px" />
				<p style="position:absolute;left:0;top:0;width:10px;height:10px">hi</p>
			`),
		);
		expect(deck.slides[0]?.elements.map((e) => e.kind)).toEqual([
			"shape",
			"table",
			"chart",
			"svg",
			"image",
			"text",
		]);
	});

	test("shape reads its variant and fill", () => {
		const deck = parse(
			slide(
				`<div data-shape="ellipse" style="position:absolute;left:0;top:0;width:10px;height:10px;background:#abc"></div>`,
			),
		);
		const el = deck.slides[0]?.elements[0];
		if (el?.kind !== "shape")
			throw new Error(`expected shape, got ${el?.kind}`);
		expect(el.shape).toBe("ellipse");
		expect(el.fill).toBe("#abc");
	});

	test("table reads its rows", () => {
		const deck = parse(
			slide(
				`<table style="position:absolute;left:0;top:0;width:10px;height:10px"><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>`,
			),
		);
		const el = deck.slides[0]?.elements[0];
		if (el?.kind !== "table")
			throw new Error(`expected table, got ${el?.kind}`);
		expect(el.rows).toEqual([
			["a", "b"],
			["c", "d"],
		]);
	});

	test("splits bold/italic children into styled runs, decoding entities", () => {
		const deck = parse(
			slide(
				`<p style="position:absolute;left:0;top:0;width:600px;height:40px;font-size:16px;color:#374151">plain <b>bold</b> and <i>italic &mdash; decoded</i> tail</p>`,
			),
		);
		const el = deck.slides[0]?.elements[0];
		if (el?.kind !== "text") throw new Error(`expected text, got ${el?.kind}`);
		expect(el.runs.map((r) => r.text)).toEqual([
			"plain ",
			"bold",
			" and ",
			"italic — decoded",
			" tail",
		]);
		expect(el.runs[1]?.bold).toBe(true);
		expect(el.runs[3]?.italic).toBe(true);
		// inherited element style reaches every run
		expect(el.runs[0]?.size).toBe(16);
		expect(el.runs[3]?.color).toBe("#374151");
	});

	test("nested bold+italic combine; text-align is read", () => {
		const deck = parse(
			slide(
				`<p style="position:absolute;left:0;top:0;width:600px;height:40px;text-align:center"><b><i>both</i></b></p>`,
			),
		);
		const el = deck.slides[0]?.elements[0];
		if (el?.kind !== "text") throw new Error(`expected text, got ${el?.kind}`);
		expect(el.align).toBe("center");
		expect(el.runs[0]?.bold).toBe(true);
		expect(el.runs[0]?.italic).toBe(true);
	});

	test("resolves var(--x) and var(--x, fallback) from a :root theme block", () => {
		const deck = parse(
			`<style>:root{--od-accent:#4f46e5}</style>` +
				`<section class="slide" style="width:1280px;height:720px;position:relative">` +
				`<div data-shape="rect" style="position:absolute;left:0;top:0;width:10px;height:10px;background:var(--od-accent)"></div>` +
				`<div data-shape="rect" style="position:absolute;left:0;top:0;width:10px;height:10px;background:var(--od-missing, #10b981)"></div>` +
				`</section>`,
		);
		const [a, b] = deck.slides[0]?.elements ?? [];
		if (a?.kind !== "shape" || b?.kind !== "shape")
			throw new Error("expected shapes");
		expect(a.fill).toBe("#4f46e5"); // resolved from :root
		expect(b.fill).toBe("#10b981"); // fell back
	});

	test("chart parses its data-chart JSON", () => {
		const deck = parse(
			slide(
				`<div data-chart='{"type":"line","categories":["Q1","Q2"],"series":[{"name":"A","values":[1,2]}]}' style="position:absolute;left:0;top:0;width:10px;height:10px"></div>`,
			),
		);
		const el = deck.slides[0]?.elements[0];
		if (el?.kind !== "chart")
			throw new Error(`expected chart, got ${el?.kind}`);
		expect(el.spec.type).toBe("line");
		expect(el.spec.categories).toEqual(["Q1", "Q2"]);
		expect(el.spec.series[0]?.values).toEqual([1, 2]);
	});
});
