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
	italic?: boolean;
	color?: string;
	font?: string;
};

/** Data for a native, editable chart (parsed from a data-chart JSON attribute). */
export type ChartSpec = {
	type: "bar" | "line" | "pie" | "doughnut";
	categories: string[];
	series: { name: string; values: number[] }[];
	/** Optional series colors, CSS hex. */
	colors?: string[];
};

/**
 * Discriminated union keyed on `kind` — emit.ts switches on it.
 * One member per rung of the fidelity ladder.
 */
export type Element =
	| {
			kind: "text";
			box: Box;
			runs: TextRun[];
			align?: "left" | "center" | "right";
	  }
	| {
			kind: "shape";
			box: Box;
			shape: "rect" | "ellipse" | "arrow";
			fill?: string;
			/** Corner radius in px (from border-radius) — rect becomes a rounded rect. */
			radius?: number;
			/** Outline (from border: Wpx solid #color). */
			stroke?: { color: string; width: number };
	  }
	| { kind: "table"; box: Box; rows: string[][] }
	| { kind: "chart"; box: Box; spec: ChartSpec }
	| { kind: "svg"; box: Box; svg: string }
	| { kind: "image"; box: Box; src: string };
