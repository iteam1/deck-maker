// src/types.ts
// The IR: parse.ts produces a Deck, emit.ts consumes it.
// Shared contract — nothing here imports parse or emit.

/** Geometry every element has, in px (read from inline left/top/width/height). */
export type Box = {
	x: number;
	y: number;
	w: number;
	h: number;
};

/** The whole deck. */
export type Deck = {
	slides: Slide[];
};

/** One slide: its own size (will be 1280x720) plus its elements. */
export type Slide = {
	w: number;
	h: number;
	elements: Element[];
};

/** A styled span of text inside a text box. */
export type TextRun = {
	text: string;
	size?: number;
	bold?: boolean;
	color?: string;
};

/**
 * Discriminated union keyed on `kind` — emit.ts will switch on it.
 * Walking skeleton: only `text`. Add shape | table | chart | svg | image later.
 */
export type Element = { kind: "text"; box: Box; runs: TextRun[] };
