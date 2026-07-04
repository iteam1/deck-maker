# Language: Editorial E-Ink

**Intent:** narrative, opinion, story-telling, personal voice. Magazine-meets-e-ink,
printed-paper feel — explicitly *not* tech-y. Ported from open-design's
`deck-guizang-editorial` (guizang-ppt-skill Style A).

## Palette (pick ONE of five; never change hex, never mix)

| Set | ink | paper | paper-tint | ink-tint | Use for |
|---|---|---|---|---|---|
| **Monocle** (default) | `#0a0a0b` | `#f1efea` | `#e8e5de` | `#18181a` | general / business / tech |
| Indigo Porcelain | `#0a1f3d` | `#f1f3f5` | `#e4e8ec` | `#152a4a` | research / data |
| Forest Ink | `#1a2e1f` | `#f5f1e8` | `#ece7da` | `#253d2c` | nature / sustainability / culture |
| Kraft Paper | `#2a1e13` | `#eedfc7` | `#e0d0b6` | `#3a2a1d` | nostalgia / humanities / literary |
| Dune | `#1f1a14` | `#f0e6d2` | `#e3d7bf` | `#2d2620` | art / design / fashion |

Muted text = ink at ~60% strength (pick a solid mid-tone of the ink hue, e.g. Monocle
`#5a5a56`). **Two surfaces only:** paper + ink — the cover may be paper or ink, but
dividers and closing share whichever dark surface the deck uses. Chart ramp = ink →
ink-tint → two paper-tint steps.

## Type

- Display: **Georgia** (the PPTX-safe serif) — 72–96px, `line-height: 1.0–1.1`,
  headlines may set one word italic. Numbers may be italic serif for the magazine feel.
- Body: **Arial**, 15–17px, `line-height: 1.5–1.6`.
- Kicker: 11px uppercase, `letter-spacing: 2px`, Courier New or Arial bold, ink or muted.
- Folio (page number): Courier New, bottom-right, `01 / 12`.

## Chrome (every slide)

Top hairline rule + journal masthead: publication/topic left (11px tracked uppercase),
issue/date right. Bottom: folio right, imprint left. Hairlines in ink at 1px on paper;
paper-tone on ink slides.

## Restyling the pool

Paper-tint blocks instead of white cards (square corners); baseline-aligned images
(bottom edges line up, not tops); serif pull-quotes at 56–72px with translation/attribution
lines; act dividers = kicker + giant serif headline + one epigraph on the ink surface;
big-numbers grid = 3×2 label / large italic-serif number / footnote; before/after split
with the "before" column in muted ink (no `opacity` — use the muted tone); pipeline steps
as `№X` + title + description. Photos: duotone to the palette's ink over paper.

## Bans

Gradients · drop-shadows · rounded corners · circular decorations · blur · icon
libraries · emoji decoration · fabricated data / lorem ipsum / placeholder image URLs
(draw figures as flat color blocks + line art in SVG).
