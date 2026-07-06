import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { inspect } from "./inspect";

/**
 * Archives a shipped deck into the reference corpus: a per-deck folder holding the
 * deck.html, deck.pptx, and a SUMMARY.md index card. The card's style fields
 * (palette/fonts/slides/title) are read back from the pptx via inspect() — archive
 * never re-derives style, it just stores and indexes what inspect already extracts.
 * The next deck lists these cards, picks a match, and re-inspects it to seed from.
 */

/**
 * The corpus root. Defaults to the install's own `examples/` (resolved relative to
 * this file, so it's the same folder no matter the user's cwd — that's what makes the
 * corpus global and referenceable from anywhere). `DECK_MAKER_ARCHIVE_DIR` overrides it,
 * both to relocate the corpus and to keep tests off the real `examples/`.
 */
export function archivesDir(): string {
	return (
		process.env.DECK_MAKER_ARCHIVE_DIR ??
		resolve(import.meta.dir, "..", "examples")
	);
}

/** `Aurora Analytics — Q2` → `aurora-analytics-q2`. */
export function slugify(s: string): string {
	return (
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "untitled"
	);
}

export type ArchiveMeta = {
	title?: string;
	type?: string;
	language?: string;
	note?: string;
	/** YYYY-MM-DD; defaults to today. Injected in tests for a deterministic slug. */
	date?: string;
};

export type ArchiveCard = {
	slug: string;
	title: string;
	date: string;
	type: string;
	language: string;
	palette: string[];
	fonts: string[];
	slides: number;
	/** Absolute path to this deck's archive folder. */
	path: string;
};

function summaryMarkdown(
	card: Omit<ArchiveCard, "slug" | "path">,
	note: string,
): string {
	const fm = [
		"---",
		`title: ${card.title}`,
		`date: ${card.date}`,
		`type: ${card.type}`,
		`language: ${card.language}`,
		`palette: ${JSON.stringify(card.palette)}`,
		`fonts: ${JSON.stringify(card.fonts)}`,
		`slides: ${card.slides}`,
		"---",
	].join("\n");
	const body =
		note.trim() || "_What worked / what to reuse this deck for — fill in._";
	return `${fm}\n\n${body}\n`;
}

/**
 * Archive a converted deck. Returns the absolute path of the new archive folder.
 * `htmlPath`/`pptxPath` are the approved source and shipped artifact.
 */
export async function archive(
	htmlPath: string,
	pptxPath: string,
	meta: ArchiveMeta = {},
): Promise<string> {
	const bytes = new Uint8Array(await Bun.file(pptxPath).arrayBuffer());
	const deck = await inspect(bytes);

	const title = meta.title ?? deck.slides[0]?.texts[0] ?? "untitled";
	const date = meta.date ?? new Date().toISOString().slice(0, 10);
	const slug = `${date}-${slugify(title)}`;
	const dir = join(archivesDir(), slug);
	await mkdir(dir, { recursive: true });

	await Bun.write(join(dir, "deck.html"), Bun.file(htmlPath));
	await Bun.write(join(dir, "deck.pptx"), Bun.file(pptxPath));

	const card = {
		title,
		date,
		type: meta.type ?? "",
		language: meta.language ?? "",
		palette: deck.style.palette.slice(0, 6),
		fonts: deck.style.fonts.slice(0, 3),
		slides: deck.slides.length,
	};
	await Bun.write(
		join(dir, "SUMMARY.md"),
		summaryMarkdown(card, meta.note ?? ""),
	);

	return dir;
}

/** Parse the leading `---` frontmatter of a SUMMARY.md into a flat record. */
function parseFrontmatter(md: string): Record<string, string> {
	const m = md.match(/^---\n([\s\S]*?)\n---/);
	const out: Record<string, string> = {};
	if (!m?.[1]) return out;
	for (const line of m[1].split("\n")) {
		const i = line.indexOf(":");
		if (i === -1) continue;
		out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}
	return out;
}

function parseArray(v: string | undefined): string[] {
	if (!v) return [];
	try {
		const parsed = JSON.parse(v);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
}

/**
 * Every archived card, newest first — the cheap index an authoring agent scans to find
 * a deck like the one now requested (before deep-inspecting the winner).
 */
export async function listArchive(): Promise<ArchiveCard[]> {
	const root = archivesDir();
	if (!existsSync(root)) return [];
	const cards: ArchiveCard[] = [];
	for await (const rel of new Bun.Glob("*/SUMMARY.md").scan(root)) {
		const dir = join(root, rel.replace(/\/SUMMARY\.md$/, ""));
		const fm = parseFrontmatter(await Bun.file(join(root, rel)).text());
		cards.push({
			slug: rel.replace(/\/SUMMARY\.md$/, ""),
			title: fm.title ?? "",
			date: fm.date ?? "",
			type: fm.type ?? "",
			language: fm.language ?? "",
			palette: parseArray(fm.palette),
			fonts: parseArray(fm.fonts),
			slides: Number(fm.slides ?? 0),
			path: dir,
		});
	}
	cards.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	return cards;
}
