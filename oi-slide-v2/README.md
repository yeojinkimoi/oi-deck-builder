# oi-slide-v2

Agent-assisted pipeline for Opportunity Insights slide decks. Successor to `oi-slide`
(Phase 1's theme refactor is included). New in v2:

- **Style presets & theme overrides** — `stylePreset: "guide2025"` applies the official
  OI EOP Style Guide; any style tweak is a one-line `theme` override, not a code edit.
- **Editable shape diagrams** — describe a diagram in a small JSON "figspec"
  (`figspecs/*.json`) and it renders as REAL PowerPoint shapes anyone can move and edit.
  See the regression-tree and gradient-boosting examples.
- **Edit-request workflow** — reviewer comments (email, Slack, marked-up PPTX/PDF, notes)
  become a normalized `edits/*.yaml` queue that is applied mechanically and audited.
- **Style checker** — `scripts/check_style.js` validates fonts/sizes/positions against
  the theme; the style-checker agent adds a visual pass on rendered slides.
- **Subagents** (`.claude/agents/`) — anyone opening this folder in Claude Code or
  Cowork gets four specialists: `edit-request-parser`, `deck-generator`, `figure-maker`,
  `style-checker`.

## Quickstart

```bash
cd oi-slide-v2
npm install
npm run build:demo                       # builds decks/demo_ml/TreeModelsDemo.pptx
npm run check decks/demo_ml/TreeModelsDemo.pptx -- --preset guide2025
```

## Typical workflows (with Claude)

**Build a deck from an outline** — copy `templates/outline_template.md`, fill it in,
then: *"build a deck from decks/myproject/outline.md"* (deck-generator agent).

**Incorporate Raj's feedback** — paste his email or point at the commented .pptx, then:
*"capture these edits and apply them"*. The edit-request-parser writes `edits/<date>.yaml`
(his verbatim words preserved, ambiguities become explicit questions), the deck-generator
applies every pending entry, rebuilds, and runs the checker.

**New concept diagram** — *"make a figure explaining difference-in-differences"*
(figure-maker agent). The figspec JSON is the source of truth; hand edits in PowerPoint
must be back-ported to the JSON or the next rebuild overwrites them.

**Pre-flight QA** — *"check the deck before I send it"* (style-checker agent) →
`reports/style_report.md`.

## Layout

```
oi_deck_builder.js     core builder (theme, presets, slide methods)
oi_shapes.js           shape-diagram extension (addDiagramSlide, figspec renderer)
figspecs/              diagram sources (JSON, editable-shape figures)
decks/<project>/       one folder per deck: deck.js (+ figures/, outline.md)
edits/                 SCHEMA.md + one YAML per feedback round
scripts/               check_style.js, extract_pptx_comments.js
.claude/agents/        the four subagents
templates/             outline template
reports/               style reports and change summaries
```

Style questions still open (see ../PLAN.md): whether `guide2025` becomes the default
preset. Decks opt in today via `stylePreset: "guide2025"`.
