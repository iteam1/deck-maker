# deck-maker

AI vibe-designs the deck. The output is a **real PowerPoint file** — not a stack of images.

Tools like NotebookLM generate slides as rasterized pictures: they blur when you zoom,
and nothing can be edited afterwards. deck-maker's rule is the opposite: **every element
lands in the highest-fidelity native PPTX object PowerPoint can manipulate.** Never
flatten structure into pixels.

## The fidelity ladder

| Content | PPTX output | What the user can do |
|---|---|---|
| Text | Native text box | Edit, search, restyle — reflows on font change |
| Table | Native PPTX table | Edit cells, resize columns, restyle borders — never an image of a table |
| Chart | Native chart object **with embedded data** | Right-click → **Edit Data**, chart redraws |
| Diagram / icon / illustration | SVG vector | Infinite zoom; "Convert to Shape" explodes it into editable vectors |
| Boxes, arrows, callouts | DrawingML autoshapes | Move, recolor, reconnect |
| Photo | PNG/JPEG | Last resort — only for content that is genuinely raster |

Rasterization is an explicit escape hatch for the few CSS effects with no PPTX
equivalent (blend modes, filters, clip-paths) — applied **per element**, never to a
whole slide.

## Architecture: HTML in, native PPTX out

LLM agents are excellent at HTML/CSS — it's their native design language — and terrible
at raw DrawingML. So HTML is the **design medium**, but never the output format:

```
agent writes slide HTML/CSS          (full design freedom — the "vibe" step)
        │
        ▼
headless browser renders it          (Playwright/Puppeteer — to MEASURE, not screenshot:
        │                             resolves flexbox/wrapping into absolute geometry)
        ▼
extractor walks the DOM              (each element → semantic primitive:
        │                             text | shape | table | chart | svg | image)
        ▼
renderer emits native PPTX           (PptxGenJS or python-pptx)
```

### Charts need semantic marking

If the agent *draws* a chart in HTML/SVG, a faithful converter produces frozen vector
art — no Edit Data. Instead the agent embeds the **data** on the element and the
renderer builds a native chart from it:

```html
<div class="chart-box" data-chart='{
  "type": "bar",
  "categories": ["Q1", "Q2", "Q3", "Q4"],
  "series": [{"name": "Product A", "values": [4.2, 5.1, 6.3, 7.4]}]
}'></div>
```

### Known gotchas

- **Text reflow** — PowerPoint wraps text with its own font metrics; a line that fits in
  Chrome can wrap differently in PPT. Leave slack in text boxes and match fonts.
- **Unmappable CSS** — blend modes, filters, clip-paths: rasterize those elements
  individually, keep everything else native.

## Output library: PptxGenJS vs python-pptx

Both produce fully native, editable PPTX. The differences that matter:

| | [PptxGenJS](https://github.com/gitbrent/PptxGenJS) | [python-pptx](https://python-pptx.readthedocs.io/en/latest/) |
|---|---|---|
| Language / runtime | JS — Node **and** browser | Python |
| Edit existing .pptx | ✗ write-only | ✓ open, modify, save |
| SVG images | ✓ native | ✗ needs XML injection (~20 lines) |
| Charts | ✓ native, combo charts built in | ✓ native, broad types; combo = XML surgery |
| Tables | ✓ + auto-paging, `tableToSlides()` (HTML table → slides) | ✓ solid API, no HTML awareness |
| Corporate templates | code-defined masters only | ✓ fill placeholders in a real .pptx template |
| Escape hatch | closed API | ✓ raw lxml XML tree — anything OOXML allows |

**Recommendation:** PptxGenJS for greenfield generation (same language as the browser
measurement step, SVG out of the box). python-pptx when the roadmap includes editing
existing decks or filling corporate templates — PptxGenJS cannot open a .pptx at all.

## Related to

https://python-pptx.readthedocs.io/en/latest/

https://github.com/gitbrent/PptxGenJS
