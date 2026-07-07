# Studying the corpus — leverage a reference deck for everything

The user's vision: **they don't describe a style — they drop a nice `.pptx` into the
corpus, and you leverage it.** Color, fonts, type scale, corner treatment, layout. The
corpus is the brief; your job is to *study* it like a designer studying a reference,
then author in its spirit. Never ask the user to describe a style a reference already
answers.

## 1 · Survey (cheap — one command)

```
deck-maker archive --list
```

Every card carries `palette`, `fonts`, `slides`, `type`, `language`, `pptx`. Rank
candidates for the requested deck:

1. `type` matches the ask (qbr/pitch/sales/…) — authored cards have it; starters don't.
2. Palette/brand fit — if the user's company or topic implies colors, prefer the card
   whose palette matches.
3. Recency — newest first is the default tiebreak (the list is already sorted).

One clear winner → proceed. Several equally plausible → deep-inspect the top 2–3 and pick;
only if they *conflict* (e.g. a corporate-dashboard look vs. an editorial look, equally
matched) ask the user **one** short either/or question. An empty corpus → fall back to the
worked examples and the language catalogue as before.

## 2 · Study the winner (one command, read it like a designer)

```
deck-maker inspect <card.pptx>
```

Read the JSON top-down and extract **all** of it:

**`style.palette` → the color system.** Split it: near-black/near-white = surfaces and
text; one or two saturated hues = accents; soft tints = fills. Map onto the `--od-*`
slots (`--od-page-bg`, `--od-surface`, `--od-text`, `--od-muted`, `--od-accent`,
`--od-accent-2/3`, `--od-border`) per `themes.md`. Keep the reference's *relationships*
(which hue dominates, what's rare) — the accent budget still applies.

**`style.fonts` + `style.themeFonts` → the type system.** `fonts` is what's actually
used (ranked); `themeFonts` is the template's declared heading/body pair. Prefer actual
usage. If the faces aren't available to you (e.g. Montserrat, Poppins), substitute the
closest safe face (geometric sans → Arial; humanist → Verdana; serif → Georgia) and say
so; keep the *pair structure* (display face vs body face).

**`style.fontSizesPx` → the scale.** Read the spread: hero size, body size, caption
size. Reuse the reference's contrast ratio (hero ÷ body) on our own ramp — if the
reference peaks at 80px heroes over 16px body, your deck should too.

**`style.roundedShapes` + `backgrounds` → the language family.** Rounded cards + soft
tints → Aurora-family; hard corners + hairlines + one saturated accent → Swiss-family;
paper tints + serif display → Editorial-family. Pick the **closest language file** as
your grammar and rebind its `:root` slots to the reference palette. The language supplies
what a reference can't (chrome, rails, copy rules); the reference supplies the skin.

**`slides[].elements` → the layouts.** This is the deepest leverage. Each element has
`kind`, `x/y/w/h` (px on `canvas`), `text` preview, `fontSizePx`, `color`. Study 3–5
representative slides and reverse-engineer their grids:

- Repeated same-size shapes on one y-band = a **card row/grid** — note the card size,
  the x-step (gap = step − width), and the margin.
- A big text at top-left + wide text under it = the **title band** — note its y and size.
- A tall image column beside a text column = a **split layout** — note the split x.

Then rebuild each pattern with the nearest pool archetype (S01–S19), adapting the
measured geometry to our 1280×720 canvas and rails (content ends y 643; footer y ≥ 658).
If the reference canvas isn't 1280×720 (check `canvas`), scale positions proportionally.
You are transplanting the layout *system* — grid, density, whitespace — not tracing
every box.

**`slides[].texts` / `tables` / `charts` → the content shape.** What *kinds* of slides
does the reference deck have (KPI dashboard, feature grid, timeline…)? Mirror the mix
when it fits the requested deck's arc.

## 3 · Apply, then verify against the reference

- Author per the normal workflow (one slide at a time, render and look).
- **Two-surface rule still governs**: if the reference uses many background colors, pick
  its two strongest and normalize — you're distilling the reference, not copying its
  inconsistencies. Same for accent budget (≤ 3 accent hits per slide).
- At the critic gate, add one question to the rubric: *"would a stranger say this deck
  and the reference come from the same design family?"* Palette, type contrast, corner
  treatment, and density should all answer yes.

## Bans

Copying the reference's *content* (its words, data, images) — you leverage its **design**,
not its text · tracing every element box 1:1 instead of extracting the grid · blending
two references' styles into one deck (pick ONE winner — the two-surface and one-language
rules apply to references too) · asking the user to describe a style the corpus already
answers.
