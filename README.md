# oi-slide

Generate PowerPoint slide decks in the Opportunity Insights house style. Write a simple outline in Markdown, hand it to Claude, and get a polished `.pptx` deck with consistent branding, figure placement, and typography.

Built on [PptxGenJS](https://gitbrent.github.io/PptxGenJS/).

## How it works

1. **Write an outline** in Markdown describing your slides (text, figures, tables)
2. **Give the outline to Claude** (Claude Code, claude.ai, or any Claude-powered tool)
3. **Claude generates a deck script** (`my_deck.js`) using the `oi_deck_builder` API
4. **Run the script** to produce your `.pptx`

Claude reads the `CLAUDE.md` file in this repo to understand the full API and outline format. You don't need to learn the API yourself.

## Quick start

### 1. Prerequisites

You need **Node.js** installed on your machine. Download it from [nodejs.org](https://nodejs.org/) (the LTS version is recommended). This also installs `npm`, the package manager.

To verify it's installed:

```bash
node --version
npm --version
```

### 2. Install dependencies

```bash
cd oi-slide
npm install
```

This downloads the required packages (`pptxgenjs` for PowerPoint generation, `@resvg/resvg-js` for SVG rasterization).

### 3. Write your outline

Create a Markdown file following the template in `example/outline_template.md`:

```markdown
## Deck Settings

- **Title**: My Research Findings
- **Subtitle**: Preliminary Results
- **Date**: April 2026
- **Figure directory**: ./figures
- **Output**: ./MyDeck.pptx

## Slides

### TEXT: Data and Methods
- We use administrative data linked to tax records
  - 500,000 individuals in our sample
  - Earnings observed from 2010-2024
- Primary outcome: W-2 earnings in real 2021 dollars

### 1-FIGURE: Main Results
- **Subtitle**: Treatment vs. Control Group Earnings
- **Figure**: event_study_main

### 2-FIGURE: Graduates vs. Withdrawers
- **Subtitle**: 3 Years After Enrollment
- **Left**: grad_delta | Graduates
- **Right**: wd_delta | Withdrawers

### TEXT: Conclusions
1. Program increases earnings by $4,200 per year
2. Effects persist 5+ years after enrollment
  - Driven primarily by increased employment rates
```

### 4. Give it to Claude

Open Claude Code in the project directory and say:

> Build a deck script from my outline at `example/my_outline.md`. Put figures in `example/figures/` and output to `example/MyDeck.pptx`.

Claude will generate a `my_deck.js` script using the builder API.

### 5. Run

```bash
node example/my_deck.js
```

Your `.pptx` is ready.

## Outline format

Full reference is in `example/outline_template.md`. Here's a summary:

### Slide types

| Type | Description |
|------|-------------|
| `TEXT` | Bulleted text slide |
| `TABLE` | Table with headers and rows |
| `1-FIGURE` | Single centered figure |
| `2-FIGURE` | Two figures side by side |
| `3-FIGURE` | One on top, two on bottom |
| `4-FIGURE` | 2x2 grid |

### Text formatting

```markdown
### TEXT: Slide Title
- Top-level bullet (22pt)
  - Sub-bullet (18pt, indented)
  - Another sub-bullet with smaller font (small)
- Another main point
1. Numbered item
2. Another numbered item
```

- Top-level bullets: `- text`
- Sub-bullets: `  - text` (indented)
- `(small)` suffix forces 18pt font
- `1.` / `2.` for numbered lists

### Figure slides

```markdown
### 2-FIGURE: Title
- **Subtitle**: Description
- **Left**: figure_name | Panel Title
- **Right**: figure_name | Panel Title
```

Figure names are filenames without extension. The builder auto-detects `.svg` (rasterized to high-res cached PNG) or `.png` in your figure directory.

### Tables

```markdown
### TABLE: Title
- **Subtitle**: Optional subtitle
- **Columns**: Col1, Col2, Col3
- **Rows**:
  - Val1 | Val2 | Val3
  - Val4 | Val5 | Val6
- **Footnote**: Optional footnote text.
```

## Example

See `example/wgu_deck.js` and `example/outline_template.md` for a complete real-world deck with text slides, tables, single/multi-panel figures, and 3-panel layouts.

```bash
node example/wgu_deck.js
```

## CLI arguments

All deck scripts support these flags:

```
--fig-dir ./path      Override figure directory
--output  ./out.pptx  Override output file
--cache-dir ./cache   Override PNG cache directory
--raster-width 3200   Override SVG->PNG raster width (default: 2400)
```

## Figure workflow

1. Export figures as `.svg` or `.png` into your figure directory
2. The builder auto-detects the best format (prefers SVG)
3. SVGs are rasterized to high-res PNGs and cached -- only re-rendered when the source changes
4. All figures are aspect-ratio-preserving fitted into their placement box

No manual image conversion needed.

## OI house style

The builder enforces consistent branding automatically:

- **Colors**: OI teal (`#29B6A4`), orange (`#FAA523`), navy (`#003A4F`)
- **Fonts**: Lucida Bright (titles), Arial (body), Lucida Sans (labels/subtitles)
- **Layout**: Widescreen 13.33" x 7.50" slides
- **Bullets**: OI teal colored bullet characters and numbers
- **Tables**: Teal header row, alternating gray shading
- **Logos**: OI logo on title slide and bottom-right of content slides

## For developers

The full API reference is in `CLAUDE.md`. If you want to write deck scripts by hand (without Claude), that file documents every method, parameter, and default value.
