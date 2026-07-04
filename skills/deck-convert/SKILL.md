---
name: deck-convert
description: Convert a deck-maker HTML file into a native, editable .pptx using the deck-maker engine CLI. Use after a deck.html has been authored (see the deck-author skill) and the user approves it.
---

# Converting a deck to PPTX

The deck-maker engine parses absolutely-positioned HTML (`deck.html`) into an intermediate
representation and emits a native `.pptx` with PptxGenJS — no browser, no rasterization. Text
stays editable, tables stay tables, charts keep their data.

## Prerequisites

- The deck-maker repo is cloned somewhere and `bun install` has been run in it.
- A `deck.html` exists that follows the **deck-author** contract (fixed `1280x720` slides,
  everything absolutely positioned inline).

## Convert

Run the CLI from the deck-maker checkout, passing the input HTML and the output path:

```
bun <path-to-deck-maker>/src/cli.ts deck.html deck.pptx
```

or, from inside the deck-maker repo:

```
bun run convert deck.html deck.pptx
```

On success it prints `wrote deck.pptx`. Open that file in PowerPoint / Keynote / Google
Slides — every element is native and editable.

## Verify (recommended)

The HTML preview is a design proxy, not a fidelity guarantee — PowerPoint re-wraps text with
its own font metrics. After converting, confirm the `.pptx` looks right (open it, or render
it back to images) before treating it as final.

## Troubleshooting

- **`usage: …` / exits 1** — you passed fewer than two arguments; give both the input `.html`
  and the output `.pptx`.
- **Text/positions look off** — check the element's inline `left/top/width/height`; the engine
  reads those literally (`1px = 1/96in`).
- **A chart came out as a static picture** — it was drawn in HTML instead of marked with a
  `data-chart` attribute. Fix it in `deck.html` (see the deck-author skill) and re-convert.
- **Missing element** — only *direct* children of a `.slide` are converted; make sure the
  element isn't nested inside another element.
