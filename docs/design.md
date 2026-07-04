# deck-maker — internals

_Pitch, fidelity ladder, and HTML conventions live in the [README](../README.md). This is
the engineering view: repo layout, dataflow, workflow._

## Repo layout

```
skills/
  author/      skill — how to write deck.html in the required format
  engine/      skill — how to run the CLI to convert it
src/
  cli.ts       drives the engine (convert, ...)
  parse.ts     HTML → Deck (the IR)
  emit.ts      Deck → PptxGenJS → .pptx
```

- **engine** = `parse.ts` + `emit.ts`, decoupled by the **IR** (`Deck`): parse never
  touches PptxGenJS, emit never touches HTML.
- **cli** drives the engine.
- **skills** teach Claude Code to author conforming HTML (`author`) and run the CLI
  (`engine`).

## Dataflow

```mermaid
flowchart LR
    H["deck.html<br/>(string)"] -->|parse.ts| IR["Deck — the IR<br/>(in memory)"]
    IR -->|emit.ts| O["deck.pptx<br/>(PptxGenJS write)"]
```

The IR — a `.slide` box → `Slide`, each positioned child → `Element`:

```ts
type Box = { x: number; y: number; w: number; h: number }   // px, from inline left/top/width/height

type Deck  = { slides: Slide[] }
type Slide = { w: number; h: number; elements: Element[] }  // 1280 x 720

type Element =
  | { kind: 'text';   box: Box; runs: TextRun[] }
  | { kind: 'shape';  box: Box; shape: 'rect' | 'ellipse' | 'arrow' }
  | { kind: 'table';  box: Box; rows: string[][] }
  | { kind: 'chart';  box: Box; spec: ChartSpec }        // from data-chart JSON
  | { kind: 'svg';    box: Box; svg: string }
  | { kind: 'image';  box: Box; src: string }

type TextRun  = { text: string; size?: number; bold?: boolean; color?: string }
type ChartSpec = { type: 'bar' | 'line' | 'pie'; categories: string[]; series: { name: string; values: number[] }[] }
```

Geometry and style are read from inline `style` / `data-*` only — no CSS cascade, so no
layout engine. `emit.ts` converts `px / 96 → inches` for PptxGenJS.

## Workflow

```mermaid
flowchart TD
    C1["clone + bun install"] --> C2["copy skills/ into your working folder"]
    C2 --> W["Claude writes deck.html<br/>(author skill)"]
    W --> R{"review in browser"}
    R -->|tweak| W
    R -->|OK| CV["CLI converts deck.html → deck.pptx<br/>(engine skill)"]
    CV --> O(["deck.pptx — same folder"])
```
