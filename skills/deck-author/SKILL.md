---
name: deck-author
description: Design a slide deck as absolutely-positioned HTML in the deck-maker format (a fixed 1280x720 canvas), ready to convert into a native, editable PowerPoint. Use whenever the user asks to make, design, or edit a slide deck / PPTX / PowerPoint presentation.
---

# Authoring a deck-maker HTML deck

You write the deck as **one HTML file** (`deck.html`). Each slide is a fixed-size box; every
element is absolutely positioned so the geometry lives in the source. The user reviews it in
a browser; when they approve, the **deck-convert** skill turns it into a native `.pptx`.

## The canvas

- One `<section class="slide">` per slide. Give it exactly:
  `style="width: 1280px; height: 720px; position: relative;"`
- `1280x720` px is the 16:9 slide at 96dpi. `position: relative` makes it the positioning
  context so children's coordinates are measured from the slide's top-left.
- Stack multiple `.slide` sections in one `<body>` — they become slides in order.

## The rule: geometry is explicit and inline

Every element inside a slide MUST carry, in its inline `style`:
`position: absolute; left: …px; top: …px; width: …px; height: …px;`

The converter reads these directly — there is **no browser and no CSS engine** at convert
time. Do not put geometry in a `<style>` block or CSS classes; it won't be seen. Use **px**
for everything and hex (`#rrggbb`) for colors.

## Element types (the fidelity ladder)

Pick the richest type for each piece of content — never draw something you can mark up:

| Content | How to write it |
|---|---|
| Text | any text element (`<h1>`, `<p>`, `<div>`) with text inside; add `font-size`, `color`, `font-weight: bold` inline |
| Box / callout | `<div data-shape="rect">` (or `ellipse`, `arrow`) with a `background` color |
| Table | a real `<table>` with `<tr>`/`<td>` |
| Chart | `<div data-chart='{…}'>` — embed the **data**, not a drawing (see below) |
| Diagram / icon | inline `<svg>…</svg>` |
| Photo | `<img src="…">` |

Only top-level children of a `.slide` become elements; table cells and svg internals belong
to their parent.

## Charts: embed data, never draw

A hand-drawn chart converts to frozen vector art with no "Edit Data". Instead put the data
in a `data-chart` JSON attribute on an empty positioned `<div>`:

```html
<div data-chart='{
  "type": "bar",
  "categories": ["Q1","Q2","Q3","Q4"],
  "series": [{ "name": "Product A", "values": [4.2, 5.1, 6.3, 7.4] }]
}' style="position: absolute; left: 800px; top: 200px; width: 384px; height: 300px;"></div>
```

`type` is `bar`, `line`, or `pie`.

## Workflow

1. Write/modify `deck.html` following the rules above. Start from `examples/index.html` in
   the deck-maker repo as a template.
2. Let the user preview it in a browser (open the file, or `bun ./index.html` for a live
   server) and iterate until they approve.
3. On approval, hand off to the **deck-convert** skill to produce the `.pptx`.

## Gotchas

- Keep every box inside `1280x720`; content is clipped at the slide edge.
- PowerPoint re-wraps text with its own font metrics — leave slack in text boxes and match
  fonts so a line that fits in the browser also fits in PPT.
- Effects with no PPTX equivalent (blend modes, filters, clip-paths) don't convert; avoid
  relying on them.
