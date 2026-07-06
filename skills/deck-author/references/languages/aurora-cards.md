# Language: Aurora Cards

**Intent:** friendly corporate — product reviews, team updates, SaaS dashboards. Softer
and more approachable than Swiss; rounded cards and gradient atmosphere. The worked
example in this language is `examples/pitch.html` (investor-pitch arc) — copy it.

## Palette

| Role | Value |
|---|---|
| Ink (dark surfaces) | `#0f172a` |
| Light background | `#f8fafc` |
| Card surface / border | `#ffffff` / `1px solid #e2e8f0` |
| Primary accent | `#4f46e5` indigo |
| Rotating accents | `#38bdf8` sky · `#10b981` emerald · `#f59e0b` amber |
| Headings / body / muted | `#0f172a` / `#475569` / `#64748b` |
| Muted-on-dark | `#94a3b8` |
| Tint fills | `#eef2ff` (indigo), `#1e1b4b` (chip-on-dark) |

Unlike Swiss, the four accents **rotate** through sequences (agenda numbers, KPI ticks,
timeline nodes) — but still ≤ 3 accent hits per slide. **Two surfaces only:** the light
bg + ink (cover, dividers, closing share ink).

**Colors are parameters:** the table above is the *default* binding. Author against a
`:root` block (`--od-accent`, `--od-accent-2/3`, `--od-page-bg`, `--od-surface`,
`--od-text`, `--od-muted`, `--od-border`) and use `var()` in inline styles — the
converter resolves it, so a rebrand is a one-block edit. Keep the relationships: tint
fills are pale versions of their accent (`#eef2ff` ← indigo); the rotating set stays
4 hues of similar weight. `data-chart` colors are JSON — mirror your slot hex there.

## Type

- Everything **Arial**: display 64–72px bold, section headers 36px, card titles 18px,
  body 14–17px (`line-height: 1.4–1.5`).
- Eyebrows: 12px bold uppercase, `letter-spacing: 2px`, in the section's accent.
- One **Georgia**-italic accent word per section; Georgia for pull-quotes and the giant
  `"` mark (96px, `#c7d2fe`).

## Chrome (every slide)

Eyebrow (`02 · REVENUE`) above the header + `№ 0N` index top-right in faint `#cbd5e1`;
56×6 accent bar under the section header; footer `© YEAR COMPANY · Confidential` left,
`N / NN` right, 12px muted at y ≥ 658.

## Restyling the pool

Rounded cards are the signature: white rects `border-radius: 14px; border: 1px #e2e8f0`
for KPI tiles (accent tick 40×6 + 40px value + label + colored delta with ▲/▼), chart
cards, and notes cards with 10px accent-ellipse dot markers. Dark slides get a full-bleed
ink rect + an **aurora gradient SVG** (2 wave paths, `stop-opacity` 0.3–0.55, indigo→sky)
+ faint circle rings. Pill chips (`border-radius: 18px`, `#1e1b4b`, tracked accent text).
Tint callouts (`#eef2ff` + 6px accent edge bar). Round 24px timeline nodes in rotating
accents.

## Bans

Mixing this language's gradients/rounding into Swiss or Editorial decks · a third
surface color · more than 3 accent hits per slide · fabricated data.
