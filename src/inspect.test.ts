import { expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emit } from "./emit";
import { inspect } from "./inspect";
import { parse } from "./parse";

/** Round-trip a slide's HTML through our own emit(), then read it back. */
async function roundTrip(bodyHtml: string) {
	const deck = parse(
		`<section class="slide" style="width:1280px;height:720px;position:relative">${bodyHtml}</section>`,
	);
	const out = join(tmpdir(), `deck-maker-inspect-test-${Date.now()}.pptx`);
	await emit(deck, out);
	const bytes = new Uint8Array(await Bun.file(out).arrayBuffer());
	const slides = await inspect(bytes);
	await unlink(out);
	return slides;
}

test("recovers text content", async () => {
	const slides = await roundTrip(
		`<h1 style="position:absolute;left:0;top:0;width:400px;height:60px;font-size:32px">Hello there</h1>`,
	);
	expect(slides).toHaveLength(1);
	expect(slides[0]?.texts).toContain("Hello there");
});

test("recovers table rows and cells", async () => {
	const slides = await roundTrip(
		`<table style="position:absolute;left:0;top:0;width:300px;height:100px">
			<tr><td>Region</td><td>Revenue</td></tr>
			<tr><td>NA</td><td>$14.2M</td></tr>
		</table>`,
	);
	expect(slides[0]?.tables).toEqual([
		[
			["Region", "Revenue"],
			["NA", "$14.2M"],
		],
	]);
});

test("recovers bar chart categories, series names, and values", async () => {
	const slides = await roundTrip(
		`<div data-chart='{"type":"bar","categories":["Q1","Q2"],"series":[{"name":"Revenue","values":[4.2,5.1]},{"name":"Costs","values":[2,3]}]}' style="position:absolute;left:0;top:0;width:400px;height:300px"></div>`,
	);
	expect(slides[0]?.charts).toEqual([
		{
			type: "bar",
			categories: ["Q1", "Q2"],
			series: [
				{ name: "Revenue", values: [4.2, 5.1] },
				{ name: "Costs", values: [2, 3] },
			],
		},
	]);
});

test("recovers doughnut chart with a single series", async () => {
	const slides = await roundTrip(
		`<div data-chart='{"type":"doughnut","categories":["NA","EU","APAC"],"series":[{"name":"Q2","values":[14.2,8.6,4.1]}]}' style="position:absolute;left:0;top:0;width:400px;height:300px"></div>`,
	);
	expect(slides[0]?.charts).toEqual([
		{
			type: "doughnut",
			categories: ["NA", "EU", "APAC"],
			series: [{ name: "Q2", values: [14.2, 8.6, 4.1] }],
		},
	]);
});

test("recovers an image reference", async () => {
	// A 1x1 transparent PNG, base64-decoded to a real temp file the converter can embed.
	const png = Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	);
	const imgPath = join(tmpdir(), `deck-maker-inspect-test-${Date.now()}.png`);
	await Bun.write(imgPath, png);

	const slides = await roundTrip(
		`<img src="${imgPath}" style="position:absolute;left:0;top:0;width:100px;height:100px" />`,
	);
	await unlink(imgPath);

	expect(slides[0]?.images).toHaveLength(1);
	expect(slides[0]?.images[0]).toContain("ppt/media/");
});

test("multi-slide decks return one entry per slide, in order", async () => {
	const deck = parse(
		`<section class="slide" style="width:1280px;height:720px;position:relative"><p style="position:absolute;left:0;top:0;width:200px;height:40px">First</p></section>` +
			`<section class="slide" style="width:1280px;height:720px;position:relative"><p style="position:absolute;left:0;top:0;width:200px;height:40px">Second</p></section>`,
	);
	const out = join(tmpdir(), `deck-maker-inspect-test-${Date.now()}.pptx`);
	await emit(deck, out);
	const bytes = new Uint8Array(await Bun.file(out).arrayBuffer());
	const slides = await inspect(bytes);
	await unlink(out);

	expect(slides).toHaveLength(2);
	expect(slides[0]?.texts).toContain("First");
	expect(slides[1]?.texts).toContain("Second");
});
