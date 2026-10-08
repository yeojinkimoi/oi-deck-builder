# oi-slide Improvement Plan

Goal: make the OI deck pipeline flexible and usable by other people, and make Raj's edit
requests faster and more accurate to incorporate. Four phases; Phase 1 is implemented.

## Target architecture

```
Raj's comments ──> [edit-request-parser agent] ──> edits/YYYY-MM-DD_raj.yaml
(email/Slack text,                                       │
 marked-up PPTX/PDF,                                     ▼
 typed meeting notes)                        [deck-generator agent]
                                              outline.md + edits ──> my_deck.js
outline.md ─────────────────────────────────────────────┤
                                                         ▼
[figure-maker agent] ──> figure specs (JSON) ──> native PPTX shapes on slides
(diagrams, icons,                                        │
 concept explainers)                                     ▼
                                                  node my_deck.js ──> Deck.pptx
Stata/R data figures ──> SVG ────────────────────────────┤
                                                         ▼
                                             [style-checker agent]
                                             renders + inspects XML ──> report / auto-fix
```

Single source of truth for style is the `theme` object exported by `oi_deck_builder.js`.
Every agent reads style from there — the generator writes with it, the checker validates
against it, and Raj-requested style tweaks are edits to it (or per-deck overrides), never
scattered magic numbers.

---

## Phase 1 — Style-guide alignment & theme centralization  ✅ DONE

Problems fixed:

- Dozens of magic numbers (font sizes, panel-title height, text-box positions, footnote y)
  were inlined in slide methods, so nothing could be adjusted without editing the builder.
- Several values disagreed with `Guides and Brand DNA/OI EOP Presentations - Style Guide.pdf`.

What changed in `oi_deck_builder.js`:

1. **All typography and layout constants moved into `theme`** — new `theme.text` (one entry
   per text role: title, subtitle, panelTitle, bullet, subBullet, source, footnote, table,
   intro*, missingFigure) and expanded `theme.layout` (panelTitleH, richTextBox, footnote
   position, gaps, paragraph spacing, line weights). Slide methods contain no inline style
   numbers anymore.
2. **Per-deck theme overrides** — `new OIDeckBuilder({ theme: {...} })` deep-merges onto the
   defaults. Example: `theme: { text: { subtitle: { fontSize: 14 } }, subtitleBar: { y: 0.85 } }`.
   This is the hook the edit-request pipeline uses for "move the subtitle up"-type requests.
3. **`stylePreset: "guide2025"`** — opt-in preset applying the official style guide where the
   current defaults deviate (kept opt-in so existing approved decks don't silently change):

   | Item            | Current default        | Style guide (guide2025 preset)   |
   |-----------------|------------------------|----------------------------------|
   | Panel titles    | Lucida Sans 14 bold    | Lucida Bright 16 bold            |
   | Bullet text     | Arial 22 / 18          | Lucida Sans (min 16, max 24)     |
   | Table cells     | Lucida Sans 13         | Lucida Sans 16 (descriptive text)|
   | Line weights    | underline 1, rule 0.75 | 0.5 everywhere                   |

   Values that already match the guide: slide title (Lucida Bright 24 bold), subtitle
   (Lucida Sans 16 #626365), source (Lucida Sans 14).

   **Decision needed from Raj/team:** should `guide2025` become the default? Flip one line
   (`DEFAULT_PRESET`) when decided.

Verification: `example/wgu_deck.js` rebuilt before/after refactor; slide XML is unchanged
with default settings (see Phase-1 verification note at bottom).

---

## Phase 2 — Subagents (`.claude/agents/*.md`, checked into the repo)

Claude Code subagents defined as markdown files in `.claude/agents/`. Anyone who clones the
repo and opens Claude Code/Cowork gets them automatically. Each agent's file contains its
role prompt, the tools it may use, and pointers to the schema/docs it must read.

### 2a. `edit-request-parser`

Turns Raj's comments — in any of the three forms — into a normalized, machine-actionable
edit file the other agents consume.

- **Inputs:** pasted email/Slack text; a marked-up `.pptx` (extract comments/annotations by
  unzipping `ppt/comments/*.xml`, or python-pptx); an annotated PDF (extract with
  `pypdf`/`pdfplumber` annotation APIs); typed meeting notes.
- **Output:** `edits/<date>_<source>.yaml`, one entry per request:

  ```yaml
  - id: e1
    slide: 4                # number, title substring, or "all"
    target: subtitle        # title|subtitle|figure|panel_title|bullet|table|source|layout
    action: move            # move|resize|restyle|reword|replace_figure|add|delete|recolor
    detail: "move subtitle up ~0.1in"
    proposed: { subtitleBar: { y: 0.68 } }   # concrete theme/opts override when inferable
    status: pending         # pending|applied|needs_clarification|rejected
    verbatim: "the subtitle is floating too low on the ROI slide"
  ```

- Ambiguous items get `status: needs_clarification` with a specific question, rather than a
  guess. The YAML is the audit trail — Raj's verbatim words are always preserved.

### 2b. `figure-maker` (native PPTX shapes)

Creates conceptual figures — diagrams, icon layouts, method explainers (regression trees,
gradient boosting, event-study schematics) — as **editable native PowerPoint shapes**, per
the decision that manual post-editing matters most.

- **New builder API (Phase 2 code work):** `deck.addShapeFigure(slide, spec)` plus
  `deck.addDiagramSlide(title, subtitle, spec)`. The spec is a small JSON DSL
  (`figspecs/<name>.json`): nodes (rect/ellipse/line/arrow/text/icon), positions in inches,
  theme-color references by name (`"OI_GREEN"`), auto-styled with OI fonts. The builder maps
  it onto PptxGenJS shape calls.
- **Reconciliation with hand edits** (the concern you raised): the JSON spec is the source of
  truth and rebuilds are deterministic. If someone hand-edits shapes in PowerPoint, they (or
  the agent) back-port the change into the spec — a small `scripts/extract_shapes.js` that
  reads a slide's XML and dumps shape geometry makes this semi-automatic. Rule of thumb:
  hand edits are for experimenting; anything kept must land in the spec, else the next
  rebuild overwrites it.
- **Data figures stay SVG/Stata** (scatter, event studies, bar plots from `soo_2026/*.do`).
  Native shapes are for diagrams; statistical graphics keep the existing SVG path (vector,
  ungroupable in PowerPoint via Convert-to-Shape, already handled by `injectSvgPreviews`).
- Icons: Font Awesome solid (per style guide), embedded as SVG path data in the spec.

### 2c. `deck-generator`

Formalizes the existing outline→deck workflow (what CLAUDE.md already documents) as an
agent with a checklist:

1. Read `outline_template.md` + fig dir + any `edits/*.yaml` with `status: pending`.
2. Choose the right method per slide (TEXT/TABLE/1–4-FIGURE/diagram) — mapping table lives
   in CLAUDE.md.
3. Apply pending edits: content edits go into the deck script; style edits become `theme`
   overrides in the constructor; mark them `status: applied` in the YAML.
4. Build (`node my_deck.js`) and confirm zero warnings (missing figures fail loudly).

### 2d. `style-checker`

Post-build QA. Two complementary checks:

- **Structural:** unzip the .pptx, parse slide XML, validate against the exported `theme` —
  fonts/sizes/colors per text role, figure boxes inside allowed regions, no element
  overlapping the source rule at y≈7.09, panel titles present where expected, aspect ratios
  not distorted (w/h vs original SVG/PNG). Script: `scripts/check_style.js` (agent runs and
  interprets it).
- **Visual:** render slides to PNG (`libreoffice --headless --convert-to pdf` + `pdftoppm`),
  view the images, and flag what XML can't catch: crowding, misaligned panels, text
  overflowing boxes, figures that look too small.
- **Output:** `reports/style_report.md` with per-slide pass/fail and, where mechanical, a
  proposed fix (theme override or opts change) the deck-generator can apply directly.

---

## Phase 3 — End-to-end edit loop

Wire 2a→2c→2d into one command: "here are Raj's comments" →
parse → apply → rebuild → check → produce a **change summary** (`reports/changes_<date>.md`:
each edit, what was changed, before/after slide thumbnails) that can be sent back to Raj.
Unresolved `needs_clarification` items surface as a short question list. Target: most
routine edit rounds (< ~10 comments) complete in one pass with zero manual builder edits.

## Phase 4 — Usability for other people

- **Repo hygiene:** move `scratch_*` files into `scratch/` (or delete); split example decks
  into `decks/<project>/` folders (deck.js + outline.md + figures/).
- **README quickstart** for non-developers: install Node, clone, `npm install`, copy the
  outline template, ask Claude. Document the agents ("paste Raj's email and say
  'apply these edits'").
- **`npm run` scripts:** `build`, `check`, `edits` so nobody memorizes node invocations.
- **Templates:** `outline_template.md` at repo root (currently only inside `example/`),
  plus a starter `figspec` example.
- Optional later: package the whole thing as a Claude skill for use outside this repo.

## Suggested order of work

| Step | Item | Effort |
|------|------|--------|
| 1 | Phase 1 theme centralization | ✅ done |
| 2 | Edit YAML schema + `edit-request-parser` agent | small |
| 3 | `style-checker` (structural script first, visual second) | medium |
| 4 | `deck-generator` agent (formalize existing flow + consume edits) | small |
| 5 | Shape-figure DSL + `addShapeFigure` + `figure-maker` agent | large |
| 6 | Phase 3 loop + change summaries | small |
| 7 | Phase 4 packaging | small |

Rationale: the edit loop (2a/2c/2d) delivers the "incorporate Raj's edits faster" win
immediately; the figure DSL is the biggest new machinery and shouldn't block it.

## Open questions

1. Make `guide2025` the default preset? (Changes bullet font Arial→Lucida Sans on rebuilds.)
2. Should the style-checker auto-fix silently or always propose first? (Plan assumes propose.)
3. Keep marked-up PPTX comments in the deck after applying, or strip them on rebuild?

---

### Phase-1 verification note

Rebuild `example/wgu_deck.js` with no options: output must be identical to pre-refactor
(same slide XML modulo timestamps). With `stylePreset: "guide2025"`, expect panel-title and
bullet-font differences only.
