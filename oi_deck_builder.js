#!/usr/bin/env node
/**
 * oi_deck_builder.js
 *
 * Reusable slide deck builder for Opportunity Insights presentations.
 * Implements the OI house style (Princeton Oct 2025 template):
 *   - Widescreen 13.33" x 7.50" slides
 *   - OI brand colors (teal, orange, navy)
 *   - Lucida Bright titles, Lucida Sans labels, Arial body
 *   - Aspect-ratio-preserving figure placement with SVG->PNG rasterization
 *
 * Usage:
 *   const { OIDeckBuilder } = require("oi-slide/oi_deck_builder");
 *   const deck = new OIDeckBuilder({ figDir: "./figures", output: "deck.pptx" });
 *   deck.addFigureSlide("Title", "Subtitle", deck.fig("my_figure"));
 *   await deck.save();
 */

"use strict";

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

// ══════════════════════════════════════════════════════════════════════════════
// THEME: OI / Princeton Oct 2025 template
// ══════════════════════════════════════════════════════════════════════════════

const theme = {
  // Brand colors (no # prefix — PptxGenJS convention)
  colors: {
    OI_GREEN:      "29B6A4",
    OI_ORANGE:     "FAA523",
    NAVY:          "003A4F",
    DARK_TEXT:     "262626",
    SUBTITLE_GRAY: "626365",
    BODY_GRAY:     "434343",
    CITE_GRAY:     "7F7F7F",
    LINE_GRAY:     "808080",
  },

  // Fonts
  fonts: {
    TITLE: "Lucida Bright",
    BODY:  "Arial",
    LABEL: "Lucida Sans",
  },

  // Figure placement boxes (inches)
  figBox: {
    // Single figure: 10.63" wide, centered horizontally
    SINGLE:     { x: 1.35, y: 1.25, w: 10.63, h: 5.82 },
    // 2-panel: full width, pulled down for breathing room after title
    TWO_PANEL:  { x: 0.05, y: 2.05, w: 13.23, h: 5.02 },
    // 4-panel: full width, tight to title
    FOUR_PANEL: { x: 0.05, y: 1.25, w: 13.23, h: 5.82 },
  },

  // Title bar positioning
  titleBar: { x: 0.67, y: 0.41, w: 12.27, h: 0.67 },
  titleUnderline: { x: 0.68, y: 1.15, w: 2.09, h: 0 },

  // Logo positioning
  logoSmall: { x: 12.94, y: 7.09, w: 0.35, h: 0.33 },
  logoTitle: { x: 10.50, y: 6.80, w: 2.15, h: 0.37 },

  // Source line positioning
  sourceRule: { x: 0.68, y: 7.09, w: 11.98, h: 0 },
  sourceText: { x: 0.62, y: 7.09, w: 11.64, h: 0.34 },
};

// Shorthand accessors
const C = theme.colors;
const F = theme.fonts;

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Rasterize an SVG file to a high-res PNG.
 */
function rasterizeSvgToPng(svgPath, pngPath, width = 2400) {
  const { Resvg } = require("@resvg/resvg-js");
  const svg = fs.readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  const pngData = resvg.render().asPng();
  fs.writeFileSync(pngPath, pngData);
}

/**
 * Read PNG dimensions from IHDR chunk (no dependencies).
 */
function getPngSize(pngPath) {
  const buf = fs.readFileSync(pngPath);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * Fit an image into a fixed box while preserving aspect ratio ("contain" fit).
 * valign: "middle" centers vertically; "top" pins to top of box.
 */
function containInBox(box, imgAspect, valign = "middle") {
  const boxAspect = box.w / box.h;
  let w, h, x, y;

  if (imgAspect >= boxAspect) {
    w = box.w;
    h = w / imgAspect;
    x = box.x;
    y = valign === "top" ? box.y : box.y + (box.h - h) / 2;
  } else {
    h = box.h;
    w = h * imgAspect;
    y = box.y;
    x = box.x + (box.w - w) / 2;
  }

  const round = (v) => Math.round(v * 1000) / 1000;
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

/**
 * Resolve a figure path to an embeddable PNG.
 * Priority: .svg (-> cached PNG) > .png
 * Callers pass .pdf names; we auto-detect the best available format.
 */
function resolveFigure(figPath, cacheDir, rasterWidth = 2400) {
  if (!figPath) return null;

  const noExt = figPath.replace(/\.[^.]+$/, "");

  // 1) SVG -> cached PNG
  const svgPath = noExt + ".svg";
  if (fs.existsSync(svgPath)) {
    ensureDir(cacheDir);
    const pngPath = path.join(cacheDir, path.basename(noExt) + ".png");
    const needRegen =
      !fs.existsSync(pngPath) ||
      fs.statSync(pngPath).mtimeMs < fs.statSync(svgPath).mtimeMs;

    if (needRegen) {
      console.log(`  Rasterizing ${path.basename(svgPath)} -> cache...`);
      rasterizeSvgToPng(svgPath, pngPath, rasterWidth);
    }
    return pngPath;
  }

  // 2) PNG alongside
  const pngPath = noExt + ".png";
  if (fs.existsSync(pngPath)) return pngPath;

  console.warn(`  WARNING: no usable figure found for ${figPath}`);
  return null;
}

/**
 * Parse common CLI arguments for deck builders.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fig-dir" && args[i + 1]) opts.figDir = args[++i];
    if (args[i] === "--output" && args[i + 1]) opts.output = args[++i];
    if (args[i] === "--cache-dir" && args[i + 1]) opts.cacheDir = args[++i];
    if (args[i] === "--raster-width" && args[i + 1]) opts.rasterWidth = Number(args[++i]);
  }
  return opts;
}

// ══════════════════════════════════════════════════════════════════════════════
// OIDeckBuilder CLASS
// ══════════════════════════════════════════════════════════════════════════════

class OIDeckBuilder {
  /**
   * @param {object} opts
   * @param {string} opts.figDir      - Directory containing figure files
   * @param {string} opts.output      - Output .pptx path
   * @param {string} [opts.cacheDir]  - PNG cache directory (default: figDir/../.pptx_cache)
   * @param {number} [opts.rasterWidth] - SVG->PNG raster width in px (default: 2400)
   * @param {string} [opts.logoSmall] - Path to small logo (bottom-right)
   * @param {string} [opts.logoTitle] - Path to large logo (title slide)
   * @param {string} [opts.author]    - Deck metadata author
   * @param {string} [opts.company]   - Deck metadata company
   */
  constructor(opts = {}) {
    this.figDir = opts.figDir || ".";
    this.output = opts.output || "deck.pptx";
    this.cacheDir = opts.cacheDir || path.join(path.dirname(this.figDir), ".pptx_cache");
    this.rasterWidth = opts.rasterWidth || 2400;
    const builderDir = __dirname;
    this.logoSmallPath = opts.logoSmall || path.join(builderDir, "oi_logo.png");
    this.logoTitlePath = opts.logoTitle || path.join(builderDir, "oi_logo_full.png");

    this.pptx = new pptxgen();
    this.pptx.layout = "LAYOUT_WIDE"; // 13.33" x 7.50"
    this.pptx.author = opts.author || "Opportunity Insights";
    this.pptx.company = opts.company || "Opportunity Insights";
  }

  // ── Convenience: figure path helper ──────────────────────────────────────

  /** Build a figure path from a short name (extension is a hint; resolveFigure finds SVG/PNG). */
  fig(name) {
    return path.join(this.figDir, name + ".pdf");
  }

  /** Resolve a figure path to an embeddable PNG (with SVG rasterization + caching). */
  resolveFigure(figPath) {
    return resolveFigure(figPath, this.cacheDir, this.rasterWidth);
  }

  // ── Low-level slide element helpers ──────────────────────────────────────

  /** Add a raw slide and return it (for custom layouts). */
  addSlide() {
    return this.pptx.addSlide();
  }

  /** Add title bar (title + optional subtitle + teal underline). */
  addTitleBar(slide, titleText, subtitleText = null) {
    const tb = theme.titleBar;
    const textItems = [
      {
        text: titleText,
        options: {
          fontFace: F.TITLE, fontSize: 24, bold: true,
          color: C.DARK_TEXT, breakLine: true,
        },
      },
    ];

    if (subtitleText) {
      textItems.push({
        text: subtitleText,
        options: {
          fontFace: F.LABEL, fontSize: 16, bold: false,
          color: C.SUBTITLE_GRAY,
        },
      });
    }

    slide.addText(textItems, {
      x: tb.x, y: tb.y, w: tb.w, h: tb.h,
      align: "left", valign: "top",
    });

    const ul = theme.titleUnderline;
    slide.addShape(this.pptx.ShapeType.line, {
      x: ul.x, y: ul.y, w: ul.w, h: ul.h,
      line: { color: C.OI_GREEN, width: 1 },
    });
  }

  /** Add source line with gray rule + bold "Source: " + regular citation. */
  addSourceLine(slide, citation = "Chetty, Fogel, Katz, Noray, Porter, Reisinger (2026)") {
    const sr = theme.sourceRule;
    slide.addShape(this.pptx.ShapeType.line, {
      x: sr.x, y: sr.y, w: sr.w, h: sr.h,
      line: { color: C.LINE_GRAY, width: 0.75 },
    });

    const st = theme.sourceText;
    slide.addText([
      {
        text: "Source: ",
        options: { fontFace: F.LABEL, fontSize: 14, bold: true, color: C.DARK_TEXT },
      },
      {
        text: citation,
        options: { fontFace: F.LABEL, fontSize: 14, bold: false, color: C.DARK_TEXT },
      },
    ], {
      x: st.x, y: st.y, w: st.w, h: st.h,
      align: "left", valign: "top",
    });
  }

  /** Add small OI logo to bottom-right corner. */
  addLogo(slide) {
    if (this.logoSmallPath && fs.existsSync(this.logoSmallPath)) {
      const pos = theme.logoSmall;
      slide.addImage({
        path: this.logoSmallPath,
        x: pos.x, y: pos.y, w: pos.w, h: pos.h,
      });
    }
  }

  // ── High-level slide builders ────────────────────────────────────────────

  /**
   * Title slide with configurable text lines.
   *
   * @param {object} opts
   * @param {Array<{text: string, options?: object}>} opts.textItems - Text items for the title area
   * @param {object} [opts.textBox] - Position/size override: {x, y, w, h}
   */
  addTitleSlide(opts = {}) {
    const slide = this.pptx.addSlide();

    const textItems = opts.textItems || [];
    const textBox = opts.textBox || { x: 0.53, y: 2.25, w: 12.12, h: 2.15 };

    // Apply default styling to text items
    const styledItems = textItems.map((item) => ({
      text: item.text,
      options: {
        fontFace: F.TITLE,
        fontSize: 24,
        bold: false,
        color: C.DARK_TEXT,
        breakLine: true,
        ...item.options,
      },
    }));

    slide.addText(styledItems, {
      x: textBox.x, y: textBox.y, w: textBox.w, h: textBox.h,
      align: "right", valign: "top",
    });

    if (this.logoTitlePath && fs.existsSync(this.logoTitlePath)) {
      const pos = theme.logoTitle;
      slide.addImage({
        path: this.logoTitlePath,
        x: pos.x, y: pos.y, w: pos.w, h: pos.h,
      });
    }

    return slide;
  }

  /**
   * Single-figure slide (title bar + image + logo).
   *
   * @param {string} title
   * @param {string} subtitle
   * @param {string} figPath - Figure file path (passed through resolveFigure)
   * @param {object} [opts]
   * @param {object} [opts.fig_box] - Override figure placement box
   * @param {boolean} [opts.showSource] - Add source line (default: false)
   * @param {string} [opts.citation] - Custom citation text
   */
  addFigureSlide(title, subtitle, figPath, opts = {}) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, subtitle);

    const box = opts.fig_box || theme.figBox.SINGLE;
    const resolved = this.resolveFigure(figPath);

    if (resolved && fs.existsSync(resolved)) {
      const { width, height } = getPngSize(resolved);
      const placement = containInBox(box, width / height);
      slide.addImage({
        path: resolved,
        x: placement.x, y: placement.y,
        w: placement.w, h: placement.h,
      });
    } else {
      slide.addText(`Missing figure:\n${path.basename(figPath || "")}`, {
        x: 1.0, y: 3.0, w: 11.0, h: 1.2,
        fontFace: F.BODY, fontSize: 18, color: "AA0000",
        align: "center", valign: "middle",
      });
    }

    if (opts.showSource) {
      this.addSourceLine(slide, opts.citation);
    }
    this.addLogo(slide);
    return slide;
  }

  /**
   * Multi-figure slide: N images in a grid with optional panel titles.
   *
   * @param {string} title - Slide title
   * @param {string} subtitle - Slide subtitle
   * @param {string[]} figPaths - Array of figure file paths
   * @param {number} cols - Number of columns
   * @param {number} rows - Number of rows
   * @param {object} [opts]
   * @param {object} [opts.fig_box] - Override figure placement box
   * @param {number} [opts.gap] - Horizontal gap between panels (default: 0.10)
   * @param {number} [opts.vgap] - Vertical gap between rows (default: 0.10)
   * @param {string[]} [opts.panelTitles] - Optional titles per panel
   * @param {number} [opts.panelAspect] - Enforce per-panel aspect ratio (w/h)
   * @param {number} [opts.titleFontSize] - Panel title font size (default: 14)
   * @param {boolean} [opts.showSource] - Add source line (default: false)
   * @param {string} [opts.citation] - Custom citation text
   */
  addMultiFigureSlide(title, subtitle, figPaths, cols, rows, opts = {}) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, subtitle);

    const defaultBox = rows > 1 ? theme.figBox.FOUR_PANEL : theme.figBox.TWO_PANEL;
    const box = opts.fig_box || defaultBox;
    const gap = opts.gap ?? 0.10;
    const vgap = opts.vgap ?? (rows > 1 ? 0.00 : 0.10);
    const panelTitles = opts.panelTitles ?? null;
    const PANEL_TITLE_H = 0.22;
    const titleFontSize = opts.titleFontSize ?? 14;

    // Determine which rows have titles
    const rowHasTitle = [];
    for (let r = 0; r < rows; r++) {
      let has = false;
      if (panelTitles) {
        for (let c = 0; c < cols; c++) {
          if (panelTitles[r * cols + c]) { has = true; break; }
        }
      }
      rowHasTitle.push(has);
    }
    const titledRowCount = rowHasTitle.filter(Boolean).length;
    const titleRowsH = PANEL_TITLE_H * titledRowCount;
    const availH = box.h - titleRowsH;

    // Panel aspect ratio
    const panelAspect = opts.panelAspect ?? null;
    let cellW, cellH;
    if (!panelAspect) {
      cellW = (box.w - gap * (cols - 1)) / cols;
      cellH = (availH - vgap * (rows - 1)) / rows;
    } else {
      const maxW = (box.w - gap * (cols - 1)) / cols;
      const maxH = (availH - vgap * (rows - 1)) / rows;
      const hIfFullW = maxW / panelAspect;
      if (hIfFullW <= maxH) { cellW = maxW; cellH = hIfFullW; }
      else { cellH = maxH; cellW = cellH * panelAspect; }
    }

    // Pre-resolve all images
    const resolvedImgs = figPaths.map((fp) => {
      const resolved = this.resolveFigure(fp);
      if (resolved && fs.existsSync(resolved)) {
        const { width, height } = getPngSize(resolved);
        const imgAspect = width / height;
        const cellAspect = cellW / cellH;
        const renderedH = imgAspect >= cellAspect ? cellW / imgAspect : cellH;
        return { path: resolved, aspect: imgAspect, renderedH };
      }
      return null;
    });

    // Per-row: max actual rendered image height
    const rowImgH = [];
    for (let r = 0; r < rows; r++) {
      let maxH = 0;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const img = idx < resolvedImgs.length ? resolvedImgs[idx] : null;
        maxH = Math.max(maxH, img ? img.renderedH : cellH);
      }
      rowImgH.push(maxH);
    }

    // Compute actual visual grid height
    let actualGridH = 0;
    for (let r = 0; r < rows; r++) {
      if (r > 0) actualGridH += vgap;
      if (rowHasTitle[r]) actualGridH += PANEL_TITLE_H;
      actualGridH += rowImgH[r];
    }

    // Horizontally center grid, vertically top-align (consistent gap after title)
    const gridW = cols * cellW + gap * (cols - 1);
    const gridX0 = box.x + (box.w - gridW) / 2;
    const gridY0 = box.y;

    // Row top Y positions
    let cumulativeY = gridY0;
    const rowTopY = [];
    for (let r = 0; r < rows; r++) {
      if (r > 0) cumulativeY += vgap;
      rowTopY.push(cumulativeY);
      if (rowHasTitle[r]) cumulativeY += PANEL_TITLE_H;
      cumulativeY += rowImgH[r];
    }

    // Place panels
    for (let i = 0; i < figPaths.length; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cellX = gridX0 + c * (cellW + gap);
      const rowTop = rowTopY[r];
      const titleY = rowTop;
      const cellY = rowHasTitle[r] ? rowTop + PANEL_TITLE_H : rowTop;

      if (panelTitles && panelTitles[i]) {
        slide.addText(panelTitles[i], {
          x: cellX, y: titleY, w: cellW, h: PANEL_TITLE_H,
          fontFace: F.LABEL, fontSize: titleFontSize, bold: true, color: C.DARK_TEXT,
          align: "center", valign: "bottom",
        });
      }

      const img = resolvedImgs[i];
      if (img) {
        const cellBox = { x: cellX, y: cellY, w: cellW, h: rowImgH[r] };
        const placement = containInBox(cellBox, img.aspect, "top");
        slide.addImage({
          path: img.path,
          x: placement.x, y: placement.y,
          w: placement.w, h: placement.h,
        });
      } else {
        slide.addText(`Missing:\n${path.basename(figPaths[i] || "?")}`, {
          x: cellX, y: cellY, w: cellW, h: rowImgH[r],
          fontFace: F.BODY, fontSize: 14, color: "AA0000",
          align: "center", valign: "middle",
        });
      }
    }

    if (opts.showSource) {
      this.addSourceLine(slide, opts.citation);
    }
    this.addLogo(slide);
    return slide;
  }

  /**
   * Text slide with title bar + bullet points.
   *
   * Each bullet can be a string (default 22pt) or [text, fontSize, color, bold].
   */
  addTextSlide(title, bulletPoints, subtitle = null) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, subtitle);

    const x = 1.15, w = 11.62;
    let cursorY = 1.46;
    const SPACE_BEFORE = 0.18;

    for (let i = 0; i < bulletPoints.length; i++) {
      const point = bulletPoints[i];
      let text, fontSize, color, bold;

      if (Array.isArray(point)) {
        [text, fontSize, color, bold] = point;
      } else {
        text = point; fontSize = 22; color = C.DARK_TEXT; bold = false;
      }

      if (typeof fontSize !== "number") fontSize = 22;
      if (typeof color === "string") color = color.replace("#", "");

      const boxH = Math.max(0.30, (fontSize / 72) * 1.4 * (text.length > 80 ? 2 : 1));
      if (i > 0) cursorY += SPACE_BEFORE;

      slide.addText(text, {
        x, y: cursorY, w, h: boxH,
        fontFace: F.BODY, fontSize, color, bold,
        bullet: { color: C.OI_GREEN },
        align: "left", valign: "top",
      });

      cursorY += boxH;
    }

    this.addLogo(slide);
    return slide;
  }

  /**
   * Rich text slide: title bar + a single addText call with full PptxGenJS text items.
   * Use this for slides with bullets, indentation, mixed formatting.
   *
   * @param {string} title
   * @param {Array} textItems - PptxGenJS text item array [{text, options}, ...]
   * @param {object} [opts]
   * @param {string} [opts.subtitle]
   * @param {object} [opts.textBox] - Override {x, y, w, h} for the text area
   */
  addRichTextSlide(title, textItems, opts = {}) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, opts.subtitle);

    // Default bullet/number color to OI green when not explicitly set
    const styledItems = textItems.map((item) => {
      if (item.options && item.options.bullet && !item.options.bullet.color) {
        return { ...item, options: { ...item.options, bullet: { ...item.options.bullet, color: C.OI_GREEN } } };
      }
      return item;
    });

    const textBox = opts.textBox || { x: 0.6713, y: 1.46, w: 12.2718, h: 4.75 };
    slide.addText(styledItems, {
      x: textBox.x, y: textBox.y, w: textBox.w, h: textBox.h,
      fontFace: F.BODY, valign: "top",
    });

    this.addLogo(slide);
    return slide;
  }

  /**
   * Table slide: title bar + a table.
   *
   * @param {string} title
   * @param {Array} tableRows - PptxGenJS table rows
   * @param {object} tableOpts - PptxGenJS table options (x, y, w, colW, rowH, border, etc.)
   * @param {object} [opts]
   * @param {string} [opts.subtitle]
   * @param {string} [opts.footnote] - Text below the table
   */
  addTableSlide(title, tableRows, tableOpts, opts = {}) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, opts.subtitle);

    slide.addTable(tableRows, tableOpts);

    if (opts.footnote) {
      slide.addText(opts.footnote, {
        x: 0.6713, y: 6.7137, w: 12.2687, h: 0.35,
        fontFace: F.LABEL, fontSize: 14, color: C.DARK_TEXT,
        align: "left", valign: "top",
      });
    }

    this.addLogo(slide);
    return slide;
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async save(outputPath) {
    const out = outputPath || this.output;
    await this.pptx.writeFile({ fileName: out });
    console.log(`\nDone! ${this.pptx.slides.length} slides saved to:\n  ${out}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main class
  OIDeckBuilder,

  // Theme constants (for custom layouts and Stata scheme references)
  theme,

  // Utility functions (for custom slide layouts)
  ensureDir,
  rasterizeSvgToPng,
  getPngSize,
  containInBox,
  resolveFigure,
  parseArgs,
};
