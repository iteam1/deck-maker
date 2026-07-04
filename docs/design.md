# deck-maker — design

_Last updated: 2026-07-04_

## What it is

deck-maker turns an AI-designed deck into a **real, fully-editable PowerPoint file** —
not a stack of rasterized images. Its one rule: **every element lands in the
highest-fidelity native PPTX object PowerPoint can manipulate.** Never flatten structure
into pixels.

It is **not a standalone app.** It is a capability you bolt onto **Claude Code**. The
human never touches the engine directly — Claude Code does, on the human's behalf. You
vibe-design in conversation; Claude writes the deck as HTML; on your approval it shells
out to deck-maker's engine to produce the `.pptx`.

## Goals / non-goals

**Goals**
- Native, editable PPTX output — text, tables, charts (with live data), SVG, autoshapes.
- HTML as the design + review medium; the agent's native design language.
- Conversion that is **deterministic and dependency-free** — no headless browser, no
  layout engine at convert time.
- First-class **Claude Code integration**: usable from any project after a one-time setup.

**Non-goals (v1)**
- Editing / round-tripping existing `.pptx` templates (PptxGenJS is write-only; revisit
  with python-pptx if ever needed).
- Pixel-perfect fidelity with PowerPoint's own text engine (see reflow gotcha).
- A GUI. The UI is the Claude Code conversation.

## The fidelity ladder

Every piece of content maps to the richest native object PowerPoint supports:

| Content | PPTX output | What the user can do |
|---|---|---|
| Text | Native text box | Edit, search, restyle — reflows on font change |
| Table | Native PPTX table | Edit cells, resize columns, restyle borders |
| Chart | Native chart **with embedded data** | Right-click → **Edit Data**, chart redraws |
| Diagram / icon / illustration | SVG vector | Infinite zoom; "Convert to Shape" → editable vectors |
| Boxes, arrows, callouts | DrawingML autoshapes | Move, recolor, reconnect |
| Photo | PNG/JPEG | Last resort — only for genuinely raster content |

Rasterization is an explicit per-element escape hatch for CSS with no PPTX equivalent
(blend modes, filters, clip-paths) — **never applied to a whole slide.**

## Architecture

### HTML in, native PPTX out

LLM agents are excellent at HTML/CSS and terrible at raw DrawingML. So HTML is the
**design medium**, never the output format.

### Decision: absolutely-positioned HTML, browser-free convert (path B)

We considered two ways to turn HTML into PPTX's required absolute `x/y/w/h` geometry:

- **Path A — free-form HTML + measure.** Agent writes natural flexbox/grid; a headless
  browser (Playwright) runs at convert time to resolve layout into coordinates. Max design
  freedom, but reintroduces a browser dependency.
- **Path B — absolutely-positioned HTML.** Every element carries explicit
  `left/top/width/height` in px inside a fixed slide-sized canvas. **The source already
  *is* the geometry**, so conversion is plain parsing — no browser, no layout engine.

**We chose path B.** Rationale:
- PPTX has no flexbox/flow; every shape needs absolute EMU coordinates regardless. Path B
  puts those coordinates where the agent (and the parser) can read them directly.
- Conversion becomes pure, deterministic TypeScript — no Chromium download, no
  Playwright-under-Bun friction, no flaky layout timing.
- It renders WYSIWYG in a normal browser for review (`bun ./index.html`).
- Trade-off accepted: the agent designs in absolute coordinates and owns text-fit (fixed
  boxes, no auto-wrap safety net). Agents handle absolute positioning well, and a slide is
  a fixed canvas anyway.

Path A remains a clean future upgrade if free-form layout freedom is ever needed — it
would add a browser **only** at convert, never during review.

### The canvas and the px→EMU constant

- Each slide is one `1280×720` `.slide` box (`overflow: hidden`) — the 16:9 slide at 96dpi.
- PPTX measures in EMU at **914400 EMU/inch**. At 96dpi, **1px = 9525 EMU**.
- So px→PPTX is a single multiply. `getBoundingClientRect`-style measurement is
  unnecessary because coordinates are declared in the source.

### Convert pipeline

```
   ┌──────────────────────────────────────────┐
   │  DESIGN + REVIEW — stays in HTML, fast    │
   └──────────────────────────────────────────┘

agent writes / edits deck.html       (absolute-positioned slides, one .slide box each)
        │
        ▼
bun ./index.html  →  browser         (one scrollable page, N slides at PPTX scale =
        │                             the surface the user reviews)
        ▼
   user reviews  ──"tweak this"──►  back to agent   (loop until happy)
        │
        │ "OK, ship it"
        ▼
━━━━━━━━━━━━━  approval gate · one-way from here  ━━━━━━━━━━━━━
        ▼
parser reads each .slide             (element → semantic primitive + its px box)
        │
        ▼
PptxGenJS emits native PPTX          (px × 9525 → EMU; one .slide → one slide)
        │
        ▼
     shipped .pptx
```

Three conventions make the convert step pure parsing:
- **Fixed canvas** — `1280×720` per `.slide`; `1px = 9525 EMU`.
- **Explicit geometry** — every element carries absolute `left/top/width/height`, so a
  parser reads coordinates straight from the source. No CSS cascade to resolve.
- **Same DOM for both** — the page the user reviews is exactly what gets parsed. What you
  approve is what converts, slide-for-slide.

## Claude Code integration

"Works with Claude Code" concretely means deck-maker ships as **two coupled artifacts** in
one repo:

1. **A Skill** (author side) — a `SKILL.md` (+ reference files) that teaches Claude Code
   *how to write conforming HTML* and *the review→approve→convert workflow*. This is the
   "deck-maker instruction" the agent follows.
2. **A convert CLI** (engine side) — Bun/TypeScript. Parses the HTML → PptxGenJS → `.pptx`.

### The HTML contract is the linchpin

The skill tells the agent what to write; the parser expects exactly that shape. They must
agree. So the **HTML conventions are a contract shared by both sides**, kept in one place
(`skill/reference/conventions.md`) that both the skill and the parser treat as the source
of truth. If they drift, the agent produces HTML the engine can't read.

### Repo layout

```
deck-maker/
  skill/
    SKILL.md              → installed to ~/.claude/skills/deck-maker (usable in every project)
    reference/
      conventions.md      → the HTML contract (single source of truth)
      template.html       → a starter deck the agent copies
  src/
    convert.ts            → CLI entry: deck.html → out.pptx
    parse.ts              → HTML → primitives (text | shape | table | chart | svg | image + px box)
    emit.ts               → primitives → PptxGenJS → .pptx
  examples/
    hello.html            → smallest conforming deck
  setup.ts                → `bun run setup`: link skill into ~/.claude/skills, put CLI on PATH
  package.json  tsconfig.json
```

### Install + invocation

- **Setup once:** `bun install && bun run setup` — symlinks the skill into
  `~/.claude/skills/deck-maker` and puts `deck-maker` on your PATH.
- **Global availability:** a personal skill in `~/.claude/skills/` is live in *every*
  directory, so you can vibe-design from anywhere.
- **Invoke:** say "make me a deck about X" (the skill's description auto-triggers) or type
  `/deck-maker`. On approval, Claude runs `deck-maker convert deck.html out.pptx`.

A full Claude Code **plugin** (shareable via a marketplace) is a later packaging step once
the engine is proven; start with clone + `bun run setup`.

## HTML contract (v1 — refine as the engine is built)

To stay browser-free, everything the parser needs must be readable **without running CSS**.
So geometry and convertible styling live in **inline `style`** and **`data-*`** attributes;
the parser reads them with a trivial inline-declaration parse, no cascade. A `<style>`
block, if present, is for review aesthetics only and must not carry convert-critical info.

- **Slide:** `<section class="slide" style="width:1280px;height:720px;position:relative">`.
  One per slide; stacked in the page for review.
- **Every convertible element** carries `position:absolute; left; top; width; height` in px.
- **Primitive detection (precedence order):**
  1. `data-raster` present → rasterize this element (escape hatch).
  2. `data-chart='{…}'` present → native chart (parse the JSON: `type`, `categories`, `series`).
  3. `<table>` → native PPTX table.
  4. `<svg>` / `<img src="*.svg">` → SVG vector.
  5. `data-shape="rect|ellipse|arrow|…"`, or a `<div>` with background/border and no text →
     autoshape.
  6. `<img>` (raster) → picture.
  7. text-bearing element → text box.
- **Text styling** read from inline: `font-family, font-size, font-weight, font-style,
  color, text-align, line-height`.
- **Units:** px only (→ ×9525 EMU). **Colors:** hex.

### Chart marking example

```html
<div class="chart" style="position:absolute;left:80px;top:160px;width:520px;height:360px"
     data-chart='{
       "type": "bar",
       "categories": ["Q1","Q2","Q3","Q4"],
       "series": [{"name":"Product A","values":[4.2,5.1,6.3,7.4]}]
     }'></div>
```

The agent embeds the **data**, not a drawn chart — the engine builds a native chart so the
user gets right-click → Edit Data.

## Known gotchas / risks

- **Text reflow** — PowerPoint wraps text with its own font metrics; a line that fits in
  Chrome can wrap differently in PPT. Mitigate: fixed boxes with slack, match fonts, and
  optionally render the finished PPTX back to images to confirm before shipping.
- **Unmappable CSS** — blend modes, filters, clip-paths have no PPTX equivalent; rasterize
  those elements individually via `data-raster`, keep everything else native.
- **Contract drift** — skill spec and parser must agree; keep `conventions.md` the single
  source both point at.
- **Verbose inline styles** — the price of a browser-free convert; acceptable and
  agent-friendly.

## Tech stack

- **Runtime:** Bun (1.3+).
- **Language:** TypeScript.
- **PPTX:** [PptxGenJS](https://github.com/gitbrent/PptxGenJS) — TS-native charts, tables,
  SVG out of the box; write-only.
- **HTML parsing:** a lightweight parser (e.g. Bun `HTMLRewriter` or `node-html-parser`) —
  tags, attributes, inline styles, text. No layout engine required.
- **Review:** `bun ./index.html` dev server + the user's normal browser.

python-pptx (Python) is the alternative only if the roadmap ever needs editing existing
decks or filling corporate `.pptx` templates.

## First milestone — walking skeleton

Thinnest end-to-end slice to prove the pipeline (path B, browser-free):

1. `examples/hello.html` — one `.slide`, one absolutely-positioned heading.
2. `parse.ts` — read the `.slide`, extract that one text primitive + its px box.
3. `emit.ts` — PptxGenJS text box at `px × 9525` EMU → `out.pptx`.
4. `convert.ts` — wire it: `deck-maker convert examples/hello.html out.pptx`.
5. Open the result in PowerPoint; confirm the text is native and editable.

Then grow the parser down the fidelity ladder (shapes → tables → charts → svg → image),
and flesh out `skill/` so the flow is agent-drivable end to end.
```
