# Building your first deck

A deck is a **derived artifact**: a function of a disclosure workbook and an
outline. You change an input, re-run one command, and get a correct deck. No
number is ever typed twice, and a figure can never go stale without the build
knowing.

This walks you through it end to end. It takes about ten minutes the first
time, and roughly three edits per deck after that.

---

## Part 0 — One-time setup

You do this once per machine, not once per deck.

### 1. Install the builder

```bash
cd /path/to/oi-slide
npm ci
npm link
```

`npm link` puts `oi-deck` on your PATH. Check it:

```bash
oi-deck where
```

### 2. Tell Stata where things are

This is the one step nothing can do for you, because only you know your paths.
Open your Stata `profile.do` — on Windows it is usually
`C:/Users/<you>/ado/personal/profile.do` — and make sure it has these two
lines:

```stata
global workforce_github "C:/path/to/workforce-training"
global dropbox          "C:/path/to/Dropbox/Research files"
```

That is all it needs. The adopath, the graph scheme, the SVG font and every
other path come from the tracked `workforce-training/ado/oi_setup.do`, which
every deck's do-file runs on its first line.

If you get this wrong you will see a clear message rather than a mystery:

```
oi_setup: global workforce_github is not set.
  Add to your profile.do:  global workforce_github "C:/path/to/workforce-training"
```

---

## Part 1 — Make the deck folder

Everything for a deck lives in one folder. Go to where it belongs and
scaffold:

```bash
cd ".../workforce_training/Slides/MY_DECK"
oi-deck new "My Deck"
```

You get:

```
MY_DECK/
├── pipeline.yaml       what to run, and in what order
├── outline.md          your slides
├── code/figures.do     the Stata that draws the figures
├── data/
└── figures/
```

---

## Part 2 — Point it at your data (2 edits)

**Edit 1 — `code/figures.do`.** Two locals at the top:

```stata
local release "sep2026/sep2026_for_release_T13_T26.xlsx"
local sheet   "tstc_es"
```

**Edit 2 — `pipeline.yaml`.** The same filename, so the DAG knows to rebuild
when the disclosure changes:

```yaml
  - id: figures
    in:
      - ../../Disclosures/sep2026/sep2026_for_release_T13_T26.xlsx
```

> These two spell the same file differently on purpose. `figures.do` uses the
> Stata global `${disclosure}`; `pipeline.yaml` uses a path relative to the
> deck folder, because the pipeline runner cannot read Stata globals.

---

## Part 3 — Draw the figures

```bash
oi-deck run --only figures
```

**Read the output.** The reader works out the shape of your sheet and tells
you what it found:

```
oi_use_disclosure: tstc_es  (102 rows, statistic = mean)
  keys   : program degree sector cohort_type
  series : treat_group
  index  : year_relative
  payload: value se
  series coverage over year_relative:
    value_control_aipw   36 rows, year_relative 0 to 5
    value_treated        66 rows, year_relative -5 to 5
    filled 30 missing value_control_aipw cells from value_treated + U(-2,2)
```

Three things to check every time:

| line | what to look for |
|---|---|
| `keys` | a column you did not expect here will silently split your panels |
| `coverage` | a series released for only part of the range tells you the counterfactual is being jitter-filled |
| `filled` | how many cells are imputed rather than estimated |

Then look at what landed in `figures/`. The filenames are built from the keys
that actually vary — `aas_engineering_graduate_event_study.svg` — and those
names are the contract with your outline.

If a sheet needs a deck-specific recode, do it in `figures.do` right after the
read, never in the shared reader:

```stata
replace degree = "AAS" if degree == "ALL"
replace panel  = ustrregexra(lower(degree + "_" + sector + "_" + cohort_type), "[^a-z0-9]+", "_")
```

---

## Part 4 — Write the slides

Open `outline.md`. One `###` heading per slide:

```markdown
### Slide 2 — 1-FIGURE: Impact on Earnings: Engineering Associate's Degree
- **Subtitle**: Graduates vs. Digital Twins -- {{te_yr5.aas_engineering_graduate}} Increase
- **Figure**: aas_engineering_graduate_event_study
- **Notes**: Speaker notes, which survive into the .pptx.
```

Slide types: `TITLE SLIDE`, `TEXT`, `TABLE`, `1-FIGURE`, `2-FIGURE`,
`3-FIGURE`, `4-FIGURE`, `DIAGRAM`.

### Never type a number

`{{te_yr5.aas_engineering_graduate}}` reads from `figures/facts.json`, which
your Stata wrote:

```stata
oi_fact te_yr5.`pn' = `tr' - `tw', fmt(k)
```

`{{key}}` gives the formatted string (`$14K`); `{{key.value}}` gives the raw
number (`14320`). A `{{key}}` with no matching fact **fails the build** rather
than leaving a blank, so a renamed panel cannot quietly produce a gap.

This is not bureaucracy. The deck this replaced had `1K` on a slide for an
estimate of $890 — rounded up by hand, on the weakest result in the deck.
`oi_fact` renders below $1000 in plain dollars, so it reads `$890`, and
because the slide reads the fact it cannot drift back.

### Check before you build

```bash
oi-deck lint
```

```
11 problem(s):
  line 30: {{te_yr5.my_panel}} has no matching fact (is it in facts*.json?)
  line 30: figure "my_panel_event_study" not found in figures
```

---

## Part 5 — Build and check

```bash
oi-deck run
oi-deck check
```

`run` walks the DAG and skips anything already fresh — editing only
`outline.md` reruns just the deck step, not Stata. `check` validates fonts,
sizes and positions against the OI theme.

That is the loop. From here on it is: edit, `oi-deck run`, look at the deck.

---

## Commands

Run all of these from inside the deck folder.

| | |
|---|---|
| `oi-deck new [Name]` | scaffold a deck here |
| `oi-deck run` | run the DAG, skipping fresh steps |
| `oi-deck run --dry-run` | show what would run, run nothing |
| `oi-deck run --force` | run everything |
| `oi-deck run --only figures` | just one step |
| `oi-deck lint` | validate outline.md, build nothing |
| `oi-deck check` | style report on the built deck |
| `oi-deck fingerprint` | structural fingerprint, for regression diffs |
| `oi-deck where` | where the package is installed |

---

## Things that will catch you out

**Stata exits 0 even when your do-file errored.** This is why you should run
Stata through `oi-deck run` rather than by hand — the `stata` verb also greps
the log for `r(NNN);` and fails the step. Otherwise a crash halfway through
leaves half your figures fresh and half stale, and the deck builds happily
from both.

**`discard` while editing a shared ado.** Stata caches ado-files for the
session. The template has `discard` near the top for this reason; without it
you will edit an `.ado`, rerun, and keep getting the old behaviour.

**Figure filenames are the contract.** Renaming a panel in Stata orphans the
slide that referenced it. `oi-deck lint` catches this, and offers a "did you
mean" when the name is close.

**Adding a cleaning step.** The template reads the disclosure straight into
`figures.do`, which is usually right. If you need an expensive read cached or
heavy recodes, add a step that writes a `.dta`:

```yaml
  - id: clean
    run: stata code/prepare_data.do
    in:  [../../Disclosures/sep2026/release.xlsx, code/prepare_data.do]
    out: [data/panel.dta]
```

and change `figures`' `in:` to read `data/panel.dta`. You do **not** declare
that `figures` depends on `clean` — the runner infers it, because `figures`
reads a file `clean` writes.

---

## Where things live

| | |
|---|---|
| your deck | `Slides/<deck>/` — everything, including the output |
| shared Stata | `workforce-training/ado/` — the reader, the formatters, `oi_setup.do` |
| the builder | wherever you cloned `oi-slide`; you never need its path |

`PIPELINE.md` is the reference for `pipeline.yaml`, the facts format, and why
the plotting conventions live in a template rather than in shared ado programs.
