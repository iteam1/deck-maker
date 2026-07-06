# deck-maker

Design a slide deck as HTML with Claude Code, convert it to a **real, editable
PowerPoint** — native text, tables, charts, shapes. Not images.

What/how: **[docs/overview.md](docs/overview.md)**. This page: install & use.

## Install

Requires [Bun](https://bun.sh) 1.3+.

```sh
git clone https://github.com/iteam1/deck-maker.git
cd deck-maker
bun install
bun link        # puts `deck-maker` on your PATH (~/.bun/bin)
```

Verify:

```sh
deck-maker check examples/index.html    # → "13 slide(s), 0 issues, 0 critical"
```

No link? Run in place: `bun /path/to/deck-maker/src/cli.ts …`

## Use with Claude Code

Two skills ship in `skills/`: **deck-author** (writes the HTML) and **deck-convert**
(runs the engine). Install either way:

```sh
# A — plugin:
/plugin marketplace add /path/to/deck-maker
/plugin install deck-maker

# B — copy skills (global, or into a project's .claude/skills/):
cp -r skills/deck-author skills/deck-convert ~/.claude/skills/
```

Then, from any project:

> "Make me a deck about our Q2 results."

Claude writes `deck.html` (from the [worked examples](examples/) — Swiss QBR + Aurora pitch), you review in
a browser, on your OK it produces `deck.pptx`.

## CLI

```sh
deck-maker check   deck.html              # validate geometry
deck-maker convert deck.html deck.pptx    # check + convert
deck-maker inspect existing.pptx          # read an EXISTING pptx's content as JSON
```

Opens in PowerPoint, Keynote, Google Slides, LibreOffice. `inspect` is one-way and
read-only — it pulls text/tables/chart data/image refs *and* style (color palette,
fonts, type scale, rounded-vs-square corners) out of any `.pptx` for reuse or to match
an existing deck's look; it does not reconstruct an editable `deck.html`.

## Docs

- [docs/overview.md](docs/overview.md) — what it is, the fidelity ladder
- [docs/design.md](docs/design.md) — engine internals
- [docs/IR.md](docs/IR.md) — the `Deck` IR contract
- [skills/deck-author/references/design.md](skills/deck-author/references/design.md) —
  the design playbook
