---
name: deck-author
description: Design a slide deck as absolutely-positioned HTML in the deck-maker format (a fixed 1280x720 canvas), ready to convert into a native, editable PowerPoint. Use whenever the user asks to make, design, or edit a slide deck / PPTX / PowerPoint presentation.
triggers:
  - "deck"
  - "slide deck"
  - "pptx"
  - "powerpoint"
  - "presentation"
  - "make slides"
od:
  mode: deck
  category: slides
  surface: web
  scenario: marketing
  aspect_hint: "16:9 (1280×720)"
  preview:
    type: html
    entry: deck.html
  design_system:
    requires: false
  outputs:
    primary: deck.html
  example_prompt: "Author a 1280×720 HTML deck about <topic> in the deck-maker format, then convert it to an editable .pptx."
---

# Authoring a deck-maker HTML deck

You write the deck as **one HTML file** (`deck.html`). Each slide is a fixed-size box;
every element is absolutely positioned so the geometry lives in the source. The user
reviews it in a browser; when they approve, the **deck-convert** skill turns it into a
native `.pptx`.

## Start here

0. **Check the archive first.** Run `deck-maker archive --list` — it prints the user's
   corpus (JSON, newest first): past decks they kept *and* any bare `.pptx` starters they
   dropped in. If a card matches what's being asked for (by `type`, brand, or `palette`),
   `deck-maker inspect` that card's `pptx` and **seed from it** — reuse its palette/fonts
   and pick the closest language — instead of the generic example. (Starter cards have
   blank `type`/`language`; judge them by `palette`/`fonts` and inspect to confirm.) Empty
   list or no match? Proceed as below. (Saving to this corpus is the **deck-archive** skill.)
1. **Read [`references/design.md`](references/design.md)** — the design playbook: the
   three-band frame, palette + type scale + tracking, the locked 19-archetype layout pool + deck arcs
   (S01–S19), iron laws, copy rules, and which visual devices survive HTML→PPTX. Decks
   designed without it look generated.
2. **Pick the deck arc** for the deck type (QBR, investor pitch, sales, talk, status,
   consulting) from the playbook's "Deck arcs" section — the arc orders the archetypes
   and guarantees an ask/decision beat before the close.
3. **Pick ONE design language** from [`references/languages/`](references/languages/) by
   the deck's purpose — Swiss IKB (facts/analysis), Editorial E-Ink (narrative), or
   Aurora Cards (friendly corporate) — and follow only it. Never blend languages.
   `references/themes.md` has extra palettes for brand-matching.
4. **Copy the worked example that matches your language and arc** as the starting file —
   [`examples/index.html`](../../examples/index.html) (Swiss IKB, report/QBR arc,
   13 slides) or [`examples/pitch.html`](../../examples/pitch.html) (Aurora Cards,
   investor-pitch arc, 7 slides). No example in your language yet (e.g. Editorial)?
   Start from the structurally closest one and re-skin it strictly per your language
   file — the chrome pattern, margin reset, and chart-preview script carry over
   unchanged; only palette, fonts, and devices change. Replace all content with yours.

## The contract

- One `<section class="slide">` per slide, exactly
  `style="width: 1280px; height: 720px; position: relative; overflow: hidden;"`.
  Stack sections in one `<body>`; they become slides in order.
- Every element inside a slide carries inline
  `position: absolute; left/top/width/height` in **px**. The converter reads inline
  styles only — geometry in `<style>` blocks or classes is invisible to it.
- Colors are hex. Fonts via `font-family` (first family wins). DOM order = z-order.
- Only direct children of a `.slide` become PPTX objects; nested markup (table cells,
  svg internals, `<b>`/`<i>` runs) belongs to its parent element.

## Element types (the fidelity ladder)

Pick the richest type for each piece of content — never draw what you can mark up:

| Content | How to write it |
|---|---|
| Text | `<h1>`/`<h2>`/`<p>`/`<div>` with inline `font-size`, `color`, `font-weight`, `font-family`, `text-align`. Rich runs inside: `<b>`/`<strong>`, `<i>`/`<em>`, styled `<span>`s. Entities (`&copy;`, `&mdash;`) decode |
| Box / card / callout | `<div data-shape="rect">` with `background`; `border-radius: Npx` → rounded card, `border: 1px solid #hex` → outline |
| Dot / circle | `<div data-shape="ellipse">` (+ `border-radius: 50%` so the preview matches) |
| Arrow | `<div data-shape="arrow">` |
| Table | a real `<table>` with `<th>`/`<td>` |
| Chart | `<div data-chart='{...}'>` — embed the **data**, see below |
| Diagram / icon / gradient art | inline `<svg>` (converts as a vector; the only way to get gradients) |
| Photo | `<img src="...">` — path resolves relative to the HTML file; match the box to the image's aspect ratio |

## Charts: embed data, never draw

```html
<div data-chart='{
  "type": "bar",
  "categories": ["Q1","Q2","Q3","Q4"],
  "series": [{ "name": "Revenue", "values": [4.2, 5.1, 6.3, 7.4] }],
  "colors": ["#4f46e5", "#c7d2fe"]
}' style="position: absolute; left: 88px; top: 392px; width: 688px; height: 246px;"></div>
```

`type`: `bar`, `line`, `area`, `pie`, `doughnut`, `scatter`, `radar`. Always set
`colors` from the palette. The converter builds a native chart — the user gets
right-click → Edit Data.

## Workflow — build slide by slide, and SEE each one

**Never author the whole deck blind from HTML, and never judge a slide by reading its
markup.** The markup hides everything that actually matters — text overflow, wrong
positions, broken images, off-palette color, distorted photos. Only the rendered pixels
tell the truth. Build and *look* one slide at a time:

1. Start from a copy of the matching worked example (see "Start here"); write (or edit)
   **one** slide.
2. **Render it and actually look at it.** Serve the file — `bun ./index.html` (or
   `python3 -m http.server -d <dir>`) — and screenshot that slide, e.g. with Playwright:
   `page.locator("section.slide:nth-of-type(N)").screenshot(...)`, then view the image.
   Opening it in a browser works too. Do not proceed on the HTML alone.
3. Fix what you *see*, re-render, and only move to the next slide once this one reads as
   designed (chrome, one focal point, aligned to the grid, on-palette).
4. When all slides look right: run the geometry gate
   `bun <deck-maker>/src/cli.ts check deck.html` (fix to 0 critical) and walk
   [`references/checklist.md`](references/checklist.md).
5. **Critic gate** — spawn an independent subagent with the persona + rubric in
   [`references/critic.md`](references/critic.md), give it the slide screenshots and the
   deck's language file, and fix every 🔴/🟠 it reports. Ship only at **≥ 8/10 with no
   🔴/🟠**. The author never grades its own deck.
6. Hand off to **deck-convert** to produce the `.pptx` — then **look at the `.pptx` too**
   (render it back to images or open it). The browser is a design proxy; the converted
   file is the artifact, and it can differ (fonts, wrapping). Confirm before shipping.
7. Once the user keeps it, **archive it** (the **deck-archive** skill: `deck-maker archive
   deck.html deck.pptx --type … --language … --note …`) so the next deck can reference it
   at step 0. Closes the loop.

## Rules that keep the preview truthful

The converter ignores `<style>`/`<script>`; they exist so the browser shows what the
PPTX will contain. Both worked examples already include all three:

1. The margin reset (`.slide p, h1, h2 { margin: 0; line-height: 1.25 }`) — without it
   browser text sits ~16px lower than the converter places it.
2. The chart preview script — `data-chart` divs are empty boxes in a browser without it.
3. `border-radius: 50%` on ellipses.

And the converse — never let the design depend on CSS the converter drops: gradients on
shapes (solid fills only — use SVG), `box-shadow`, `opacity`. Keep
~20% slack in text boxes (PowerPoint wraps sooner than Chrome), and keep every box
inside 1280x720.

## Bundled resources

- [`references/design.md`](references/design.md) — the full playbook. **Read first.**
- [`examples/`](../../examples/) — worked examples, one per language+arc so far; **copy
  the one matching your language/arc to begin** (re-skin the closest if none matches):
  - [`index.html`](../../examples/index.html) — Swiss IKB, report/QBR arc, 13 slides
    across the archetype pool.
  - [`pitch.html`](../../examples/pitch.html) — Aurora Cards, investor-pitch arc,
    7 slides (2×2 matrix, team grid, pricing, logo wall, the ask).
- [`references/languages/`](references/languages/) — the design-language catalogue
  (swiss-ikb, editorial-ink, aurora-cards). **Pick exactly one per deck.**
- [`references/themes.md`](references/themes.md) — named palettes + the `--od-*` theme-slot
  contract. Read when matching a brand.
- [`references/checklist.md`](references/checklist.md) — pre-handoff gate. Run before
  declaring the deck ready and before converting.
- [`references/critic.md`](references/critic.md) — the critic-subagent persona + rubric.
  Run the critic gate on rendered screenshots before handing the deck to the user.
- **deck-archive** skill — `deck-maker archive --list` to find a past deck to seed from
  (step 0), and `deck-maker archive …` to save a shipped deck to the corpus (step 7).
