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

/** One slide: its own size (1280x720) plus its elements. */
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

/** Data for a native, editable chart (parsed from a data-chart JSON attribute). */
export type ChartSpec = {
	type: "bar" | "line" | "pie";
	categories: string[];
	series: { name: string; values: number[] }[];
};

/**
 * Discriminated union keyed on `kind` — emit.ts switches on it.
 * One member per rung of the fidelity ladder.
 */
export type Element =
	| { kind: "text"; box: Box; runs: TextRun[] }
	| {
			kind: "shape";
			box: Box;
			shape: "rect" | "ellipse" | "arrow";
			fill?: string;
	  }
	| { kind: "table"; box: Box; rows: string[][] }
	| { kind: "chart"; box: Box; spec: ChartSpec }
	| { kind: "svg"; box: Box; svg: string }
	| { kind: "image"; box: Box; src: string };
