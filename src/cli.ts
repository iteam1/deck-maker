import { emit } from "./emit";
import { parse } from "./parse";

const [inPath, outPath] = Bun.argv.slice(2);

if (!inPath || !outPath) {
	console.error("usage: bun src/cli.ts <in.html> <out.pptx>");
	process.exit(1);
}

const html = await Bun.file(inPath).text();
const deck = parse(html);
await emit(deck, outPath);
console.log(`wrote ${outPath}`);
