# oi-slide-v2 — Detailed Plan

Goal: a flexible, easy-to-use OI-style figure/deck generator that non-technical OI staff
can drive, and that turns **Raj's edit requests into applied changes faster and more
accurately**. Reference target: recreate `Summer_of_Opportunity_2026_vFinal.pptx` (93 slides).

> This plan was stress-tested by a 4-lens adversarial review (feasibility, completeness,
> usability, fidelity). Confirmed findings are folded in; §9 tracks each with a fix.

> **DECISION UPDATE (supersedes the figspec parts of §1/§1b/§1c/§4-2/§5 below).**
> Diagrams and annotated figures are **not** authored as JS figspecs. The **figure-maker
> generates them directly with python-pptx** as native-shape slides on the OI template; a
> **compose** step inserts them into the pptxgenjs-built, grafted deck at their outline
> positions. Verified clean: python-pptx opens the grafted deck and adds slides on the *same*
> OI layouts (no file-merge, no theme conflict). This **drops** the figspec JSON DSL,
> `oi_shapes.js` renderer, the JS reveal-`steps` engine, and the JS annotation-frame engine
> (multi-slide builds and callouts become plain Python that emits N slides / places shapes by
> math). It **adds** a `scripts/compose_deck.py` and a second builder (python-pptx). Diagram
> generators live at `decks/<p>/diagrams/*.py` (the script is the source of truth). Not chosen:
> unifying *everything* on python-pptx (drops the graft, but rewrites the whole builder).

---

## 0. What the target deck actually contains (measured)

93 slides, 13.33×7.5", Lucida Bright (titles) + Lucida Sans (body/labels), sizes clustering
at **12 / 16 / 20 / 22 / 24 pt** (note: **no 18 pt** — see §3). Census:

| Type | Count | Notes |
|------|------:|-------|
| 1-figure | 40 | **~20 carry native-shape annotation overlays** (arrows, highlight boxes, "$1K/31K Increase" callouts) |
| Text | 31 | includes **progressive-reveal builds**; the reg-tree build (28→31) is native shapes counted here |
| 2-figure | 15 | side-by-side comparisons, some with long (wrapping) panel titles |
| Table | 4 | "digital twin" comparison tables (spanning headers / highlighted cells, not a plain grid) |
| Native diagram | 1+ | editable PowerPoint shapes (e.g. slide 61) |
| 3-/5-figure | 2 | non-trivial arrangements (not a clean full grid) |

Two slides (2–3) are **high-density figure+overlay**: a figure under **60+ native text
labels** — fits none of the clean categories below (see §1, type 4).

**Decisive fact:** the deck layers *four* content types, each with a different natural
source of truth. The architecture follows from separating them and defining the coordinate
frame that binds overlays to figures.

---

## 1. Core decision: SVG vs. native shapes → **hybrid, by content type**

Everything is composed onto one slide **at build time** from declarative inputs, so there is
never a second PPTX to merge (this dissolves the "reconcile with the main deck" worry).

| # | Content type | Representation | Source of truth | Hand-editable? |
|---|---|---|---|---|
| 1 | Statistical figures (event studies, scatters, bars) | **SVG** (vector, cached PNG preview) | the R/Stata/JS script that made it | No — regenerate |
| 2 | Concept diagrams (reg tree, boosting schematic) | **native shapes** via `decks/<project>/figspecs/*.json` (per-deck, **generated on demand** — not a shared catalog) | the figspec JSON | Yes (back-port to JSON) |
| 3 | Annotations on figures ("$1K Increase" arrows/boxes) | **native shapes** in a normalized frame | deck script / edits YAML | Yes |
| 4 | **Figure + dense overlay** (slides 2–3, 60+ labels) | **raster/SVG layer + native shapes, one primitive** | figspec with an image layer | Yes (labels) |

Rule of thumb for the figure agent: *data plot → SVG; schematic → figspec; on-figure
callouts → annotations; figure with many editable labels → figure+overlay primitive.*

### 1a. The annotation coordinate frame (the linchpin — do this first)
Annotations **must not** be authored in slide inches. `addFigureSlide` letterboxes the
figure via `containInBox(box, aspect)` and re-centers it; the placed rect depends on the
figure's aspect **and** on whether a source line is shown (`SINGLE`→`SINGLE_SRC`). So any
absolute-inch overlay drifts off its bar the moment the SVG is re-exported or the source
line is toggled. Design:
- `addFigureSlide` **returns the computed image rect**; annotations are stored as
  `{xFrac, yFrac, wFrac, hFrac}` in **0..1 of the placed image** (optionally driven by a
  data→box mapping the plotting script emits as a sidecar JSON).
- Overlays are resolved to inches **at build time** against that rect, so they track the
  figure across aspect / box / source changes.
- **Pin the figure box under an annotated figure** (don't let `showSource` silently resize
  it), or recompute overlays against the post-toggle rect in the same pass.
- Every annotation has a **stable id** (`{id:'year_up_1k_arrow', ...}`) so an edit can target
  it (`nudge right` = a delta in the normalized frame — mechanically applicable, auditable).
- `check_style` asserts every resolved annotation lands inside the image rect.

### 1b. Progressive reveal needs **two** mechanisms (not one `steps` array)
- **Reveal-in-place** for a single diagram: a per-shape `step`/`revealAt` (+ `state:
  on|dim|highlight`) over **one figspec with a fixed canvas**, so geometry is identical
  across emitted slides and only visibility changes (reg tree 28→31; supports "grow" and
  "ghost/dim future nodes"). Authoring N separate specs is banned — it makes the root node
  jump between slides.
- **Sequence / figure-swap** for plotted or multi-content builds: an ordered list of
  figures/annotation-sets that vary text+figure together (boosting 32; Digital Twins 17→22
  is a 6-slide narrative, not one diagram; Year-Up-by-cohort 60→61 is an annotation reveal
  over a data figure).
- Both **emit N physical slides from one authoring unit** and push N entries into the layout
  tracker. Each emitted slide gets its **own stable id** (see §2) so expansion never
  renumbers earlier edit locators.

### 1c. Generated diagrams merge by reference (decided: main deck is generated)
Diagrams are one-offs created on demand, and the main deck is a generated `deck.js`/outline
— so **there is no .pptx splicing**. The generate→merge flow is:
1. figure-maker writes `decks/<project>/figspecs/<name>.json` (a schematic, possibly with
   reveal `steps`).
2. It inserts one entry into `decks/<project>/outline.md` at the requested position, e.g.
   `### BUILD: How a Regression Tree Works` + `- **Figspec**: <name>`.
3. Rebuild → the explainer renders **inline as native, editable shapes** in one consistent
   deck. Stable slide ids mean insertion renumbers nothing; there is never a second deck to
   reconcile. (A separate agent/session "creating then merging" still just does steps 1–2.)
If a main deck ever must remain a hand-built `.pptx` we don't regenerate, that would require
a real slide-splice feature — explicitly **out of scope** by this decision.

---

## 2. Foundations that must land before feature work (M0.5)

These are load-bearing prerequisites the review surfaced; feature milestones depend on them.

1. **Stable slide ids.** Every slide gets a string key in `deck.js`; edits locate by id
   (fallback: title substring), never by ordinal. Kills the "insert a slide → every `slide:
   32` edit now points at the wrong slide" failure and makes reveal-expansion safe.
2. **Speaker-notes preservation.** `graftOntoTemplate` currently **strips notes** (skips
   `notesSlides/`, drops `notesSlide` rels) → recreating vFinal loses 100% of presenter
   notes. Add a `notes` param to slide methods + `- **Notes**:` in the outline; have
   PptxGenJS emit notesSlides; make the graft **preserve/re-point** notesSlide rels; add a
   `notes` edit scope; assert notes survive the graft.
3. **Pin the toolchain.** v2 `package.json` says `pptxgenjs: ^3.12.0` but the graft was
   validated on **4.0.1** (resolved from the parent). Pin `pptxgenjs: 4.0.1`, commit a
   `package-lock.json`, add `engines`, and add a **smoke test** that builds a fixture and
   asserts the emitted XML still matches the graft's regex assumptions (svgBlip pair,
   self-closing rels) — so a version bump fails in CI, not on an RA's laptop.
4. **Preflight `doctor`.** Detect `@resvg`, and the render path. On Windows `soffice`/
   `pdftoppm` are absent — use **PowerPoint COM via PowerShell** for headless PNG export
   (proven to work on the target machine). `doctor` prints per-OS install/enable steps;
   visual QA **fails loudly or clearly marks itself SKIPPED**, never silently passes.
5. **Golden-deck regression harness + git hygiene.** Commit a `.gitignore` (caches,
   generated `*.pptx`, `~$` locks, render artifacts), track the v2 source, and commit a
   golden structural fingerprint of the recreated slice (slide count, per-slide shape/
   text-run census, frozen `check_style` report) with a diff harness wired to `npm test`,
   so builder refactors (the builder owns ALL styling) can't silently alter output. Add an
   edit **round-trip** test (apply edit, then a reverting edit → prior structural state).

---

## 3. Subtask 1 — Align the full OI style guide in `theme`

1. **Audit `theme` vs. the EOP guide AND measured vFinal**, producing a concrete
   **size-by-size diff table** before locking `guide2025`. Known discrepancy: builder renders
   sub-bullets and `(small)` at **18 pt**, but vFinal's cluster has no 18 — reconcile
   (likely 20) and stop `check_style` from whitelisting 18 unless a run is confirmed at 18.
2. **Parametrize every role** (title/subtitle/source/panel-title/bullet/subBullet/footnote/
   table) and every box (figure boxes per layout, subtitle Y, line weights, margins).
3. **Per-layout-family geometry.** The template ships two families (Title+Subtitle vs
   Title-only, each ±source) that bake the teal underline at **different Y**. The builder
   hardcodes one `titleBar/subtitleBar/titleUnderline` for all slides. Parse each
   `slideLayoutN.xml` underline/placeholder `<a:off>/<a:ext>` and **key the drawn boxes by
   the routed layout**, with a `check_style` assertion that the drawn title aligns to that
   layout's underline. (Note: pptxgenjs draws absolute boxes; it does not inherit placeholder
   geometry — the graft only makes the layout's baked chrome show. So we must read the layout
   XML to keep them in sync; this is not automatic.)
4. **Make `check_style` a real gate.** Today it checks only fonts + the title box + subtitle
   Y + on-slide bounds, misses run colors, ignores sizes ≤16 (rule `sz>16`), skips
   self-closed `<a:rPr/>`, and doesn't parse **tables (`graphicFrame`)** or **groups
   (`grpSp`)**. Extend to: geometry for every builder box (incl. `SINGLE_SRC`, panel titles,
   annotation frames), sizes whitelisted **both directions** (with a tolerance band for
   scaled figspec labels), colors vs palette, tables + groups. **Derive the checker's theme
   overrides mechanically** from the deck (emit a `deck.theme.json` sidecar on save) so an RA
   never hand-passes `--overrides` (today's false-failure trap). Regression-test the checker
   against a deliberately-broken fixture so the gate is proven to fail when it should.
5. **Flip `guide2025` to default** once Raj signs off (tracked in §10).

---

## 4. Subtask 2 — The four agents (extend the existing v2 set) + data contracts

```
Raj feedback ─▶ (1) edit-request-parser ─▶ edits/*.yaml ──┐
outline.md   ─▶ (3) deck-generator ◀── figspecs/ ◀─ (2) figure-maker
                     │  applies edits, routes layouts, composes overlays
                     ▼
                 deck.pptx ─▶ (4) style-checker ─▶ reports/  (structural + visual)
                     ▲───────── needs_clarification questions ──────────┘
```

### (1) edit-request-parser
- In: email / Slack / notes / marked-up `.pptx` (`extract_pptx_comments.js`) / PDF.
- Out: `edits/<date>_<source>_<n>.yaml` (verbatim preserved; scope + **stable locator**;
  `status: pending | needs_clarification`). Scope taxonomy adds `annotation`, `figure`,
  `notes`, `layout`.
- **needs_clarification answer loop** (today a dead-end): add an `answer:` field; RA answers
  in chat → re-invoke the parser on the **same** YAML to fill `answer:`, rewrite `proposed`
  concretely, flip to `pending`. RA never edits YAML by hand; one trigger phrase.
- **Multi-round model:** each entry has a stable id; an accumulated **applied-edits ledger**;
  `supersedes:`/`reverts:` links; **conflict detection** when two entries write the same
  theme/opts key → `needs_clarification`. Resolve references against the **actually-sent
  pptx** per round (numbering may differ from the working deck); strip quoted-reply/forward
  boilerplate.

### (2) figure-maker (JS · R · Python) — generative, per-deck, insert-by-reference
- **Generates a NEW diagram from an arbitrary NL request** ("explain a regression tree",
  "show how gradient boosting works") — it composes shape primitives to fit the request; it
  does **not** pick from a fixed library. Output lives in `decks/<project>/figspecs/`.
- Dual output: **figspec** (native shapes; reveal-capable) for schematics OR **generated
  SVG** via a saved R/Python/JS snippet for conceptual *charts* (e.g. boosting shown as
  shrinking residual curves is a plot, not a box-and-arrow). Picks the mode by task.
- **"Merge into the main deck" = a declarative insertion, not a splice** (see §1c): the agent
  writes the figspec and inserts one `### DIAGRAM:` / `### BUILD:` entry into the outline at
  the requested position; rebuild yields one consistent deck. Stable slide ids (M0.5) mean
  the insertion renumbers nothing.
- Ships an **icon library** and at least one **steps-enabled figspec** and one
  **figure+overlay** example before M3 depends on them.

### (3) deck-generator
- In: `outline.md` + `figures/` + pending edits. Does: writes content-only `deck.js`, routes
  each slide to the correct grafted layout, **composes annotation overlays in the normalized
  frame**, expands `### BUILD:` reveals, applies edits mechanically, builds, invokes (4).
- **Outline linter (`lint_outline.js`, step 0):** validates structure, checks every figure
  name resolves to a real file (**fuzzy "did you mean"**), pipe-column counts, reports errors
  **by line number**. `deck.fig()` throws naming the 3 closest files + the dir.

### (4) style-checker
- Structural (§3.4) + **mandatory visual pass** for annotated/multi-panel/table slides
  (render via COM/soffice; detect overlap/overflow/figure-covering-rule/misalignment).
  Plain-language report grouped by severity: what's wrong, which slide, likely-intentional?,
  blocking vs FYI, one next action. Header always matches the real filename.

---

## 4a. The outline is the single control surface (generation directives)

The outline MD declares both **existing** assets and **generation requests**, so the
deck-generator runs in **two passes**:

1. **Resolve/generate pass.** Scan the outline. Any slide with a `**Generate**:` field (or a
   `**Figure**/**Figspec**` name that resolves to nothing) is dispatched to **figure-maker**,
   which writes the asset into `decks/<project>/figspecs/` (diagram) or the figure dir (chart).
2. **Build pass.** All assets now exist → emit `deck.js` and build.

Syntax:
```markdown
### 1-FIGURE: …            - **Figure**: name          # reference existing (must resolve)
### DIAGRAM: …             - **Generate**: diagram — <NL spec>   [- **Save as**: name]
### BUILD: …               - **Generate**: diagram — <NL spec>   - **Reveal**: <rule>
### 1-FIGURE: …            - **Generate**: chart — <NL spec>     # SVG via R/Python/JS
```

Rules: presence of `**Generate**:` is the switch (else pure reference; a missing referenced
file is a linter error). Type hint `diagram|chart` routes native-shapes vs plotted SVG
(inferred if omitted). **Idempotent** — skip if the named asset exists unless
`**Generate (force)**`, so re-runs don't clobber a hand-tuned figspec. Ambiguous spec →
`needs_clarification`. Each generated asset records the prompt it came from (provenance).

## 5. Missing/weak layout primitives to build (fidelity)

- **Figure+overlay primitive** (type 4): raster/SVG background + native shapes in the same
  normalized frame; ideally an importer that lifts `<text>` out of an SVG into editable
  native labels (for slides 2–3). If deferred, **state explicitly** that editability doesn't
  apply to those slides — don't leave the gap silent.
- **Rich tables:** pre-styled rows with `colspan/rowspan`, per-cell fill/highlight, and a
  spanning group-header row (wire up the unused `groupLabel` style); extend the outline TABLE
  grammar. First confirm whether vFinal 23–24 are real tables or side-by-side "twin cards"
  (→ figure+overlay path).
- **N-figure layouts:** center a ragged final row; named arrangements (3-across, 3-as-1+2,
  5-as-3+2/2+3). Measure vFinal's actual 3-/5-figure arrangements before building.
- **Panel titles** grow with wrapped lines and re-flow the figure beneath; option to align
  side-by-side figures on their **plot areas** (matched source sizes or per-panel crop).

---

## 6. Figure sourcing, provenance & acceptance (resolve before M3)

- **Resolve open Q2 now:** define ONE `decks/<project>/figures/` drop location; document a
  "copy figures from Dropbox → here" step (vendor the SVGs with provenance rather than
  referencing a volatile Dropbox path). The outline linter cross-checks names against a
  manifest.
- **`figures/manifest.json`:** figure name → source SVG/script → data vintage → **content
  hash**. Fixes the "PRELIMINARY — DO NOT CITE / stale figure" risk.
- **Cache key fix:** builder cache is `basename+mtime` only → **collisions** across decks
  sharing a `cacheDir`, and wrong-resolution reuse (width not in key). Key on
  **content-hash(SVG) + rasterWidth + colorMap**, namespaced per figure dir.
- **Acceptance harness:** diff a rebuilt deck against vFinal (slide count, per-slide type,
  shape/text census) so "recreation" is measurable, not asserted.

---

## 7. The realistic edit round ("fake Raj" exercise)

1. **Recreate a representative slice** as `decks/soo2026/` (~10 slides): title · text · a
   1-figure event study · a 2-figure comparison · a table · the **reg-tree BUILD** · one
   **annotated "$1K Increase"** figure. Commit `outline.md` + generated `deck.js` + pptx as
   the canonical round-trip example (none exists today).
2. **Fake Raj emails**, each a different scope — and **fix the self-defeating test**: the
   arrow nudge and the source-line move are two rounds (or the figure box is pinned) so the
   overlay doesn't break when the figure moves:
   - deck: "every subtitle one size smaller; use guide2025."
   - annotation: "the $1K arrow points at the wrong bar; nudge it right" (targets a stable
     annotation id, expressed as a normalized-frame delta).
   - content: "relabel 'Treatment' → 'Year Up participants'; add a WGU-vs-Dallas slide"
     (insert via stable id, no renumbering).
   - ambiguous: "the tree slide feels off" → must produce a `needs_clarification` question.
   - **round 2** on top of round 1 (e.g. "put subtitles back") to exercise supersession.
3. Run parser → YAML → apply → QA; show the **audit trail** (one commit per round bundling
   verbatim YAML + `deck.js` diff + change report). Feed friction back into the schema/parser.
4. **A real RA completes one full round unaided** is an explicit success criterion (moves the
   1-page RA guide earlier — see §8).

---

## 8. Packaging & UX for non-technical staff (make chat the default path)

- **Pick one model:** the RA **talks to Claude** ("build the soo2026 deck", "apply Raj's
  email", "answer the open questions: …", "what's the state of the soo2026 edits?"). Terminal
  use is documented as developer-only (avoids the fragile PowerShell `-- --preset`
  passthrough). deck-generator **auto-adds** the per-deck npm script; a generic
  `npm run build -- decks/soo2026` needs no per-deck edit.
- **Friendly failures:** top-level handler prints ONE plain line (missing figure X in dir Y;
  outline line N; unresolved edit) and suppresses stack traces.
- **Hand-edit guardrails** (people WILL edit in PowerPoint): stamp generated decks with a
  visible "Generated — edits here are overwritten on rebuild; change the outline/figspec"
  note; before rebuild, if the pptx is newer than its sources, **warn** "hand edits will be
  lost — continue?"; offer a comment round-trip so hand-edits can be re-captured as edits.
- **Edit-state overview & validation:** `validate_edits.js` (plain-language YAML errors, run
  first); a "what's pending / unanswered / applied" summary across all YAMLs; disambiguate
  same-day rounds with a counter suffix.
- **Ship the 1-page RA guide before M4**, not at M6.

---

## 9. Milestones (revised)

| # | Milestone | Output |
|---|-----------|--------|
| M0 ✅ | Template-layout grafting | slides use real OI named layouts; source-rule fix |
| **M0.5** | **Foundations (§2)** | ✅ notes preserved in graft (+ `opts.notes` API) · ✅ pinned pptxgenjs 4.0.1 + lockfile · TODO: stable slide ids · smoke test · `doctor` (COM render on Windows) · `.gitignore` + golden-deck harness |
| M1 | Style-guide alignment (§3) | size-by-size diff table; per-layout geometry; `check_style` covers tables/groups/colors/all boxes; overrides from `deck.theme.json`; guide2025 complete |
| M2 | Annotation frame + reveal (§1a/1b) | normalized overlay frame + ids; reveal-in-place + sequence; `### BUILD:` outline construct |
| M3 | Recreate vFinal slice `decks/soo2026/` (§6,§7.1) | ~10 faithful slides incl. tree BUILD + annotated figure; figure manifest; acceptance diff |
| M4 | Fake-Raj round incl. round 2 (§7) | applied edits + audit trail; needs_clarification loop; supersession; **an RA drives it unaided** |
| M5 | Missing primitives (§5) + figure-maker dual-mode (§4-2) | figure+overlay, rich tables, N-figure layouts, icons |
| M6 | Packaging & docs (§8) | chat-first UX; friendly errors; guardrails; RA guide (partly pulled earlier) |

---

## 10. Decisions & open questions

**Decided (this round):**
- ✅ **Scope: representative slice first** (~10 slides), then decide on the full 93.
- ✅ **Figures: reference the Dropbox folder** via `--fig-dir` for now (no vendoring yet).
  Caveat (review): this is volatile/non-portable and unversioned — a `figures/manifest.json`
  with content hashes is deferred, not free; revisit before any full-93 pass.
- ✅ **Diagrams are generated on demand and merge by reference** into the generated deck
  (§1c) — per-deck figspecs, no .pptx splicing. A hand-built-.pptx splice feature is out of
  scope.

**Still open (need Raj / user):**
1. Make `guide2025` the default style? (currently opt-in)
2. Hand-edit policy: figspec/outline wins on rebuild (recommended) + guardrails, vs. treat a
   hand-edited pptx as source?
3. Do we need **animated** figures (JS→GIF/MP4) for talks, or slides only?
