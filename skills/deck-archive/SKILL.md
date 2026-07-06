---
name: deck-archive
description: Save a shipped deck (its deck.html + deck.pptx) into deck-maker's reference corpus, and list what's in that corpus. Use once the user keeps/ships a deck, so future decks can reuse its style. Also `--list` the corpus so deck-author can find a past deck to seed from. Not for authoring or converting (see deck-author / deck-convert).
triggers:
  - "save this deck"
  - "archive this deck"
  - "ship it"
  - "keep this one"
  - "add to my deck library"
  - "what decks have I made"
  - "list my decks"
od:
  mode: utility
  category: slides
  scenario: engineering
  design_system:
    requires: false
  capabilities_required:
    - subprocess
---

# Archiving a shipped deck

deck-maker is otherwise stateless — every deck starts from a generic example. Archiving
makes it **remember**: a deck the user keeps becomes reference material, so the next deck
can start from their closest past deck instead of a generic one. This skill is the write +
list side of that loop; **deck-author** reads the corpus (its step 0), and **deck-inspect**
deep-reads a chosen match.

## When to use

Only when a deck is **final** — the user says "ship it", "that's the one", "save this".
Never archive mid-design; the corpus is decks the user actually kept, not drafts.

## Archive a deck

After **deck-convert** has produced the `.pptx`:

```
deck-maker archive deck.html deck.pptx \
  --type qbr --language swiss-ikb --note "board Q2 review; the KPI tower worked"
```

- `--type` — `qbr` | `pitch` | `sales` | `talk` | `status` | `consulting`
- `--language` — the design language used (`swiss-ikb`, `editorial-ink`, `aurora-cards`, …)
- `--note` — one line on what worked / what to reuse it for
- `--title` — optional; defaults to the deck's first slide text

You pass `type`/`language`/`note` because you just authored the deck and know them. The
engine fills the rest **automatically by inspecting the `.pptx`** — title, palette, fonts,
slide count — so the card records the deck's real recovered style, not a guess.

It writes one folder into the corpus and prints its path:

```
<corpus>/2026-07-07-aurora-analytics-q2-fy2026/
├── deck.html          the approved source
├── deck.pptx          the shipped artifact
└── SUMMARY.md         index card: frontmatter (title/date/type/language/palette/fonts/
                       slides) + your note
```

## List the corpus (the reference side)

```
deck-maker archive --list
```

Prints every card as a JSON array, newest first — a cheap index to scan for a deck like
the one now requested. This is what **deck-author** runs at step 0: find a match by
`type`/`language`/`palette`, then `deck-maker inspect` that folder's `deck.pptx` to recover
its exact style and seed the new deck from it.

## Where the corpus lives

By default the deck-maker install's own `examples/` (one fixed location, so the corpus is
the same no matter which folder you're working in). Archived folders there are gitignored —
only the two curated examples are tracked. Set `DECK_MAKER_ARCHIVE_DIR` to relocate the
corpus (e.g. a synced folder) — `archive` and `--list` both honor it.

## Bundled resources

- `src/archive.ts` — the engine (`archive()` writes a card by reusing `inspect()`;
  `listArchive()` reads them back). Shared install with the other skills; no separate setup.
- Reading an existing card's deck in depth → **deck-inspect**. Starting a new deck from a
  match → **deck-author** (step 0).
