# deck-maker — internals

_Product rationale, the fidelity ladder, and the HTML conventions live in the
[README](../README.md). This doc is the engineering view: **components, dataflow, and
workflow.**_

## Components

| Path | Side | Responsibility |
|---|---|---|
| `skill/SKILL.md` | author | Teaches Claude Code the workflow + points at the contract |
| `skill/reference/conventions.md` | author | The HTML contract — single source of truth |
| `skill/reference/template.html` | author | Starter deck the agent copies |
| `src/convert.ts` | engine | CLI entry: `deck-maker convert deck.html out.pptx` |
| `src/parse.ts` | engine | HTML string → `Deck` (the IR) |
| `src/emit.ts` | engine | `Deck` → PptxGenJS calls → `.pptx` |
| `src/types.ts` | engine | The IR types shared by parse + emit |
| `setup.ts` | install | Links skill into `~/.claude/skills`, puts CLI on PATH |

**parse** and **emit** are decoupled by one artifact: the **IR** (`Deck`). parse never
touches PptxGenJS; emit never touches HTML. The IR is the contract between them.

## Dataflow

```
deck.html ──parse.ts──► Deck (IR) ──emit.ts──► out.pptx
 (string)              (in memory)            (PptxGenJS write)
```

The IR — a `.slide` box becomes a `Slide`, each positioned child an `Element`:

```ts
type Px  = number                       // CSS px in the 1280x720 canvas
type Box = { x: Px; y: Px; w: Px; h: Px }   // from inline left/top/width/height

type Deck  = { slides: Slide[] }
type Slide = { w: Px; h: Px; elements: Element[] }    // w,h = 1280,720

type Element =
  | { kind: 'text';   box: Box; runs: TextRun[]; align?: Align }
  | { kind: 'shape';  box: Box; shape: 'rect' | 'ellipse' | 'arrow'; fill?: Hex; stroke?: Hex }
  | { kind: 'table';  box: Box; rows: Cell[][] }
  | { kind: 'chart';  box: Box; spec: ChartSpec }     // parsed from data-chart JSON
  | { kind: 'svg';    box: Box; svg: string }
  | { kind: 'image';  box: Box; src: string }
  | { kind: 'raster'; box: Box; src: string }         // data-raster escape hatch

type TextRun  = { text: string; font?: string; size?: Px; bold?: boolean; color?: Hex }
type ChartSpec = { type: 'bar' | 'line' | 'pie'; categories: string[]; series: Series[] }
```

Geometry and convertible style are read from **inline `style` / `data-*`** only — no CSS
cascade, so no layout engine. Detection precedence (in `parse.ts`):
`data-raster` → `data-chart` → `<table>` → `<svg>`/`.svg` → `data-shape`/bare `<div>` →
`<img>` → text.

### emit mapping

`emit.ts` walks `Deck` and, per element `kind`, calls one PptxGenJS API. Positions convert
`px / 96 → inches` (PptxGenJS's unit; `1px = 1/96in = 9525 EMU`):

| IR kind | PptxGenJS call |
|---|---|
| text | `slide.addText(runs, box)` |
| shape | `slide.addShape(type, box)` |
| table | `slide.addTable(rows, box)` |
| chart | `slide.addChart(type, data, box)` — native, editable data |
| svg | `slide.addImage({ data: svg, ...box })` |
| image | `slide.addImage({ path: src, ...box })` |
| raster | `slide.addImage({ path: src, ...box })` |

## Workflow

**Setup (once):**
```
bun install
bun run setup      # symlink skill → ~/.claude/skills/deck-maker, link CLI onto PATH
```

**Author + review (loop, in any project):**
```
you: "make me a deck about X"
Claude Code: writes deck.html per skill/reference/conventions.md
you: bun ./index.html  → review in browser → "tweak this" → loop
```

**Convert (one-way, on approval):**
```
Claude Code: deck-maker convert deck.html out.pptx
             └─ parse.ts → Deck → emit.ts → PptxGenJS → out.pptx
```

## First milestone — walking skeleton

Thinnest slice through every component, one primitive only:

1. `examples/hello.html` — one `.slide`, one absolutely-positioned heading.
2. `parse.ts` — `.slide` → `Deck` with a single `text` element.
3. `emit.ts` — that element → `addText` at `px/96` inches → `out.pptx`.
4. `convert.ts` — wire the CLI.
5. Open in PowerPoint; confirm the text is native and editable.

Then extend `parse.ts` + the emit mapping down the fidelity ladder
(shape → table → chart → svg → image) and fill in `skill/`.
```
