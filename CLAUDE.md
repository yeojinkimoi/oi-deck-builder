# oi-slide: OI Deck Builder

This project generates PowerPoint (.pptx) slide decks in the Opportunity Insights house style. All styling, layout, colors, fonts, and figure placement are handled by `oi_deck_builder.js`. Project-specific decks (like `example/wgu_deck.js`) only contain content -- slide titles, text, figure names, and table data.

## How to build a deck from an outline

When a user gives you an `outline_template.md` and a figure directory, generate a `my_deck.js` script following the pattern in `example/wgu_deck.js`. The outline format is documented at the bottom of `example/outline_template.md`.

### Boilerplate

Every deck script starts with this structure:

```js
#!/usr/bin/env node
"use strict";

const path = require("path");
const { OIDeckBuilder, parseArgs } = require("../oi_deck_builder");

const BASE = __dirname;
const cliOpts = parseArgs();
const FIG_DIR = cliOpts.figDir ?? path.join(BASE, "figures");
const OUTPUT = cliOpts.output ?? path.join(BASE, "MyDeck.pptx");
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: FIG_DIR,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
});

const fig = (name) => deck.fig(name);

async function main() {
  // slides go here...

  await deck.save();
}

main().catch((err) => { console.error("Build failed:", err); process.exit(1); });
```

Run with: `node my_deck.js` or `node my_deck.js --fig-dir ./path --output Out.pptx`

---

## OIDeckBuilder API

### Constructor

```js
new OIDeckBuilder({
  figDir: "./figures",       // directory with SVG/PNG figures
  output: "./deck.pptx",    // output file path
  cacheDir: "./.pptx_cache", // optional: cached rasterized PNGs
  rasterWidth: 2400,         // optional: SVG->PNG raster width in px
  logoSmall: "...",          // optional: override small logo (bottom-right)
  logoTitle: "...",          // optional: override title slide logo
  author: "...",             // optional: metadata
  company: "...",            // optional: metadata
})
```

### `deck.fig(name)`

Builds a figure path from a short name (no extension). Used as: `fig("my_figure_name")`.

The builder auto-detects `.svg` (rasterized to cached PNG) or `.png` files in the figure directory.

---

### `deck.addTitleSlide(title, subtitle, date, notice)`

First slide of the deck. All parameters are strings.

```js
deck.addTitleSlide(
  "Main Title",
  "Subtitle Line",
  "February 2026",
  "PRELIMINARY DATA -- DO NOT CITE"
);
```

- `date` and `notice` are optional.
- Includes the full OI logo.

---

### `deck.addFigureSlide(title, subtitle, figPath)`

Single figure slide, centered. The figure scales to fill the available area while preserving aspect ratio.

```js
deck.addFigureSlide(
  "Slide Title",
  "Slide Subtitle",
  fig("figure_name"),
);
```

Optional 4th argument `opts`:
- `opts.fig_box` -- override placement box `{x, y, w, h}` in inches
- `opts.showSource` -- add source citation line (boolean)
- `opts.citation` -- custom citation text string

---

### `deck.addMultiFigureSlide(title, subtitle, figPaths, cols, rows, opts)`

Grid of figures with optional panel titles above each figure.

**2-panel (side by side):** `cols=2, rows=1`
```js
deck.addMultiFigureSlide(
  "Title",
  "Subtitle",
  [fig("left_figure"), fig("right_figure")],
  2, 1,
  { panelTitles: ["Left Title", "Right Title"] }
);
```

**4-panel (2x2 grid):** `cols=2, rows=2`
```js
deck.addMultiFigureSlide(
  "Title",
  "Subtitle",
  [fig("top_left"), fig("top_right"), fig("bottom_left"), fig("bottom_right")],
  2, 2,
  { panelTitles: ["Top Left", "Top Right", "", ""] }
);
```

Panel titles are optional. Pass `""` for panels without titles. Figures are laid out left-to-right, top-to-bottom.

Optional `opts`:
- `panelTitles` -- string array, one per panel
- `fig_box` -- override placement box
- `gap` -- horizontal gap between panels (default: 0.10)
- `vgap` -- vertical gap between rows (default: 0.10 for 1 row, 0.00 for multi-row)
- `panelAspect` -- enforce aspect ratio per panel
- `titleFontSize` -- panel title font size (default: 14)
- `showSource`, `citation` -- source line

---

### `deck.add3FigureSlide(title, subtitle, figPaths, panelTitles, opts)`

Special layout: 1 figure centered on top, 2 figures on the bottom row.

```js
deck.add3FigureSlide(
  "Title",
  "Subtitle",
  [fig("top_center"), fig("bottom_left"), fig("bottom_right")],
  ["Top Title", "Bottom Left Title", "Bottom Right Title"]
);
```

---

### `deck.addRichTextSlide(title, textItems, opts)`

Bulleted text slide. This is the primary text slide method. Handles all OI styling automatically: colored bullets/numbers in OI green, paragraph spacing, indentation.

**Simple format** (preferred for most slides):

```js
deck.addRichTextSlide("Slide Title", [
  "Top-level bullet point (22pt)",
  ["Sub-bullet point (18pt, indented)", 1],
  ["Another sub-bullet", 1],
  "",                                        // blank spacer line
  "Another top-level point",
  ["Sub-bullet with smaller font (small)", 1], // (small) suffix forces 18pt
]);
```

Rules for simple format:
- **Strings** become top-level bullets (22pt, OI green bullet character)
- **`[text, 1]` arrays** become indented sub-bullets (18pt, OI green en-dash)
- **`""`** (empty string) inserts a blank spacer line
- **`(small)` suffix** forces 18pt font size regardless of indent level
- **`"1. "` / `"2. "` prefix** creates numbered items with OI green numbers

**Numbered lists:**

```js
deck.addRichTextSlide("Next Steps", [
  "1. First numbered point",
  "2. Second numbered point",
  ["Sub-bullet under item 2", 1],
]);
```

**Full format** (for overriding defaults):

```js
deck.addRichTextSlide("Title", [
  { text: "Numbered item", options: { bullet: { type: "number" } } },
  { text: "Custom spacing", options: { paraSpaceAfter: 20 } },
]);
```

In the full format, these defaults are applied if not specified:
- `fontSize: 22` (top-level) or `18` (indented)
- `color: "262626"` (dark text)
- `paraSpaceBefore: 0`
- `paraSpaceAfter: 14` (top-level) or `4` (indented)
- Bullet prefix in OI green is always added automatically

Optional `opts`:
- `opts.subtitle` -- subtitle text
- `opts.textBox` -- override `{x, y, w, h}` (default: `{x: 0.6713, y: 1.46, w: 12.2718, h: 4.75}`)

---

### `deck.addTableSlide(title, tableRows, tableOpts, opts)`

Table slide with OI-styled header (white text on teal) and alternating row shading.

```js
deck.addTableSlide("Table Title", [
  ["Col1 Header", "Col2 Header", "Col3 Header"],  // first row = header
  ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
  ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"],
], {
  colW: [3.0, 5.0, 4.0],  // optional: column widths in inches
}, {
  subtitle: "Optional Subtitle",
  footnote: "Optional footnote text below the table.",
});
```

- First row of `tableRows` becomes the header (teal background, white bold text)
- Remaining rows auto-alternate with light gray shading
- `tableOpts`: PptxGenJS table options (`colW`, `rowH`, `border`, etc.)
- `opts.subtitle`: subtitle under the title bar
- `opts.footnote`: footnote text below the table

---

### `deck.addTextSlide(title, bulletPoints, subtitle)`

Simpler text slide (legacy). Each bullet is rendered individually. Prefer `addRichTextSlide` for new decks.

```js
deck.addTextSlide("Title", [
  "First bullet (22pt default)",
  ["Custom text", 18, "434343", true],  // [text, fontSize, color, bold]
]);
```

---

### `await deck.save()`

Writes the .pptx file. Must be awaited. Uses the `output` path from the constructor (or pass an override path).

---

## Theme Reference

All styling is automatic. These are the values the builder uses:

### Colors (no `#` prefix)
| Name | Hex | Usage |
|------|-----|-------|
| `OI_GREEN` | `29B6A4` | Bullets, numbers, underlines, table headers |
| `OI_ORANGE` | `FAA523` | Accent color |
| `NAVY` | `003A4F` | Brand navy |
| `DARK_TEXT` | `262626` | Body text, titles |
| `SUBTITLE_GRAY` | `626365` | Subtitles |

### Fonts
| Name | Font | Usage |
|------|------|-------|
| `TITLE` | Lucida Bright | Slide titles |
| `BODY` | Arial | Body/bullet text |
| `LABEL` | Lucida Sans | Subtitles, panel titles, source lines, table cells |

### Slide dimensions
- Widescreen: 13.33" x 7.50" (`LAYOUT_WIDE`)

---

## Outline Template Format

The outline template (`example/outline_template.md`) uses this format:

```markdown
## Deck Settings
- **Title**: ...
- **Subtitle**: ...
- **Date**: ...
- **Notice**: ...
- **Figure directory**: ./figures
- **Output**: ./MyDeck.pptx

## Slides

### TEXT: Slide Title
- Top-level bullet
  - Sub-bullet
  - Another sub-bullet (small)
- Another top-level bullet

### TABLE: Table Title
- **Subtitle**: ...
- **Columns**: Col1, Col2, Col3
- **Rows**:
  - Val1 | Val2 | Val3
  - Val4 | Val5 | Val6
- **Footnote**: ...

### 1-FIGURE: Slide Title
- **Subtitle**: ...
- **Figure**: figure_name_without_extension

### 2-FIGURE: Slide Title
- **Subtitle**: ...
- **Left**: figure_name | Panel Title
- **Right**: figure_name | Panel Title

### 3-FIGURE: Slide Title
- **Subtitle**: ...
- **Top center**: figure_name | Panel Title
- **Bottom left**: figure_name | Panel Title
- **Bottom right**: figure_name | Panel Title

### 4-FIGURE: Slide Title
- **Subtitle**: ...
- **Top left**: figure_name | Panel Title
- **Top right**: figure_name | Panel Title
- **Bottom left**: figure_name | Panel Title
- **Bottom right**: figure_name | Panel Title
```

### Mapping outline to code

| Outline | Code |
|---------|------|
| `### TEXT: Title` | `deck.addRichTextSlide("Title", [...])` |
| `### TABLE: Title` | `deck.addTableSlide("Title", [...], {colW}, {subtitle, footnote})` |
| `### 1-FIGURE: Title` | `deck.addFigureSlide("Title", "Subtitle", fig("name"))` |
| `### 2-FIGURE: Title` | `deck.addMultiFigureSlide("Title", "Subtitle", [fig("l"), fig("r")], 2, 1, {panelTitles})` |
| `### 3-FIGURE: Title` | `deck.add3FigureSlide("Title", "Subtitle", [fig("t"), fig("bl"), fig("br")], ["T", "BL", "BR"])` |
| `### 4-FIGURE: Title` | `deck.addMultiFigureSlide("Title", "Subtitle", [fig("tl"), fig("tr"), fig("bl"), fig("br")], 2, 2, {panelTitles})` |
| `1.` / `2.` numbered | `{ text: "...", options: { bullet: { type: "number" } } }` |
| `(small)` suffix | Renders at 18pt instead of 22pt |
| `  - sub-bullet` | `["text", 1]` in the text items array |

### Important notes for generating deck scripts
- Always use `fig("name")` helper -- never hardcode paths
- Figure names have no extension (the builder auto-detects `.svg` or `.png`)
- The first slide should always be `addTitleSlide`
- Use `addRichTextSlide` (not `addTextSlide`) for all text slides
- For numbered lists, either use `"1. text"` simple format or `{ text, options: { bullet: { type: "number" } } }` full format
- Sub-bullets use `["text", 1]` array format with indent level 1
- Blank spacer `""` can separate bullet groups visually
- The script must end with `await deck.save()` inside an async `main()` function
- See `example/wgu_deck.js` as the reference implementation
