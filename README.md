# deck-maker

Design a slide deck as HTML with Claude Code, then convert it to a **real, editable
PowerPoint** — native text, tables, charts, and shapes, not a stack of images.

New here? Read **[docs/overview.md](docs/overview.md)** for what it is and how it works.
This page is just install & usage.

## Requirements

- [Bun](https://bun.sh) 1.3+ (the engine is Bun/TypeScript; conversion is browser-free).

## Install

```sh
git clone https://github.com/iteam1/deck-maker.git
cd deck-maker
bun install
```

Keep the clone around — the conversion engine lives in it and the CLI runs from it.

## Add `deck-maker` to your PATH

So you can run `deck-maker` from any folder:

```sh
bun link            # in the deck-maker repo — creates ~/.bun/bin/deck-maker
```

That symlinks a global `deck-maker` command (make sure `~/.bun/bin` is on your `PATH` —
it is by default with Bun). Verify:

```sh
deck-maker check examples/index.html      # → "11 slide(s), 0 issues, 0 critical"
```

**Prefer not to link?** Two alternatives:
- Run it in place: `bun /path/to/deck-maker/src/cli.ts convert deck.html out.pptx`
- Or drop a one-line wrapper on your PATH:
  ```sh
  printf '#!/usr/bin/env bash\nexec bun /path/to/deck-maker/src/cli.ts "$@"\n' \
    > ~/.local/bin/deck-maker && chmod +x ~/.local/bin/deck-maker
  ```

## Use it with Claude Code

deck-maker ships two skills — **deck-author** (writes the HTML) and **deck-convert** (runs
the engine). Install them one of two ways:

### Option A — as a plugin (shareable)

From Claude Code, add this repo as a plugin marketplace and install it:

```
/plugin marketplace add /path/to/deck-maker
/plugin install deck-maker
```

(Uses `.claude-plugin/marketplace.json`. You can also point `marketplace add` at the
GitHub URL once it's pushed.)

### Option B — just copy the skills

Copy the two skill folders where Claude Code looks for skills:

```sh
# available in every project:
cp -r skills/deck-author skills/deck-convert ~/.claude/skills/

# or, just this project:
cp -r skills/deck-author skills/deck-convert <your-project>/.claude/skills/
```

Either way, from any project you can now say:

> "Make me a deck about our Q2 results."

Claude authors `deck.html` from the [worked example](examples/index.html), you review it in
a browser, and on your OK it runs the engine to produce `deck.pptx`.

## Use the CLI directly

```sh
deck-maker check   deck.html              # validate geometry (rails, charts, images)
deck-maker convert deck.html deck.pptx    # → a native, editable .pptx
```

From inside the repo you can also use the scripts: `bun run check …` / `bun run convert …`.
`convert` runs `check` first and refuses on critical issues.

Open the result in PowerPoint, Keynote, Google Slides, or LibreOffice.

## Docs

- **[docs/overview.md](docs/overview.md)** — what it is, the fidelity ladder, how it works.
- **[docs/design.md](docs/design.md)** — engine internals (components, dataflow, workflow).
- **[docs/IR.md](docs/IR.md)** — the `Deck` intermediate-representation contract.
- **[skills/deck-author/references/design.md](skills/deck-author/references/design.md)** —
  the design playbook (palette, type scale, archetype pool) the agent authors against.
