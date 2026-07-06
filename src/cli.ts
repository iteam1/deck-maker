#!/usr/bin/env bun
import { dirname, isAbsolute, resolve } from "node:path";
import { archive, listArchive } from "./archive";
import { check, formatViolations, type Violation } from "./check";
import { emit } from "./emit";
import { inspect } from "./inspect";
import { parse } from "./parse";

const argv = Bun.argv.slice(2);
const verb =
	argv[0] === "convert" ||
	argv[0] === "check" ||
	argv[0] === "inspect" ||
	argv[0] === "archive"
		? argv.shift()
		: "convert";

// `archive` manages its own flags/positionals and early-exits before the shared
// HTML pipeline — a bare `deck-maker archive` (list) must not trip the usage guard below.
if (verb === "archive") {
	const flags: Record<string, string> = {};
	const positional: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i] as string;
		if (a === "--list") {
			flags.list = "1";
		} else if (a.startsWith("--")) {
			flags[a.slice(2)] = argv[++i] ?? "";
		} else {
			positional.push(a);
		}
	}
	if (flags.list || positional.length === 0) {
		console.log(JSON.stringify(await listArchive(), null, 2));
		process.exit(0);
	}
	const [html, pptx] = positional;
	if (!html || !pptx) {
		console.error(
			"usage: deck-maker archive <deck.html> <deck.pptx> [--title T --type T --language L --note '…']\n" +
				"       deck-maker archive --list   # print archived decks as JSON",
		);
		process.exit(1);
	}
	const dir = await archive(html, pptx, {
		title: flags.title,
		type: flags.type,
		language: flags.language,
		note: flags.note,
	});
	console.log(`archived → ${dir}`);
	process.exit(0);
}

const [inPath, outPath] = argv;

if (!inPath || (verb === "convert" && !outPath)) {
	console.error(
		"usage: deck-maker convert <in.html> <out.pptx>\n" +
			"       deck-maker check <in.html>\n" +
			"       deck-maker inspect <in.pptx>   # read an EXISTING pptx's content as JSON\n" +
			"       deck-maker archive <in.html> <in.pptx>   # save a shipped deck to the corpus\n" +
			"       deck-maker archive --list   # list archived decks as JSON",
	);
	process.exit(1);
}

if (verb === "inspect") {
	const bytes = new Uint8Array(await Bun.file(inPath).arrayBuffer());
	const slides = await inspect(bytes);
	console.log(JSON.stringify(slides, null, 2));
	process.exit(0);
}

const html = await Bun.file(inPath).text();
const deck = parse(html);

// Image srcs in the HTML are relative to the deck file, not to our cwd.
const base = dirname(resolve(inPath));
const violations: Violation[] = [];
for (const [i, slide] of deck.slides.entries()) {
	for (const el of slide.elements) {
		if (
			el.kind === "image" &&
			el.src &&
			!isAbsolute(el.src) &&
			!/^(https?:|data:)/.test(el.src)
		) {
			el.src = resolve(base, el.src);
		}
		if (el.kind === "image" && el.src && !/^(https?:|data:)/.test(el.src)) {
			if (!(await Bun.file(el.src).exists()))
				violations.push({
					slide: i + 1,
					severity: "critical",
					message: `image file not found: ${el.src}`,
				});
		}
	}
}

violations.push(...check(deck));
const criticals = violations.filter((v) => v.severity === "critical").length;

if (violations.length) console.error(formatViolations(violations));

if (verb === "check") {
	console.log(
		`${deck.slides.length} slide(s), ${violations.length} issue(s), ${criticals} critical`,
	);
	process.exit(criticals ? 1 : 0);
}

if (criticals) {
	console.error(`refusing to convert: ${criticals} critical issue(s) above`);
	process.exit(1);
}

await emit(deck, outPath as string);
console.log(`wrote ${outPath}`);
