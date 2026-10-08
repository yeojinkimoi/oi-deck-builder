# MY_DECK

Numbers in `{{...}}` come from `facts*.json` in the figure directory, written
by the Stata that drew the figures. Never type a number here.

`{{key}}` gives the rendered string ("$14K"); `{{key.value}}` gives the raw
number (14320). A `{{key}}` with no matching fact is a build error, not a
silent blank.

## Deck Settings

Set a numbered title format and most slides write themselves. An explicit
Title or Subtitle always wins, so any slide can opt out.

- **Program**: MY_PROGRAM
- **Title format**: 1
- **Figure title format**: 2

FORMAT 1 (the front slide)
    The Impacts of {Program} Programs on Earnings
    Preliminary Estimates Using {Comparison}

FORMAT 2 (one figure per program/panel)
    Impact of {Program} on Earnings: {Panel}
    {Program} Enrollees who {Cohort} vs. {Comparison} -- {{fact}} {Effect word}

Optional, with these defaults:
    Comparison  = Digital Twins
    Effect word = Increase
    Effect fact = te_yr5      (key prefix; the panel comes from the figure name)

To override, add `- **Title**:` and `- **Subtitle**:` here; an explicit value
always wins over the format. Leave them out to let format 1 write them.

- **Date**: Month Year
- **Notice**: PRELIMINARY DATA -- DO NOT CITE
- **Figure directory**: ./figures
- **Output**: ./MyDeck.pptx

## Slides

### Slide 1 — TITLE SLIDE: Deck Title

### Slide 2 — TEXT: Section Heading
- Top-level bullet
  - Sub-bullet
  - Sub-bullet in smaller type (small)
- 1. Numbered item
- **Notes**: Speaker notes for this slide.

### Slide 3 — 1-FIGURE:
- **Panel**: My Panel Name
- **Figure**: my_panel_event_study
- **Notes**: Speaker notes.

Title and subtitle come from format 2. Cohort defaults to "Graduate" --
override per slide with `- **Cohort**: Leave`. The fact key is derived from
the figure name (minus _event_study); set `- **Fact**: none` to omit the
number, or name a different key.

### Slide 3b — 1-FIGURE: A Hand-Written Title Instead
- **Subtitle**: Written out, so format 2 leaves this slide alone
- **Figure**: my_panel_event_study

### Slide 4 — 2-FIGURE: Two Panels
- **Subtitle**: Subtitle
- **Left**: left_figure | Left Panel Title
- **Right**: right_figure | Right Panel Title

### Slide 5 — 3-FIGURE: Three Panels
- **Subtitle**: Subtitle
- **Top center**: top_figure | Top Panel
- **Bottom left**: bl_figure | Bottom Left
- **Bottom right**: br_figure | Bottom Right

### Slide 6 — 4-FIGURE: Four Panels
- **Subtitle**: Subtitle
- **Top left**: tl_figure | Top Left
- **Top right**: tr_figure | Top Right
- **Bottom left**: bl_figure | Bottom Left
- **Bottom right**: br_figure | Bottom Right

### Slide 7 — TABLE: Table Title
- **Subtitle**: Subtitle
- **Columns**: Col A, Col B, Col C
- **Rows**:
  - a1 | b1 | c1
  - a2 | b2 | c2
- **Footnote**: Footnote text.
