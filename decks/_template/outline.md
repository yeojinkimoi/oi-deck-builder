# MY_DECK

Numbers in `{{...}}` come from `facts*.json` in the figure directory, written
by the Stata that drew the figures. Never type a number here.

`{{key}}` gives the rendered string ("$14K"); `{{key.value}}` gives the raw
number (14320). A `{{key}}` with no matching fact is a build error, not a
silent blank.

## Deck Settings

- **Title**: Deck Title
- **Subtitle**: Deck Subtitle
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

### Slide 3 — 1-FIGURE: Figure Slide Title
- **Subtitle**: What the figure shows -- {{te_yr5.my_panel}} increase
- **Figure**: my_panel_event_study
- **Notes**: Speaker notes.

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
