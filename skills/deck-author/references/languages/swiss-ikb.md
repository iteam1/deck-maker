# Language: Swiss International (IKB)

**Intent:** facts, product, analysis, methodology. Cold, rational, academic. The shipped
example (`examples/index.html`) is this language — copy it. Ported from open-design's
`deck-swiss-international`.

## Palette (pick one accent set; never change hex, never mix)

| Set | accent | paper | ink | Use for |
|---|---|---|---|---|
| **Klein Blue** (default) | `#002fa7` | `#fafaf8` | `#0a0a0a` | business / AI / design |
| Lemon | `#ffd500` | `#f7f5ee` | `#0a0a0a` | youth / retail / sport (text always ink) |
| Neon Green | `#c5e803` | `#f7f5ee` | `#0a0a0a` | sustainability / startup (text always ink) |
| Safety Orange | `#ff6b35` | `#f7f5ee` | `#0a0a0a` | industrial / urgent (text paper, bold) |

Support tones derive from the accent — for Klein Blue: hairline `#d8d5cc`, muted
`#6b6b66`, faint `#9a988f`; on-accent tones `#2a4bb8` (hairline), `#8fa3d8` (muted),
`#b8c4e8` (body), `#4666c4` (texture); monochrome chart ramp `#002fa7 → #4666c4 →
#8fa3d8 → #d6ddf0`. **Two surfaces only:** paper + the accent (cover, dividers, closing
all sit on the accent; ghost numerals/textures on it are shades of the same hue).

## Type

- Display/body: **Arial** — bold display at 84–104px, `line-height: 0.95`.
- Chrome/data/numerals: **Courier New** bold — KPI values 40px, labels 12px uppercase
  `letter-spacing: 1–2px`.
- One italic accent word per section max: **Georgia** italic, in accent or tint.
- Title endings take an accent-colored period: `Agenda<span accent>.</span>`

## Chrome (every slide, identical)

- Top y44: three mono 12px bold tracked texts — `COMPANY — PERIOD` left, `№ 0N / NN`
  center, section code right. Hairline y76 (ink on paper, on-accent tone on accent).
- Footer: hairline y654; mono 12px `COMPANY · CONFIDENTIAL` left, `N / NN` right at y668.

## Restyling the pool

Right angles ONLY (`border-radius: 0`), 1px hairlines instead of cards, whitespace does
the separation. Signature moves: **KPI tower** (S03 → mono numerals + accent bars whose
height = real % to scale, standing on a 2px ink baseline, with a mono scale note);
ranked H-bars with the monochrome ramp; typographic table (hairline rows, 2px ink header
rule); ASCII dot fields (`<pre>` of `▒▓█░` in Courier New, `letter-spacing: 5–6px`,
texture tone); dot matrices (12px squares, accent + tint); square timeline nodes (16px
rects, all accent); process columns separated by vertical hairlines; solid accent
takeaway blocks with paper text; ghost chapter numerals (220px, same-hue shade).

## Bans

Rounded corners (instant violation) · shadows / gradients / blur · more than one accent
hue · decorative fonts · fabricated numbers (bar heights = real data, to scale).
