import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archive, listArchive, slugify } from "./archive";
import { emit } from "./emit";
import { parse } from "./parse";

// Point the corpus at a throwaway dir so tests never touch the real examples/.
// Source .pptx are built in a SEPARATE dir so they aren't mistaken for corpus starters.
let root: string;
let srcDir: string;
beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "dm-archive-test-"));
	srcDir = await mkdtemp(join(tmpdir(), "dm-archive-src-"));
	process.env.DECK_MAKER_ARCHIVE_DIR = root;
});
afterAll(async () => {
	await rm(root, { recursive: true, force: true });
	await rm(srcDir, { recursive: true, force: true });
	delete process.env.DECK_MAKER_ARCHIVE_DIR;
});

/** Build a real .pptx (outside the corpus) from a one-slide deck to feed archive(). */
async function makePptx(
	into = srcDir,
	name = `src-${Date.now()}.pptx`,
): Promise<string> {
	const deck = parse(
		`<section class="slide" style="width:1280px;height:720px;position:relative">` +
			`<div data-shape="rect" style="position:absolute;left:0;top:0;width:1280px;height:720px;background:#002fa7"></div>` +
			`<h1 style="position:absolute;left:64px;top:120px;width:800px;height:80px;font-size:64px;color:#fafaf8">Acme Q3 Review</h1>` +
			`</section>`,
	);
	const out = join(into, name);
	await emit(deck, out);
	return out;
}

test("slugify normalizes titles", () => {
	expect(slugify("Aurora Analytics — Q2 FY2026")).toBe(
		"aurora-analytics-q2-fy2026",
	);
	expect(slugify("  !!!  ")).toBe("untitled");
});

test("archive writes the folder, copies both files, and auto-fills the card", async () => {
	const pptx = await makePptx();
	// Reuse the pptx as the "html" too — archive only copies it verbatim.
	const dir = await archive(pptx, pptx, {
		date: "1970-01-01",
		type: "qbr",
		language: "swiss-ikb",
		note: "board deck",
	});

	expect(dir).toBe(join(root, "1970-01-01-acme-q3-review"));
	expect(await Bun.file(join(dir, "deck.html")).exists()).toBe(true);
	expect(await Bun.file(join(dir, "deck.pptx")).exists()).toBe(true);

	const summary = await Bun.file(join(dir, "SUMMARY.md")).text();
	expect(summary).toContain("title: Acme Q3 Review");
	expect(summary).toContain("type: qbr");
	expect(summary).toContain("language: swiss-ikb");
	expect(summary).toContain("slides: 1");
	expect(summary).toContain("#002fa7"); // palette recovered from the pptx via inspect
	expect(summary).toContain("board deck");
});

test("title falls back to the first slide's text when no --title", async () => {
	const pptx = await makePptx();
	const dir = await archive(pptx, pptx, { date: "1970-01-02" });
	const summary = await Bun.file(join(dir, "SUMMARY.md")).text();
	expect(summary).toContain("title: Acme Q3 Review");
});

test("listArchive round-trips the frontmatter, newest first", async () => {
	const pptx = await makePptx();
	await archive(pptx, pptx, {
		date: "1970-01-01",
		title: "Older",
		type: "qbr",
	});
	await archive(pptx, pptx, {
		date: "2999-01-01",
		title: "Newer",
		language: "aurora-cards",
	});

	const cards = await listArchive();
	const older = cards.find((c) => c.title === "Older");
	const newer = cards.find((c) => c.title === "Newer");

	expect(older).toBeDefined();
	expect(newer).toBeDefined();
	expect(older?.type).toBe("qbr");
	expect(newer?.language).toBe("aurora-cards");
	expect(newer?.palette).toContain("#002fa7");
	expect(newer?.slides).toBe(1);
	// Sorted newest-first: the 2999 card precedes the 1970 card.
	expect(cards.findIndex((c) => c.title === "Newer")).toBeLessThan(
		cards.findIndex((c) => c.title === "Older"),
	);
});

test("archives a bare pptx with no html (starter)", async () => {
	const pptx = await makePptx();
	const dir = await archive(undefined, pptx, {
		date: "1970-01-03",
		title: "Starter",
	});

	expect(dir).toBe(join(root, "1970-01-03-starter"));
	expect(await Bun.file(join(dir, "deck.pptx")).exists()).toBe(true);
	expect(await Bun.file(join(dir, "deck.html")).exists()).toBe(false);
	const summary = await Bun.file(join(dir, "SUMMARY.md")).text();
	expect(summary).toContain("title: Starter");
	expect(summary).toContain("#002fa7");
});

test("listArchive synthesizes a card for a bare pptx dropped in (no summary)", async () => {
	const iso = await mkdtemp(join(tmpdir(), "dm-archive-iso-"));
	process.env.DECK_MAKER_ARCHIVE_DIR = iso;
	try {
		// A nice deck dropped straight into the corpus — no folder, no SUMMARY, no html.
		await makePptx(iso, "mckinsey-starter.pptx");
		const cards = await listArchive();

		expect(cards).toHaveLength(1);
		const c = cards[0];
		expect(c?.slug).toBe("mckinsey-starter");
		expect(c?.type).toBe(""); // nothing recorded — the card is synthesized
		expect(c?.palette).toContain("#002fa7"); // recovered by inspecting the file
		expect(c?.slides).toBe(1);
		expect(c?.pptx).toBe(join(iso, "mckinsey-starter.pptx"));
	} finally {
		await rm(iso, { recursive: true, force: true });
		process.env.DECK_MAKER_ARCHIVE_DIR = root;
	}
});

test("listArchive returns [] when the corpus dir does not exist", async () => {
	process.env.DECK_MAKER_ARCHIVE_DIR = join(
		tmpdir(),
		`dm-absent-${Date.now()}`,
	);
	expect(await listArchive()).toEqual([]);
	process.env.DECK_MAKER_ARCHIVE_DIR = root; // restore for any later cases
});
