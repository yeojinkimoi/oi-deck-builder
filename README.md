# oi-slide

Reusable slide deck builder for Opportunity Insights presentations. Implements the OI house style (Princeton Oct 2025 template) on top of [PptxGenJS](https://gitbrent.github.io/PptxGenJS/).

## Quick start

### 1. Install

```bash
# Clone or copy this repo into your machine
cd oi-slide
npm install
```

### 2. Create your deck script

Create a file like `my_deck.js` in your project directory:

```js
const path = require("path");
const { OIDeckBuilder, theme } = require("/path/to/oi-slide/oi_deck_builder");

const C = theme.colors;
const F = theme.fonts;

async function main() {
  const deck = new OIDeckBuilder({
    figDir: path.join(__dirname, "figures"),
    output: path.join(__dirname, "my_presentation.pptx"),
  });

  // Title slide
  deck.addTitleSlide({
    textItems: [
      { text: "My Research Title", options: { fontSize: 32, bold: true } },
      { text: "Subtitle here", options: { fontSize: 24 } },
      { text: "", options: { fontSize: 12, breakLine: true } },
      { text: "April 2026", options: { fontFace: F.LABEL, fontSize: 12, bold: true } },
    ],
  });

  // Single figure slide
  deck.addFigureSlide(
    "Impact of Program on Earnings",
    "Treatment vs. Matched Controls",
    deck.fig("my_event_study")
  );

  // Two-panel figure slide
  deck.addMultiFigureSlide(
    "Graduates vs. Withdrawers",
    "2 Years After Entry",
    [deck.fig("grad_delta"), deck.fig("wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"], panelAspect: 1.0 }
  );

  // Text slide with bullets
  deck.addTextSlide("Key Findings", [
    "Finding one goes here",
    "Finding two goes here",
    ["Sub-point (smaller)", 18, C.CITE_GRAY, false],
  ]);

  await deck.save();
}

main().catch(console.error);
```

### 3. Build

```bash
node my_deck.js
```

## OIDeckBuilder options

```js
new OIDeckBuilder({
  figDir:      "./figures",           // where your figure files live
  output:      "./my_deck.pptx",      // output file path
  cacheDir:    "./.pptx_cache",       // SVG->PNG cache (default: next to figDir)
  rasterWidth: 2400,                  // PNG raster width in pixels (default: 2400)
  logoSmall:   "/path/to/logo.png",   // bottom-right logo (default: oi-slide/oi_logo.png)
  logoTitle:   "/path/to/logo.png",   // title slide logo (default: oi-slide/oi_logo_full.png)
  author:      "Opportunity Insights", // pptx metadata
  company:     "Opportunity Insights", // pptx metadata
})
```

## Slide types

### Title slide

```js
deck.addTitleSlide({
  textItems: [
    { text: "Main Title", options: { fontSize: 32, bold: true } },
    { text: "Subtitle",   options: { fontSize: 24 } },
  ],
  textBox: { x: 0.53, y: 2.25, w: 12.12, h: 2.15 },  // optional position override
});
```

### Single figure slide

```js
deck.addFigureSlide("Title", "Subtitle", deck.fig("figure_name"), {
  fig_box: theme.figBox.SINGLE,  // optional: SINGLE, DEFAULT, or FOUR
  showSource: true,              // optional: show source citation line
  citation: "Custom citation",   // optional: override default citation
});
```

Figures are resolved automatically: pass a `.pdf` name and the builder looks for `.svg` first (rasterizes to cached high-res PNG), then `.png`.

### Multi-figure slide (2-panel, 4-panel, etc.)

```js
// 2-panel side-by-side
deck.addMultiFigureSlide(
  "Title", "Subtitle",
  [deck.fig("left_panel"), deck.fig("right_panel")],
  2, 1,  // cols, rows
  {
    panelTitles: ["Left Title", "Right Title"],
    panelAspect: 1.0,  // 1:1 panels (use 2.0 for wide 2:1 panels)
    gap: 0.10,         // horizontal gap between panels
    vgap: 0.10,        // vertical gap between rows
  }
);

// 4-panel grid (2x2)
deck.addMultiFigureSlide(
  "Title", "Subtitle",
  [deck.fig("tl"), deck.fig("tr"), deck.fig("bl"), deck.fig("br")],
  2, 2,
  {
    panelTitles: ["Top Left", "Top Right", "", ""],
    panelAspect: 2.0,
    fig_box: theme.figBox.FOUR,
  }
);
```

### Text slide (simple bullets)

```js
deck.addTextSlide("Title", [
  "Regular bullet (22pt)",
  ["Custom: text, size, color, bold", 18, "7F7F7F", false],
], "Optional subtitle");
```

### Rich text slide (full formatting control)

For slides with mixed bullet styles, indentation, or numbered lists. Uses PptxGenJS text item arrays directly:

```js
deck.addRichTextSlide("Title", [
  { text: "Main point", options: {
    bullet: { color: C.OI_GREEN }, indentLevel: 0,
    fontSize: 22, color: C.DARK_TEXT, breakLine: true,
  }},
  { text: "Sub-point", options: {
    bullet: { color: C.OI_GREEN }, indentLevel: 1,
    fontSize: 18, color: C.DARK_TEXT, breakLine: true,
  }},
  { text: "Numbered item", options: {
    bullet: { type: "number", color: C.OI_GREEN },
    fontSize: 22, color: C.DARK_TEXT, breakLine: true,
  }},
], {
  subtitle: "Optional subtitle",
  textBox: { x: 0.67, y: 1.46, w: 12.27, h: 4.75 },  // optional override
});
```

### Table slide

```js
const headerOpts = {
  fontFace: F.LABEL, fontSize: 16, bold: true,
  color: "FFFFFF", fill: { color: C.OI_GREEN },
  align: "center", valign: "middle",
};
const cellOpts = {
  fontFace: F.LABEL, fontSize: 16,
  color: C.DARK_TEXT, align: "center", valign: "middle",
};

deck.addTableSlide("Table Title", [
  [
    { text: "Column A", options: headerOpts },
    { text: "Column B", options: headerOpts },
  ],
  [
    { text: "Value 1", options: cellOpts },
    { text: "Value 2", options: cellOpts },
  ],
], {
  x: 0.67, y: 1.50, w: 12.27,
  colW: [6.0, 6.0],
  rowH: 0.55,
  border: { type: "solid", pt: 0.5, color: "D9D9D9" },
}, {
  subtitle: "Optional subtitle",
  footnote: "Optional footnote text below the table.",
});
```

## Custom layouts

For non-standard slides (e.g., 3-panel with 1 centered on top), use the low-level helpers directly:

```js
const { containInBox, getPngSize } = require("/path/to/oi-slide/oi_deck_builder");

const slide = deck.addSlide();           // raw pptxgenjs slide
deck.addTitleBar(slide, "Title", "Sub"); // OI-styled title bar
deck.addSourceLine(slide, "Citation");   // source line at bottom
deck.addLogo(slide);                     // OI logo bottom-right

// Place a figure manually
const resolved = deck.resolveFigure(deck.fig("my_fig"));
const { width, height } = getPngSize(resolved);
const placement = containInBox(
  { x: 1.0, y: 1.5, w: 11.0, h: 5.0 },  // target box
  width / height,                           // aspect ratio
  "middle"                                  // or "top"
);
slide.addImage({ path: resolved, ...placement });
```

## Theme reference

Access colors and fonts via `theme`:

```js
const { theme } = require("/path/to/oi-slide/oi_deck_builder");

theme.colors.OI_GREEN       // "29B6A4" — teal (treated group, title underline)
theme.colors.OI_ORANGE      // "FAA523" — orange (matched controls)
theme.colors.NAVY           // "003A4F" — navy accent
theme.colors.DARK_TEXT      // "262626" — titles, body, source
theme.colors.SUBTITLE_GRAY  // "626365" — subtitles
theme.colors.CITE_GRAY      // "7F7F7F" — fine print, disclaimers
theme.colors.LINE_GRAY      // "808080" — source line rule

theme.fonts.TITLE   // "Lucida Bright" — slide titles
theme.fonts.BODY    // "Arial" — body text / bullets
theme.fonts.LABEL   // "Lucida Sans" — subtitles, source, figure labels

theme.figBox.DEFAULT  // { x: 0.05, y: 1.28, w: 13.23, h: 5.79 } — 2-panel
theme.figBox.SINGLE   // { x: 0.05, y: 1.38, w: 13.23, h: 5.69 } — single figure
theme.figBox.FOUR     // { x: 0.05, y: 1.33, w: 13.23, h: 5.74 } — 4-panel
```

## Figure workflow

1. Export figures from Stata (or any tool) as `.svg` files into your `figDir`
2. Call `deck.fig("name")` — this returns a `.pdf` path, but `resolveFigure` strips the extension and looks for `.svg` first, then `.png`
3. SVGs are automatically rasterized to high-res PNGs (cached in `.pptx_cache/`) and only re-rendered when the source SVG changes
4. Images are contain-fitted into the figure box, preserving aspect ratio and eliminating jitter between slides

No manual image conversion step needed.

## CLI arguments

All deck scripts that use `parseArgs()` support these flags:

```
--fig-dir ./path      Override figure directory
--output  ./out.pptx  Override output file
--cache-dir ./cache   Override PNG cache directory
--raster-width 3200   Override SVG->PNG raster width (default: 2400)
```

## Example

See `wgu_deck_example.js` for a complete real-world deck with text slides, tables, single/multi-panel figures, and custom 3-panel layouts.

## Exports

```js
const {
  OIDeckBuilder,    // Main class
  theme,            // Colors, fonts, layout positions
  ensureDir,        // mkdir -p
  rasterizeSvgToPng,// SVG -> PNG via resvg
  getPngSize,       // Read PNG dimensions from IHDR
  containInBox,     // Aspect-ratio-preserving fit into a box
  resolveFigure,    // SVG/PNG resolution with caching
  parseArgs,        // CLI argument parser
} = require("/path/to/oi-slide/oi_deck_builder");
```
