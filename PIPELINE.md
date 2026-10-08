# The deck pipeline

Disclosure workbook → clean data → figures + facts → slides, as a DAG that
reruns only what is stale.

```
Disclosures/<release>.xlsx
        │  oi_use_disclosure   (schema inferred)
        ▼
  data/panel.dta
        │  figures.do          (twoway + oi_fact)
        ▼
  figures/*.svg  +  figures/facts.json
        │  outline_to_deck.js  ({{facts}} interpolated)
        ▼
  deck.js  →  MyDeck.pptx
        │  check_style.js
        ▼
     report
```

## Quick start

```bash
npm ci
cp -r decks/_template decks/my_deck      # edit pipeline.yaml, outline.md, figures.do
npm run pipeline decks/my_deck
```

Stata needs two machine-specific globals in your `profile.do`; everything else
comes from the tracked `workforce-training/ado/oi_setup.do`:

```stata
global workforce_github "C:/path/to/workforce-training"
global dropbox          "C:/path/to/Dropbox/Research files"
```

## Commands

| | |
|---|---|
| `npm run pipeline decks/<d>` | run the DAG, skipping fresh steps |
| `npm run pipeline decks/<d> -- --dry-run` | show what would run |
| `npm run pipeline decks/<d> -- --force` | run everything |
| `npm run pipeline decks/<d> -- --only figures` | one step |
| `npm run outline decks/<d>/outline.md -- --lint` | parse and validate, build nothing |
| `npm run check decks/<d>/MyDeck.pptx` | style report |
| `npm run fingerprint <deck.pptx>` | structural fingerprint, for regression diffs |

Set `OI_STATA` if Stata is somewhere unusual; otherwise it is auto-detected.

## pipeline.yaml

Edges are **inferred** from the `in`/`out` lists — there is no `needs:` key to
keep in sync. A step reruns when an output is missing, an input is newer than
an output, or a step it depends on reran.

```yaml
deck: my_deck
vars:
  src: "C:/path/to/Dropbox/.../Slides/MY_DECK"
steps:
  - id:  figures
    run: stata "${src}/code/figures.do"
    in:  ["${src}/data/panel.dta", "${src}/code/figures.do"]
    out: ["${src}/figures/*.svg", "${src}/figures/facts.json"]
```

`${name}` is substituted from `vars:`, falling back to the environment. This is
how a deck whose Stata and figures live in Dropbox, while its outline and
deck.js live here, writes paths that reach both. **Quote any path containing
`${}`** — OI paths sit under "Opportunity Insights Dropbox" and an unquoted
path would be split on its spaces.

`run:` verbs: `stata <file.do>`, `node <script>`, or anything else through the
shell. Batch Stata **exits 0 even when the do-file errored**, so the Stata verb
also greps the log for `r(NNN);` and fails the step on a hit. Never call Stata
from a raw shell step for this reason.

## outline.md → deck

`outline_to_deck.js` parses the outline, emits `deck.js` (committed, the audit
trail), and runs it. It handles the deterministic subset — TITLE SLIDE, TEXT,
TABLE, 1/2/3/4-FIGURE, DIAGRAM, plus `**Notes**:` — and exits with
`UNSUPPORTED: line N` on anything else rather than emitting a partial deck.
The `deck-generator` agent takes over for those.

A parser rather than an LLM because across the six real outlines in this repo
**149 of 150 slide headings already conform** to the documented grammar. A
deterministic build is also what removes the class of error where a subtitle is
copied from the slide above and never updated.

Missing figures fail the build. Pass `--draft` to skip those slides and get a
report instead.

## Facts: no number typed twice

Stata records every number a slide will quote, next to the code that computed
it:

```stata
oi_fact te_yr5.engineering_aas = `tr' - `tw', fmt(k)
oi_facts_save using "${figures}/facts.json", replace
```

The outline interpolates them:

```markdown
- **Subtitle**: Graduates vs. Digital Twins -- {{te_yr5.engineering_aas}} Increase
```

`{{key}}` gives the rendered string (`$14K`); `{{key.value}}` gives the raw
number. A `{{key}}` with no matching fact is a build error, not a blank. Every
`facts*.json` in the figure directory is merged, so separate Stata sessions can
each contribute.

Rendering follows `dollar_labs`' rule: **below $1000, plain dollars**. TSTC's IT
estimate is $890; rounding it to "$1K" on a slide overstates the weakest result
in the deck, which is exactly what the hand-built version did.

## Why there is no `oi_event_study.ado`

Six shared plotting helpers were planned. Measuring what they would actually
remove from a real 254-line `generate_figs.do`:

| block | sites | lines |
|---|---:|---:|
| `common_opts` | 1 | 5 |
| `plotopts_mean` | 2 | 8 |
| `vlines` | 2 | 8 |
| phantom legend keys | 6 | 6 |
| `legend_opts` | 2 | 3 |

Within a deck these are already collapsed into locals, so an ado saves about
five lines per deck while adding an interface and the `c_local` nested-quote
hazard that bites on strings like `ylabel(-5000 "-$5K" ...)`. And figures vary
too much — progressive `color(none)` builds, overlay panels, CI caps on/off,
five different `xsize`/`ysize` pairs — for one command to cover them without
becoming option soup.

The cross-deck duplication those helpers targeted was a **version-control
failure**: deck code was untracked where it lived and hand-copied between two
clones. That is fixed by tracking `Slides/*/code/`.

So the plotting conventions live in `decks/_template/figures.do`, inline and
commented, to be copied and adapted. What is shared is everything that is data
or arithmetic rather than a `twoway` option:

| in `workforce-training/ado` | |
|---|---|
| `oi_setup.do` | adopath, scheme, SVG fontface, path globals |
| `oi_use_disclosure` | tidy sheet → wide panel, schema inferred |
| `generate_clean_axis` | clean ticks, padded ranges |
| `dollar_labs` / `dollar_str` | `$K` axis specs / per-observation labels |
| `oi_export` | `graph export` fan-out |
| `oi_fact` / `_save` / `_clear` | slide numbers → facts.json |

`oi_setup.do` also **pins the scheme**: Stata resolves `scheme-<name>.scheme`
on the adopath and `adopath ++` prepends, so the tracked copy wins over any
local install. This matters — the copy that was sitting in this repo had
drifted from the installed one in `graphsize`, `axis_title`, `tick_label`,
`symbolsize` and `margin`.
