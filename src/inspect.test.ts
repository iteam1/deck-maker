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
	const result = await inspect(bytes);
	await unlink(out);
	return result;
}

test("recovers text content", async () => {
	const { slides } = await roundTrip(
		`<h1 style="position:absolute;left:0;top:0;width:400px;height:60px;font-size:32px">Hello there</h1>`,
	);
	expect(slides).toHaveLength(1);
	expect(slides[0]?.texts).toContain("Hello there");
});

test("recovers table rows and cells", async () => {
	const { slides } = await roundTrip(
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
	const { slides } = await roundTrip(
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
	const { slides } = await roundTrip(
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

	const { slides } = await roundTrip(
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
	const { slides } = await inspect(bytes);
	await unlink(out);

	expect(slides).toHaveLength(2);
	expect(slides[0]?.texts).toContain("First");
	expect(slides[1]?.texts).toContain("Second");
});

// ---------- style extraction ----------

test("recovers a full-bleed shape's fill as the slide background", async () => {
	const { slides } = await roundTrip(
		`<div data-shape="rect" style="position:absolute;left:0;top:0;width:1280px;height:720px;background:#002fa7"></div>`,
	);
	expect(slides[0]?.style.background).toBe("#002fa7");
	expect(slides[0]?.style.colors).toContain("#002fa7");
});

test("recovers text color and font face", async () => {
	const { slides } = await roundTrip(
		`<p style="position:absolute;left:0;top:0;width:400px;height:40px;font-size:20px;color:#4f46e5;font-family:Georgia">Styled</p>`,
	);
	expect(slides[0]?.style.colors).toContain("#4f46e5");
	expect(slides[0]?.style.fonts).toContain("Georgia");
});

test("distinguishes rounded shapes from square ones", async () => {
	const rounded = await roundTrip(
		`<div data-shape="rect" style="position:absolute;left:0;top:0;width:200px;height:100px;background:#fff;border-radius:14px"></div>`,
	);
	expect(rounded.slides[0]?.style.roundedShapes).toBe(true);

	const square = await roundTrip(
		`<div data-shape="rect" style="position:absolute;left:0;top:0;width:200px;height:100px;background:#fff"></div>`,
	);
	expect(square.slides[0]?.style.roundedShapes).toBe(false);
});

test("deck-level style rolls up palette, fonts, and backgrounds across slides", async () => {
	const deck = parse(
		`<section class="slide" style="width:1280px;height:720px;position:relative">` +
			`<div data-shape="rect" style="position:absolute;left:0;top:0;width:1280px;height:720px;background:#0f172a"></div>` +
			`<p style="position:absolute;left:0;top:0;width:200px;height:40px;font-size:20px;color:#4f46e5;font-family:Arial">A</p>` +
			`</section>` +
			`<section class="slide" style="width:1280px;height:720px;position:relative">` +
			`<p style="position:absolute;left:0;top:0;width:200px;height:40px;font-size:20px;color:#4f46e5;font-family:Arial">B</p>` +
			`</section>`,
	);
	const out = join(tmpdir(), `deck-maker-inspect-test-${Date.now()}.pptx`);
	await emit(deck, out);
	const bytes = new Uint8Array(await Bun.file(out).arrayBuffer());
	const { style } = await inspect(bytes);
	await unlink(out);

	expect(style.palette[0]).toBe("#4f46e5"); // appears on both slides -> ranked first
	expect(style.fonts).toContain("Arial");
	expect(style.backgrounds).toEqual(["#0f172a"]);
});

// ---------- layout (elements) ----------

test("elements carry per-element geometry on the canvas", async () => {
	const { canvas, slides } = await roundTrip(
		`<h1 style="position:absolute;left:64px;top:120px;width:800px;height:80px;font-size:64px;color:#111111">Layout probe</h1>` +
			`<div data-shape="rect" style="position:absolute;left:64px;top:300px;width:213px;height:107px;background:#ffd247"></div>`,
	);
	expect(canvas).toEqual({ w: 1280, h: 720 });
	const els = slides[0]?.elements ?? [];
	const title = els.find((e) => e.kind === "text");
	const card = els.find((e) => e.kind === "shape");
	expect(title).toMatchObject({ x: 64, y: 120, w: 800, h: 80, fontSizePx: 64 });
	expect(title?.text).toContain("Layout probe");
	expect(card).toMatchObject({
		x: 64,
		y: 300,
		w: 213,
		h: 107,
		color: "#ffd247",
	});
});

// ---------- real-PowerPoint templates (guarded: skipped when not present) ----------

const HOTEL = "examples/hotel/SlideEgg_201241-Hotel Management Dashboard.pptx";
const TECH =
	"examples/tech/Slide_Egg-73844-Artificial Intelligence PowerPoint.pptx";

test.if(await Bun.file(HOTEL).exists())(
	"real template (hotel): groups walked, rich palette, layout grid",
	async () => {
		const deck = await inspect(
			new Uint8Array(await Bun.file(HOTEL).arrayBuffer()),
		);
		expect(deck.canvas).toEqual({ w: 1280, h: 720 });
		expect(deck.style.palette.length).toBeGreaterThanOrEqual(6);
		expect(deck.style.fonts).toContain("Montserrat");
		// slide 2 is the KPI dashboard: a row of accent stat cards recovered from groups
		const els = deck.slides[1]?.elements ?? [];
		expect(els.length).toBeGreaterThan(10);
		const cards = els.filter(
			(e) => e.kind === "shape" && e.h > 90 && e.h < 120 && e.w > 190,
		);
		expect(cards.length).toBeGreaterThanOrEqual(3); // the stat-card row
	},
);

test.if(await Bun.file(TECH).exists())(
	"real template (tech): p:bg gradient + theme fonts resolved",
	async () => {
		const deck = await inspect(
			new Uint8Array(await Bun.file(TECH).arrayBuffer()),
		);
		// the slide background is a gradient of theme accents — first stop wins
		expect(deck.style.backgrounds).toContain("#262c82");
		expect(deck.style.palette).toContain("#ba3b96"); // second gradient stop
		expect(deck.style.themeFonts.minor).toBeTruthy();
		// grouped text was invisible before the recursive walk
		const slide2 = deck.slides[1];
		expect(slide2?.texts.join(" ")).toContain("Artificial Intelligence");
	},
);
