---
name: deck-inspect
description: Read an EXISTING .pptx file's content (text, tables, chart data, images) and design style (color palette, fonts, type scale, rounded-vs-square corners). Use when the user hands you a PowerPoint file — not one deck-maker authored — and wants it read, summarized, reused, or matched. Not for authoring or converting a new deck (see deck-author / deck-convert).
triggers:
  - "read this pptx"
  - "what's in this deck"
  - "inspect this pptx"
  - "analyze this deck"
  - "what colors does this deck use"
  - "match this deck's style"
  - "corporate template"
  - "existing powerpoint"
od:
  mode: utility
  category: slides
  scenario: engineering
  design_system:
    requires: false
  capabilities_required:
    - subprocess
---

# Reading an existing .pptx

`deck-maker`'s engine can read a `.pptx` it did **not** author — any deck, from anywhere
— and extract its content and design style as JSON. This is a **different direction**
from the rest of deck-maker: `deck-author`/`deck-convert` write a *new* deck
(HTML → PPTX); this skill reads an *existing* one (PPTX → JSON). It is one-way and
read-only — there is no `pptx → HTML` reconstruction (see `docs/overview.md`).

## When to use this vs. the other skills

| The user has… | Use |
|---|---|
| An idea for a new deck | **deck-author** (writes `deck.html`) |
| An approved `deck.html` | **deck-convert** (→ `.pptx`) |
| **An existing `.pptx`** they want read, summarized, or matched | **this skill** |

## Prerequisites

The deck-maker repo is cloned somewhere and `bun install` has been run in it (same
engine deck-convert uses).

## Run it

```
bun <path-to-deck-maker>/src/cli.ts inspect existing-deck.pptx
```

Prints JSON: `{ slides: [...], style: {...} }`.

- **`slides[]`** — per slide: `texts` (plain paragraph text), `tables` (rows of cells),
  `charts` (type + categories + series values — reads the real embedded chart data, not
  a picture of a chart), `images` (media file paths inside the package), and a per-slide
  `style` (see below, same shape as the deck-level rollup).
- **`style`** — the deck-level design rollup:
  - `palette` — colors ranked by how many slides they appear on. Resolves PowerPoint
    theme-color references (`accent1`, `tx1`, `bg2`, …) to real hex via the theme file,
    not just literal fills.
  - `fonts` — font faces ranked by frequency.
  - `fontSizesPx` — every distinct text size used, sorted descending. The spread tells
    you the type contrast (a wide spread like `12 → 220` reads as "designed"; a narrow
    one like `14 → 24` reads as generic — see the deck-author playbook's type-scale rule).
  - `roundedShapes` — true if any shape uses a rounded-rect preset. The single best
    signal for which family a deck belongs to (Swiss-like languages ban rounding;
    card-based languages lean on it).
  - `backgrounds` — distinct full-slide surface colors, in first-appearance order
    (usually the cover/divider/closing accent).

## Using this to match an existing deck's style

The common reason to inspect a deck is to **author a new one that looks like it** —
matching a client's template, a previous quarter's deck, or a brand's existing
PowerPoint. Workflow:

1. Run `inspect` on the existing `.pptx`; read its `style`.
2. Compare `palette`/`roundedShapes`/`fonts` against the **deck-author** skill's
   [`references/languages/`](../deck-author/references/languages/) — if it's close to an
   existing language (e.g. `roundedShapes: false` + one saturated accent → Swiss-like),
   use that language with the extracted palette swapped in via its `--od-*` slots.
3. If it doesn't match any existing language, derive a new `:root` theme block from
   `style.palette`/`style.fonts`/`style.roundedShapes` following
   [`references/themes.md`](../deck-author/references/themes.md)'s slot contract, and
   hand off to **deck-author** to build the new deck against it.

## Limitations (be upfront about these)

- **Content only, not layout.** Positions aren't exposed per element (only used
  internally to detect the full-slide background shape) — you get *what* the deck says
  and what it's styled with, not *where* things sit. This is not enough to recreate the
  deck's exact slide layouts.
- **Per-slide backgrounds only.** A background inherited from a slide master/layout
  (rather than an explicit full-slide shape on the slide itself) won't be detected —
  `style.backgrounds` can under-report on decks that rely on master-level theming.
- **Chart categories can come back empty** if the source used a chart-data reference
  style this engine doesn't recognize yet — treat an empty `categories`/`series.values`
  as "couldn't read this chart," not "the chart is empty."

## Bundled resources

- `src/inspect.ts` — the extraction engine (shared install with **deck-convert**; no
  separate setup). Theme-color resolution, shape/text style walk, chart XML parsing.
- `src/inspect.test.ts` — round-trip tests (content + style) if you want to see the
  exact JSON shapes exercised.
