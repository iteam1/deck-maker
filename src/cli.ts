#!/usr/bin/env bun
import { dirname, isAbsolute, resolve } from "node:path";
import { check, formatViolations, type Violation } from "./check";
import { emit } from "./emit";
import { parse } from "./parse";

const argv = Bun.argv.slice(2);
const verb =
	argv[0] === "convert" || argv[0] === "check" ? argv.shift() : "convert";
const [inPath, outPath] = argv;

if (!inPath || (verb === "convert" && !outPath)) {
	console.error(
		"usage: deck-maker convert <in.html> <out.pptx>\n       deck-maker check <in.html>",
	);
	process.exit(1);
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
