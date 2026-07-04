import { expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { emit } from "./emit";
import { parse } from "./parse";

test("emit writes a strict, LibreOffice-openable OPC package", async () => {
	const deck = parse(
		`<section class="slide" style="width:1280px;height:720px;position:relative"><h1 style="position:absolute;left:0;top:0;width:100px;height:50px;font-size:20px;color:#111">Hi</h1></section>`,
	);
	const out = join(tmpdir(), "deck-maker-emit-test.pptx");

	await emit(deck, out);

	const bytes = new Uint8Array(await Bun.file(out).arrayBuffer());
	expect(bytes[0]).toBe(0x50); // 'P'  — a .pptx is a zip, which starts with
	expect(bytes[1]).toBe(0x4b); // 'K'    the "PK" magic bytes
	expect(bytes.length).toBeGreaterThan(1000);

	// OPC hygiene LibreOffice requires: no directory entries, Content_Types present.
	const zip = await JSZip.loadAsync(bytes);
	const names = Object.keys(zip.files);
	expect(names.some((n) => zip.files[n]?.dir)).toBe(false);
	expect(names).toContain("[Content_Types].xml");

	await unlink(out);
});
