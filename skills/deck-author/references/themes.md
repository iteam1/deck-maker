# Themes

A named palette + font pairing you pick per deck purpose, instead of the default Aurora.
Two ways to apply one — both are fine:

- **Inline the hex** directly on each element (simplest; what the example deck does).
- **Carry a `:root` block** and reference it with `var(--…)`. The engine resolves
  `var(--x)` / `var(--x, fallback)` against the first `:root { … }` in a `<style>` tag (a
  flat lookup, not a cascade), so swapping the block recolors the whole deck. Only
  colors/fonts theme — geometry stays literal px.

## The slot contract (`--od-*`)

Every theme fills the same nine slots (the normalized set open-design uses across 150
brands). Map to the deck like this:

| Slot | Used for |
|---|---|
| `--od-page-bg` | slide background rect |
| `--od-surface` | card / panel fills |
| `--od-text` | headings + primary body |
| `--od-muted` | captions, labels, footer, axis/legend |
| `--od-border` | hairlines, card borders, chart gridlines |
| `--od-accent` | title bars, ticks, chart series[0], links |
| `--od-accent-2`, `--od-accent-3` | sequence accents, extra chart series |
| `--od-radius` | card corner radius |
| `--od-font-display`, `--od-font-body` | title vs body font |

```html
<style>
  :root {
    --od-page-bg: #0b0e1a; --od-surface: #14182b; --od-text: #f5f7fa;
    --od-muted: #8b93a8;  --od-border: #262c44;  --od-accent: #6c8cff;
    --od-accent-2: #38bdf8; --od-accent-3: #a78bfa; --od-radius: 14px;
  }
</style>
<!-- then, on any element: -->
<div data-shape="rect"
     style="position:absolute; left:0; top:0; width:1280px; height:720px;
            background: var(--od-page-bg);"></div>
```

## Named palettes

Each row: `page-bg / surface / text / muted / border / accent / accent-2 / accent-3`, radius.
Dark themes flip page-bg to ink and text to near-white. Pick per the "use for" column.

| Theme | Palette (hex) | radius | Use for |
|---|---|---|---|
| **Aurora** (default) | `#f8fafc` / `#ffffff` / `#0f172a` / `#64748b` / `#e2e8f0` / `#4f46e5` / `#38bdf8` / `#10b981` | 14 | general business, product reviews |
| **Corporate Clean** | `#ffffff` / `#f5f7fa` / `#0a2540` / `#8898aa` / `#dbe3ec` / `#1d4ed8` / `#0e9f6e` / `#64748b` | 6 | board reports, B2B, finance |
| **Pitch VC** | `#ffffff` / `#f5f7fa` / `#0b0d12` / `#8b93a8` / `#e6eaf2` / `#0070f3` / `#7928ca` / `#0cce6b` | 12 | fundraising, launch decks |
| **Swiss IKB** | `#fafaf8` / `#ffffff` / `#0a0a0a` / `#555` / `#111` / `#002fa7` / `#0a0a0a` / `#002fa7` | 0 | facts, methodology, rational |
| **Editorial Serif** | `#faf7f2` / `#ffffff` / `#1b1410` / `#8a7868` / `#e6ddcf` / `#8a2a1c` / `#c97a4a` / `#3f7d4f` | 4 | narrative, thought-leadership |
| **Tokyo Night** (dark) | `#1a1b26` / `#24283b` / `#c0caf5` / `#565f89` / `#2f334d` / `#7aa2f7` / `#bb9af7` / `#7dcfff` | 12 | engineering, developer topics |
| **Linear** (dark) | `#08090a` / `#191a1b` / `#f7f8f8` / `#8a8f98` / `#26282b` / `#5e6ad2` / `#7aa2f7` / `#26c6a6` | 8 | modern SaaS, product |
| **After-Hours** (dark) | `#0a090f` / `#151320` / `#f4f1f6` / `#8f8698` / `#26232d` / `#ff4ea2` / `#a78bfa` / `#38bdf8` | 10 | premium, brand, launch |
| **Digits Lime** | `#f2f2ed` / `#ffffff` / `#0a0a0a` / `#5a5a52` / `#d9d9cf` / `#0a0a0a` / `#3a7cff` / `#188f5a` | 6 | fintech, data-forward |
| **Retro Blue/Orange** | `#f4f0e3` / `#ffffff` / `#0e0e0f` / `#6a6558` / `#d8d2bf` / `#1537ff` / `#ffb34a` / `#f05a3a` | 4 | quarterly review, roadmap |

## Font pairings (optional; requires the fonts installed for PPTX)

The engine reads `font-family` per run and passes the first family to PowerPoint. Deck-maker
defaults to Arial (universally present). If you set a brand font, it must be installed on the
machine opening the `.pptx` or PowerPoint substitutes. Coherent pairs from the styles above:

- **Rational/Swiss** — Inter Tight (display) + Inter (body) + a mono for data/chrome.
- **Editorial** — Playfair Display (display, incl. italic) + Inter (body).
- **Newsroom/data** — Source Serif (headline + italic accents) + IBM Plex Sans (body).
- **Safe default** — Arial for everything; Georgia for the one-italic-serif-word accent.

Keep it to ≤ 2 families (mono is a free third for data). Never italicize CJK text.
