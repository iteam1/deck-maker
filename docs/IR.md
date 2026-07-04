# The Deck IR

`Deck` is the intermediate representation between the two halves of the engine. `parse.ts`
**produces** it from HTML; `emit.ts` **consumes** it to write PPTX; `check.ts` **validates**
it. This file is the canonical contract — producer and consumer must stay in sync with it,
and with `src/types.ts` (the executable copy).

## Shape

```ts
type Deck  = { slides: Slide[] };
type Slide = { w: number; h: number; elements: Element[] };   // w,h = 1280, 720
type Box   = { x: number; y: number; w: number; h: number };  // px, top-left origin

type Element =
  | { kind: "text";   box; runs: TextRun[]; align?: "left" | "center" | "right" }
  | { kind: "shape";  box; shape: "rect" | "ellipse" | "arrow"; fill?; radius?; stroke? }
  | { kind: "table";  box; rows: string[][] }
  | { kind: "chart";  box; spec: ChartSpec }
  | { kind: "svg";    box; svg: string }
  | { kind: "image";  box; src: string };

type TextRun  = { text: string; size?: number; bold?; italic?; color?; font? };
type ChartSpec = { type: "bar"|"line"|"pie"|"doughnut"; categories: string[];
                   series: { name; values: number[] }[]; colors?: string[] };
```

## Contract rules

- **Coordinates.** All geometry is **px in the 1280×720 canvas**, top-left origin, absolute
  (not parent-relative). Read literally from inline `left/top/width/height`. This single
  decision is the #1 source of drift if it's ever ambiguous — it isn't: px, absolute, always.
- **Units at the boundary.** `emit.ts` converts px→inches (`px / 96`) for PptxGenJS position,
  and px→points (`px * 0.75`) for font sizes and stroke widths. The IR itself is px-only.
- **Typography is per-run and explicit.** Italic is modeled explicitly on `TextRun` — it is
  the classic silent regression (an `<em>` that never becomes `italic: true`). Same for
  `font`: the first `font-family` per run, so the emitter can set `fontFace` rather than
  letting PowerPoint fall back to Calibri silently.
- **Detection precedence** (in `parse.ts`, per element): `data-chart` → `<table>` → `<svg>`
  → `data-shape` → `<img>` → text. First match wins; text is the fallback.
- **Discriminated union.** Every `Element` carries `kind`; `emit.ts` and `check.ts` both
  `switch (el.kind)` exhaustively. Adding a rung to the fidelity ladder = add a union member
  → add a parse branch → add an emit case → add any check rule.
- **Colors** are CSS hex strings (`#rgb` or `#rrggbb`); `emit.ts` normalizes to 6-digit,
  no `#`. `var(--x)` is resolved in `parse.ts` against the first `:root {}` block before the
  IR is built, so the IR never contains `var()`.
- **Nothing nested.** Only direct element children of a `.slide` become `Element`s; a table's
  cells and an svg's internals belong to their owning element, not the slide.

## Pipeline

```
deck.html ──parse.ts──▶ Deck ──check.ts──▶ violations (gate)
                          └────emit.ts──▶ out.pptx
```

`check.ts` runs before `emit.ts` in the `convert` verb and blocks on any critical violation
(off-canvas, zero-size box, broken chart data, missing image). See `src/check.ts` for the
rail constants (`CONTENT_MAX_Y`, `FOOTER_TOP`) and the severity rubric.
