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

Install once:

```bash
cd /path/to/oi-deck-builder
npm ci
npm link            # puts `oi-deck` on your PATH
```

Then **everything happens inside the deck folder**. Nothing points back at the
package:

```bash
cd ".../Slides/TSTC_oct2026"
oi-deck new "TSTC Oct 2026"    # scaffolds pipeline.yaml, outline.md, code/figures.do
oi-deck run
```

A deck folder holds all of it:

```
Slides/TSTC_oct2026/
├── pipeline.yaml       the DAG
├── outline.md          slide titles, subtitles, {{facts}}
├── code/               prepare_data.do, generate_figs.do, ...
├── data/               .dta, .csv
├── figures/            .svg + facts.json
├── deck.js             generated, committed as the audit trail
└── TSTC_deck.pptx      output
```

Stata needs two machine-specific globals in your `profile.do`; everything else
comes from the tracked `workforce-training/ado/oi_setup.do`:

```stata
global workforce_github "C:/path/to/workforce-training"
global dropbox          "C:/path/to/Dropbox/Research files"
```

## Commands

Run these from inside a deck folder.

| | |
|---|---|
| `oi-deck new [Name]` | scaffold a deck here |
| `oi-deck run` | run the DAG, skipping fresh steps |
| `oi-deck run --dry-run` | show what would run |
| `oi-deck run --force` | run everything |
| `oi-deck run --only figures` | one step |
| `oi-deck lint` | parse and validate outline.md, build nothing |
| `oi-deck check` | style report on the built deck |
| `oi-deck fingerprint` | structural fingerprint, for regression diffs |
| `oi-deck where` | where the package is installed |

Set `OI_STATA` if Stata is somewhere unusual; otherwise it is auto-detected.

## pipeline.yaml — optional

**A standard deck does not need one.** `code/figures.do` then `outline.md` is
already implied by the folder layout, so `oi-deck run` infers it:

```
order: figures -> deck   (implied; no pipeline.yaml)
```

The disclosure is discovered from the `local release "..."` line in
figures.do, resolved against the nearest `Disclosures/` above the deck, so
changing the release still triggers a rebuild.

Write an explicit spec (`oi-deck new <Name> --pipeline`) only when a deck
deviates — an extra cleaning step, a ROI calculation, a second do-file, a
figure directory elsewhere:

```yaml
deck: tstc_oct2026
steps:
  - id:  clean
    run: stata code/prepare_data.do
    in:  [../../Disclosures/sep2026/release.xlsx, code/prepare_data.do]
    out: [data/panel.dta]
  - id:  figures
    run: stata code/generate_figs.do
    in:  [data/panel.dta, code/generate_figs.do]
    out: ["figures/*.svg", figures/facts.json]
```

Edges are **inferred** from the `in`/`out` lists — there is no `needs:` key to
keep in sync. A step reruns when an output is missing, an input is newer than
an output, or a step it depends on reran. Paths are relative to the deck.

`run:` verbs:

| verb | |
|---|---|
| `stata <file.do>` | batch Stata |
| `oi-outline <args>` | the outline → deck.js → .pptx step |
| `oi-check <deck>` | style report |
| `node <script>` | plain node |
| anything else | through the shell |

The `oi-*` verbs are provided by the package, so a deck's spec never contains
a path to wherever the package is installed.

Batch Stata **exits 0 even when the do-file errored**, so the `stata` verb also
greps the log for `r(NNN);` and fails the step on a hit. Never call Stata from
a raw shell step for this reason.

## The data-source slide

A provenance slide is inserted automatically straight after the title slide:

```
Data Source
  Figures in this deck are generated from:
    sep2026_for_release_T13_T26.xlsx
    sheet: tstc_es
```

The filename comes from **what the reader actually read**, not from anything
typed in the outline — `oi_use_disclosure` records `source.workbook`,
`source.sheet`, `source.statistic` and `source.rows` as facts on every run. A
deck therefore cannot name a release it was not built from.

The slide shows the **workbook and sheet only**. `source.statistic` and
`source.rows` describe how the sheet was read rather than where the deck came
from, so they stay in `facts.json` for an appendix slide to quote with
`{{source.statistic}}` / `{{source.rows}}`.

Suppress it with `- **Source slide**: no`, or retitle it with
`- **Source slide title**: Data and Disclosure`.

**If your deck reads the disclosure in a separate step** (a `clean` step that
writes a `.dta`, as TSTC does), that step runs in its own Stata session, so it
has to write the provenance out itself:

```stata
oi_facts_clear
oi_use_disclosure using "...", sheet(...)
oi_facts_save using "${figures}/facts_source.json", replace
```

The deck builder merges every `facts*.json` in the figure directory, so it
joins up with the facts the figures step writes. Decks that read the
disclosure directly in `figures.do` — the template default — get this for free.

## Title formats

Numbered conventions, chosen once in Deck Settings, so a per-program deck does
not retype the same sentence on every slide:

```markdown
- **Program**: TSTC
- **Title format**: 1
- **Figure title format**: 2
```

| | renders |
|---|---|
| **1** front slide | `The Impacts of TSTC Programs on Earnings` / `Preliminary Estimates Using Digital Twins` |
| **2** figure slide | `Impact of TSTC on Earnings: {Panel}` / `TSTC Enrollees who {Cohort} vs. Digital Twins` |

A figure slide then supplies only what varies:

```markdown
### Slide 3 — 1-FIGURE:
- **Panel**: Construction Certificate
- **Figure**: cert_construction_graduate_event_study
```

`Cohort` defaults to `Graduate` and can be set deck-wide or per slide
(`- **Cohort**: Leave`).

**The year-5 effect is not in the subtitle by default.** The same number on
every slide reads as noise. Turn it on deck-wide with `- **Show effect**: yes`
or per slide with `- **Fact**: <key>`; the key is then derived from the figure
name — `cert_construction_graduate_event_study` becomes
`te_yr5.cert_construction_graduate` — so it is still read from facts.json,
never typed.

Overridable defaults: `Cohort` (Graduate), `Comparison` (Digital Twins),
`Show effect` (no), `Effect word` (Increase), `Effect fact` (te_yr5). An
explicit `Title:` or `Subtitle:` always wins.

## The title slide

The front page is **plain by default**: white, the title block right-aligned at
y=2.25, 32pt bold Lucida Bright over a 24pt Lucida Bright subtitle, the date
and notice at 12pt bold, and the full OI logo bottom-right.

The photographic front page -- the template's own Intro layout, with the crowd
photo, the white band and the logo band, title at y=4.94 -- is the opt-in:

```markdown
- **Intro background**: photo
```

Accepted values are `plain` (the default), `white` (a synonym for `plain`) and
`photo`. Anything else fails the build rather than quietly giving you the
default: the two front pages look nothing alike, so rendering the wrong one in
silence is worse than stopping.

How the plain one is built, for anyone reading the XML later: all five template
layouts draw chrome of their own, so the plain title slide sits on the leanest
of them (`1_OI Theme: Title - No Subtitle, no Source Footer`) with
`showMasterSp="0"` -- PowerPoint's *Hide Background Graphics* -- set on that one
slide, plus an explicit white background. No layout is added to the deck, and
every other slide on that same layout keeps its teal rule and corner logo.

A hand-written deck.js takes the same choice as a constructor option:

```js
new OIDeckBuilder({ introBackground: "photo" })
```

**One slide per panel.** A combined multi-panel slide or a summary table is
something to add deliberately, when asked for — not a default.

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
