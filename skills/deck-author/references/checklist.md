# Pre-handoff checklist

Run through this before telling the user the deck is ready to review, and again before
handing off to **deck-convert**. Don't skip items — each one is a regression that has
actually happened.

## Contract

- [ ] Every slide is `<section class="slide">` at exactly `1280×720`, `position: relative`,
      `overflow: hidden`.
- [ ] Every element inside a slide has inline `position: absolute` **and all four** of
      `left / top / width / height` in px.
- [ ] Geometry/styling only in inline styles — nothing convert-critical in `<style>` or
      classes.
- [ ] Only direct children of `.slide` are meant to convert; no content accidentally
      nested inside another element.

## Truthful preview

- [ ] The margin reset is present:
      `.slide p, .slide h1, .slide h2 { margin: 0; line-height: 1.25; }`
- [ ] The chart preview script is present (charts render in the browser, not empty boxes).
- [ ] Every `data-shape="ellipse"` has `border-radius: 50%`.

## Design

- [ ] One palette, used consistently; an accent appears ≤ 3× per slide; accents rotated in
      sequence order. No pure `#000`/`#fff`.
- [ ] **Two surfaces only**: cover, dividers, and closing share the SAME full-bleed
      surface color — no third background anywhere in the deck.
- [ ] Every slide is composed from the layout pool (S01–S14), not improvised.
- [ ] Every slide has the chrome header + footer bands and **one** focal point (≤ 4 text
      roles: eyebrow, title, body, one caption). No two equal-weight text blocks.
- [ ] Uppercase tracked eyebrow above headlines; extreme type contrast (hero ~8–10× labels).
- [ ] Dark slides have a full-bleed background rect (+ SVG art); light slides have the
      light bg rect with white cards. Hairlines (not shadows) as separators.
- [ ] Footer (copyright + page `N / N`) on every content slide, at y ≥ 658.
- [ ] Text boxes have ~20% height slack; body measure ≤ ~65 chars/line.

## Content integrity

- [ ] **All numbers are the user's** — no invented chart values, KPIs, table figures, or
      fake-precise stats (`99.99%`). Honest `—` for unknowns; bar heights/fills to scale.
- [ ] Charts are `data-chart` JSON with palette `colors` — nothing drawn as fake chart art.
      Chart titles state the conclusion, not "X by Y".
- [ ] No italic on CJK/Arabic/Hebrew/Thai text.
- [ ] Titles ≤ 8 words; supporting lines ≤ 25. No filler verbs (Elevate/Seamless/Unleash/…).
- [ ] Real ellipsis `…` and curly quotes `“ ”` (not `...`/`"`). `check` flags these.
- [ ] Photos: box aspect matches the image file's aspect; `src` paths relative to the
      HTML file and the files exist.

## The gate

- [ ] **Every slide was rendered and looked at** (screenshot / browser), not judged from
      HTML — overflow, broken images, and misalignment only show in pixels.
- [ ] `deck-maker check deck.html` (or `bun <deck-maker>/src/cli.ts check deck.html`)
      reports **0 critical** issues. Fix 🟠 rail crossings too unless intentional.
- [ ] The converted `.pptx` was opened / rendered back to images and looks right.
