# Deck design playbook

What separates a real deck from boxes of text: **layering, a strict palette, extreme type
contrast, one focal point per slide, and a locked layout pool.** Follow this and the output
looks designed; freestyle and it looks generated. All coordinates assume the 1280×720 canvas.

## The base primitive: the three-band frame

Every slide is three horizontal bands inside a fixed padding (use **64px** side margins):

```
┌ chrome header  — metadata row: kicker/topic · № · date        (y 48–90)
│ content         — the ONE thing this slide says                (y 140–643)
└ chrome footer  — copyright left · page N/N right               (y 658–700)
```

The header and footer chrome repeat on **every** slide (that consistency is most of what
reads as "designed"); only the middle band changes per archetype. Two hard rails, enforced
by `deck-maker check`:

- **Content rail** — text/tables/charts/images must end by **y 643**.
- **Footer zone** — footer chrome lives at **y ≥ 658**.

Decorative shapes and SVG (full-bleed backgrounds, panels) may bleed past the rails.

## Design system

**Palette — pick ONE, use everywhere.** The default (Aurora) below, or pick a named theme
from [`themes.md`](themes.md), or the user's brand. Never introduce a color mid-deck.

| Role | Value |
|---|---|
| Ink (dark surfaces) | `#0f172a` |
| Light background | `#f8fafc` |
| Card surface / border | `#ffffff` / `1px solid #e2e8f0` |
| Primary accent | `#4f46e5` (indigo) |
| Secondary accents | `#38bdf8` sky · `#10b981` emerald · `#f59e0b` amber |
| Headings / body / muted | `#0f172a` / `#475569` / `#64748b` |
| Muted-on-dark / faint | `#94a3b8` / `#cbd5e1` |
| Semantic | good `#10b981` · warn `#f59e0b` · bad `#f43f5e` |

Rotate the four accents for sequences (agenda numbers, KPI ticks, timeline nodes). **Never
pure `#000`/`#fff`** — off-black/off-white keep depth. **Accent budget: an accent appears
≤ 3 times per slide.** Deck-maker's default indigo is fine as a *chosen* accent, but don't
reach for generic AI-purple reflexively.

**Two-surface rule.** A deck uses exactly **two slide surfaces**: the light content
surface, and ONE dark/accent surface shared by every full-bleed slide — cover, section
dividers, and closing all sit on the **same** color. Introducing a third surface (e.g. an
ink divider in an IKB deck) reads as a different deck spliced in. If the dark surface is
the accent (Swiss style), ghost numerals and textures on it are lighter/darker *shades of
that same hue*, never a new hue.

**Tint vs. saturated (the pastel-pair rule).** Saturated accent = marks and text; a
desaturated, same-hue tint = fills/chips/callout backgrounds. E.g. callout bg `#eef2ff` +
indigo `#4f46e5` bar and text. Color is a scarce resource — use it for meaning, not decoration.

**Type scale (px).** A hand-tuned ~1.3–1.4 ramp; pull sizes from it, don't invent:

```
18 · 22 · 28 · 36 · 48 · 64 · 88 · 120 · 160 · 220
```

Roles: cover title 64–120 · section header 36–44 · card title 16–18 · big stat 40–120 ·
body 14–17 · caption/footnote 13 italic · eyebrow/footer 11–13. **Exploit extreme
contrast** — hero to label should be ~8–10×; generated decks cluster everything at 24–48px.
Establish hierarchy with **weight + color, not ever-larger sizes**. Cap at **2 typefaces**
(mono is a free utility for data/chrome).

**Line-height & tracking polarity.** Display (≥ 48px): line-height **0.9–1.0**, tracking
**−0.02 to −0.04em**. Body: line-height **1.4–1.5**, measure capped at **~65 characters**.
Labels/eyebrows: line-height 1, tracking **+0.12 to +0.22em**, uppercase.

**Eyebrow / kicker.** Above nearly every headline: 11–13px, UPPERCASE (write it uppercase
in the source — the converter has no `text-transform`), `letter-spacing: 2px` (converts to
real PPTX character spacing), weight 600, in the accent or muted — a mono face (Courier
New) makes it read technical. Cheapest "designed" signal.

**One-italic-serif-word.** The signature editorial accent: one italic serif word inside an
otherwise-sans headline (e.g. Aurora sans + a Georgia-italic word). Same-family italic/bold
otherwise — never inject a random serif word *and* mix families elsewhere.

**Spacing rhythm.** 8px base grid; card gaps 20–24; generous card padding 24–32.

**Layering (DOM order = z-order).** Background rect → decorative SVG → cards/panels → text.
Never leave a slide default-white with floating text: dark slides get a full-bleed ink rect
+ a gradient-wave SVG; light slides get an `#f8fafc` rect with white cards on top.

## The layout pool (locked)

Compose every deck from this pool. **Do not invent or restructure layouts mid-deck.** Slide
count is driven by content (short 6–10, long far more); **repeat layouts across sections** —
consistency comes from repetition, not variety. Each is a variation of the middle band.

**S01 · Cover (dark).** Full-bleed ink rect + aurora SVG (2 gradient wave paths + faint
circle rings, `stop-opacity` 0.3–0.55); logo 44px + wordmark (64, 56); pill chip
(`border-radius: 18px`, dark tint, 13px bold accent, centered) y ~252; title 72px y ~312;
subtitle 20px muted; hairline (1152×1, `#334155`) y 640; footer both corners. Optional big
stat (56px accent) in the SVG rings.

**S02 · Agenda (split).** Dark panel 420×720 left + SVG wave at its foot; "Agenda" 44px
white (64, 96) + accent bar. Right: per item — number 28px bold rotating-accent x 484, title
22px bold x 564, 15px muted desc, hairline 732×1 under each. Rows y 108, step ~132.

**S03 · KPI dashboard.** Four cards 274×150 y 150 (x 64/357/650/943): white rect radius 14 +
`1px #e2e8f0`, accent tick 40×6, value 40px bold, 14px muted label, 13px bold delta in
emerald/rose with ▲/▼. Below, two cards y 330 h 330: chart card 736w, notes card 396w
(accent-ellipse dots + bold-lead 14px lines, step ~62).

**S04 · Data deep-dive.** Table card 620×470 left (title, `<table>` inset 24, italic
footnote). Right: doughnut/chart card 512×290, then takeaway callout y 460 — tint rect
(`#eef2ff`, radius 14) + 6×full-height accent bar on its left edge + bold mini-title + 15px.

**S05 · Timeline / roadmap.** Hairline 1088×4 `#e2e8f0` y 268; per milestone (x step ~288):
month label 14px bold accent y 200, 24px accent ellipse on the line, 18px bold title y 312,
14px muted desc. Optional workstream cards 368×130 y 480.

**S06 · Photo + quote.** Image 640w × content-height (64, 64) — **box aspect must match the
file's aspect** or it distorts. Right col x 768: giant `"` 96px Georgia `#c7d2fe`, quote 30px
Georgia italic (≤ 3 lines), accent bar 56×4, bold attribution 16px + muted stats 14px.

**S07 · Closing (dark).** Ink rect + one SVG wave; centered logo ~60px y 160; "Thank you"
64px bold centered; contact 19px muted + bold email; pill chip centered y 440; centered 12px
footer.

**S08 · Statement / hero-question (breather).** Full-bleed (light or ink). Eyebrow y ~300,
one giant sentence 88–120px filling the middle band (semantic line breaks), one 22–26px
sub-line below, footer chrome. Centered is allowed *here* (manifesto moment). Use for act
openers and the single most important claim.

**S09 · Big-number (single metric).** ONE hero figure 120–220px (accent), the unit as a
smaller superscript; eyebrow above, 16–18px annotation + one supporting row (label left /
tiny bar right) below. Distinct from S03: one number, not a grid.

**S10 · N-cell grid.** 2×2 / 2×3 / 3×2 of equal cards, each = number `/ 01` + bold title +
one-line desc, alternating or accent-ticked. **Exactly as many cells as items — no empty
cells.** For principles / features / pillars.

**S11 · Ranked H-bar.** Rows of `label(58) · track(1fr) · value(52)`; track is a hairline-thin
bar, fill width = the real percentage, number at the end. PPTX-trivial and honest. For
rankings / breakdowns.

**S12 · Before/After (split).** Vertical divider; left "before" dimmed to a muted color
(~55% read — no `opacity`), right "after" full accent. For migrations / comparisons.

**S13 · Section divider.** Kicker + 88–120px chapter headline + one pull-line; **invert to
the deck's dark surface at chapter boundaries** — the *same* full-bleed color as the cover
and closing (two-surface rule), never a new one. Optional giant chapter number (160px+) in
a shade of that surface's hue as the anchor.

**S14 · Process row (dateless).** 01–04 numbered cards/steps in a row (distinct from S05's
chronological timeline). Middle step may invert to accent. For methods / how-it-works.

## Charts and tables

- Embed **data**, never draw charts: `data-chart` JSON. `bar` (comparison), `line` (trend),
  `pie`/`doughnut` (composition).
- **Always set `colors`** from the palette, in this order: `[accent, accent-2, accent-3,
  good, warn]`. Single series → single accent. Defaults look generic.
- Style discipline (newsroom rules): axis labels/legend in **muted**, gridlines in the
  **border** color, **no drop shadows, no 3D, no full-screen gridlines**. Line width ~3px,
  area fill = stroke + ~13% alpha, doughnut hole ~60%.
- The chart's **title should state the conclusion drawn from the data**, not describe the
  chart ("APAC is 3× faster", not "Revenue by region").
- Every chart sits in a card with a title row (bold "What" + muted normal-weight "(unit)").
- Tables: real `<th>` header, ≤ 5 data rows/slide, `tabular-nums` for numeric columns, italic
  footnote for caveats.

## Iron laws

Non-negotiable — a deck violating any of these is wrong even if it "looks fine":

1. **Never fabricate data.** Every chart value, table figure, KPI, and delta comes from the
   user. No number → ask, or use an honest `—` / explicit `X.X` placeholder. Bar heights and
   fills are real data, to scale. No fake-precise figures (`99.99%`) invented for aesthetics.
2. **One palette per deck.** No new color mid-deck; never mix palettes.
3. **Compose from the layout pool (S01–S14).** Repeat as content demands; never invent.
4. **One focal point per slide.** Exactly one hierarchy peak — one sentence, one number, or
   one image. Never two equal text blocks; if truly parallel, use an equal-weight grid.
   ≤ 4 text roles per slide (eyebrow, title, body, one caption).
5. **No CSS the converter drops** on convertible elements: gradients on shapes (SVG is the
   only gradient vehicle), `box-shadow`, `opacity`, `backdrop-filter`,
   `mix-blend-mode`, filters.
6. **Never italicize CJK** (Chinese/Japanese/Korean — also Arabic, Hebrew, Thai). No italic
   tradition → renderers synthesize an ugly slant. Italic is Latin/Cyrillic/Greek only.
7. **Respect the rails** and run `deck-maker check` before handoff. Zero critical is the gate.

## Copy rules

- **Titles ≤ 8 words; supporting lines ≤ 20–25 words.** Fix a too-long headline by shrinking
  type + widening the box, never by letting it run to 4+ lines (cap 2–3).
- **Ban filler verbs**: Elevate, Seamless, Unleash, Next-Gen, Game-changer, Revolutionize,
  Delve. Concrete verbs only. Active voice, Title Case headings, numerals for counts.
- **Quotes** (S06): ≤ 3 lines; attribution is name + role + company, never name-only; real
  curly quotes `" "`, never straight `"`.
- **Micro-typography**: real ellipsis `…` not `...`; curly quotes; keep units with their
  number. `deck-maker check` flags the first two.

## Visual devices: what survives HTML→PPTX

**Survives (map cleanly to native PPTX shapes/text) — reach for these:**
hairlines (1px border → thin line); chrome rows (three text boxes); **ASCII dot fields**
(a `<pre>` of `▒▓█░` in mono — line breaks are preserved, each line becomes a paragraph);
tracked uppercase labels (`letter-spacing` → real character spacing); tight display
leading (`line-height: 0.95` → real line spacing); dot/cell matrices (grid of small
rects); variable-height KPI bars (`rect`, height ∝ data); ranked H-bar tracks; corner
registration marks (short lines); color-block split panels; numbered indices (`№06`,
`/ 01`); a hard-offset "shadow" (a duplicated offset text box, 0-blur).

**Inline `<svg>` is rasterized to a high-res PNG at convert time** (via resvg, at 2× the
box). So SVG is your escape hatch for anything DrawingML can't do — gradients, gradient
washes, concentric rings, freeform paths, feTurbulence-free vector art — and it renders
identically everywhere. The tradeoff: it's a raster in the `.pptx`, not editable vectors.
(Native SVG-in-PPTX is *not* reliably supported — LibreOffice refuses to open the file and
Google Slides shows a broken image — which is why we rasterize.)

**Won't survive on shapes/text — put it in an SVG instead, or avoid:** CSS gradients,
`box-shadow`, `opacity`, `backdrop-filter` blur, `mix-blend-mode`,
blurred-glow text-shadow, all motion/transitions, `clamp()`/`vw` (resolve to fixed px —
we already have a fixed canvas).

## Theming with CSS variables (optional)

The engine resolves `var(--x)` / `var(--x, fallback)` in inline styles against the **first
`:root { … }` block** in a `<style>` tag (a flat lookup, not a cascade). So a deck can carry
a theme block and reference it — swap the block, recolor the whole deck. Use the `--od-*`
slot names from [`themes.md`](themes.md). Geometry stays literal px; only colors/fonts theme.

## Look at it — don't trust the HTML

Build slide by slide and **render each slide to an image** (screenshot / Playwright /
browser) before moving on. Reading the markup hides text overflow, wrong positions,
broken images, distorted photos, and off-palette color — only the pixels are ground
truth. Every real defect in this project's history was found by *looking*, not by
reviewing HTML. See the SKILL workflow for the loop.

For the browser render to match the converter, the preview relies on three things (all in
`examples/index.html`): the converter ignores `<style>`/`<script>` for layout, so they
exist purely to make the browser show what the PPTX will contain:

1. Margin reset: `.slide p, .slide h1, .slide h2 { margin: 0; line-height: 1.25; }` — without
   it browser text sits ~16px lower than the converter places it.
2. The chart preview script — `data-chart` divs are empty boxes otherwise.
3. `data-shape="ellipse"` needs `border-radius: 50%`.

And the browser is still only a proxy — after converting, **look at the `.pptx`** too.

## The distilled tell: designed vs generated

1. Chrome rows top+bottom of every slide. 2. One accent, never a rainbow. 3. Extreme type
contrast (8–10×) with tight-negative/loose-positive tracking polarity. 4. Uppercase tracked
eyebrow above every headline. 5. Hairlines, not boxes/shadows, as separators. 6. Numbered
indices everywhere. 7. One italic-serif emphasis word. 8. Data honesty. 9. One focal point
per slide. 10. Locked palette + locked layout pool, repetition allowed, invention forbidden.
