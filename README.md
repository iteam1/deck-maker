# deck-maker

AI vibe-designs the deck. The output is a **real, editable PowerPoint file** — not a stack
of images. Every element lands in the highest-fidelity native PPTX object PowerPoint can
manipulate; never flatten structure into pixels.

Built with **Bun + TypeScript**, driven by **Claude Code**.

## The fidelity ladder

| Content | PPTX output | What the user can do |
|---|---|---|
| Text | Native text box | Edit, search, restyle — reflows on font change |
| Table | Native PPTX table | Edit cells, resize columns, restyle borders |
| Chart | Native chart **with embedded data** | Right-click → **Edit Data**, chart redraws |
| Diagram / icon / illustration | SVG vector | Infinite zoom; "Convert to Shape" → editable vectors |
| Boxes, arrows, callouts | DrawingML autoshapes | Move, recolor, reconnect |
| Photo | PNG/JPEG | Last resort — only for genuinely raster content |

Rasterization is a per-element escape hatch for CSS with no PPTX equivalent (blend modes,
filters, clip-paths) — never a whole slide.

## How it works

HTML is the design medium — agents are fluent in HTML/CSS and hopeless at raw DrawingML.
Slides are **absolutely-positioned HTML on a fixed 1280×720 canvas** (`1px = 9525 EMU`), so
the source already holds every coordinate and converting to PPTX is plain parsing — no
headless browser, no layout engine. You iterate in HTML; convert once, on approval.

## Using it with Claude Code

1. clone + `bun install`
2. copy `skills/` into the folder you're working in — Claude Code loads the skills there
3. ask Claude for a deck: it writes `deck.html`, you review it in the browser, and on your
   OK the CLI emits `deck.pptx` — both land in that folder

## Charts embed data, not pictures

A *drawn* chart converts to frozen vector art — no Edit Data. Instead the agent puts the
**data** on the element and the engine builds a native chart:

```html
<div class="chart" data-chart='{
  "type": "bar",
  "categories": ["Q1", "Q2", "Q3", "Q4"],
  "series": [{"name": "Product A", "values": [4.2, 5.1, 6.3, 7.4]}]
}'></div>
```

## Gotchas

- **Text reflow** — PowerPoint wraps with its own font metrics, so a line that fits in
  Chrome can wrap in PPT. Use fixed boxes with slack and match fonts.
- **Unmappable CSS** — blend modes, filters, clip-paths: rasterize those elements
  individually, keep everything else native.

## Output library

**[PptxGenJS](https://github.com/gitbrent/PptxGenJS)** — TypeScript-native; charts, tables,
and SVG built in. [python-pptx](https://python-pptx.readthedocs.io/en/latest/) is the Python
alternative if editing existing decks or corporate templates ever matters.
