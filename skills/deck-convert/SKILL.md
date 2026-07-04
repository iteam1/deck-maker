---
name: deck-convert
description: Convert a deck-maker HTML file into a native, editable .pptx using the deck-maker engine CLI. Use after a deck.html has been authored (see the deck-author skill) and the user approves it.
triggers:
  - "convert to pptx"
  - "export deck"
  - "make the powerpoint"
  - "html to pptx"
  - "check deck"
od:
  mode: utility
  category: slides
  scenario: engineering
  design_system:
    requires: false
  capabilities_required:
    - file_write
    - subprocess
---

# Converting a deck to PPTX

The deck-maker engine parses absolutely-positioned HTML (`deck.html`) into an intermediate
representation and emits a native `.pptx` with PptxGenJS — no browser, no rasterization. Text
stays editable, tables stay tables, charts keep their data.

## Prerequisites

- The deck-maker repo is cloned somewhere and `bun install` has been run in it.
- A `deck.html` exists that follows the **deck-author** contract (fixed `1280x720` slides,
  everything absolutely positioned inline).

## Check, then convert

**Check** validates geometry without writing anything (exit 1 on critical issues):

```
bun <path-to-deck-maker>/src/cli.ts check deck.html
```

It enforces: boxes on-canvas and non-zero, content clear of the footer rail (content
must end by y 643; footer chrome exempt at y ≥ 658), chart series/category counts
matching, image files present — and flags text likely to overflow its box. Severity:

- 🔴 critical — off-canvas, zero-size box, broken chart data, missing image. Blocks convert.
- 🟠 high — content crosses the footer rail, empty slide. Fix unless intentional.
- 🟡 medium — text likely to overflow its box in PowerPoint. Review.

**Convert** runs the same check first and refuses on critical issues:

```
bun <path-to-deck-maker>/src/cli.ts convert deck.html deck.pptx
```

(From inside the deck-maker repo: `bun run check …` / `bun run convert …`.)

On success it prints `wrote deck.pptx`. Open that file in PowerPoint / Keynote / Google
Slides — every element is native and editable.

When reporting check results to the user, use a per-slide list with the severity icons
and **name the systemic cause** — one rule usually produces several violations (e.g.
"three slides cross the rail because body blocks start at y 500"), and fixing the rule
beats nudging slides one by one.

## Verify (recommended)

The HTML preview is a design proxy, not a fidelity guarantee — PowerPoint re-wraps text with
its own font metrics. After converting, confirm the `.pptx` looks right (open it, or render
it back to images) before treating it as final.

## Troubleshooting

- **`usage: …` / exits 1** — wrong arguments: `convert` needs input `.html` and output
  `.pptx`; `check` needs just the input. A non-zero exit with 🔴 lines means the check
  gate refused — fix the listed issues.
- **Text/positions look off** — check the element's inline `left/top/width/height`; the engine
  reads those literally (`1px = 1/96in`).
- **A chart came out as a static picture** — it was drawn in HTML instead of marked with a
  `data-chart` attribute. Fix it in `deck.html` (see the deck-author skill) and re-convert.
- **Missing element** — only *direct* children of a `.slide` are converted; make sure the
  element isn't nested inside another element.

## Bundled resources

The engine lives in the deck-maker repo (run `bun install` once):

- `src/cli.ts` — the CLI entry: `check <in.html>` and `convert <in.html> <out.pptx>`.
- `src/parse.ts` — HTML → `Deck` IR (inline styles, `var(--x)` resolution, rich text runs).
- `src/check.ts` — the geometry + copy-typography gate (rails, chart sanity, quotes/ellipsis).
- `src/emit.ts` — `Deck` → PptxGenJS → `.pptx`.
- `docs/IR.md` — the `Deck` intermediate-representation contract shared by parse/check/emit.

Authoring rules and design guidance live in the **deck-author** skill's `references/`.
