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
    // Single figure: full width, centered horizontally
    SINGLE:     { x: 0.05, y: 1.30, w: 13.23, h: 6.27 },
    // 2-panel: full width, pulled down for breathing room after title
    TWO_PANEL:  { x: 0.05, y: 2.05, w: 13.23, h: 5.02 },
    // 4-panel: full width, slight breathing room after title
    FOUR_PANEL: { x: 0.05, y: 1.55, w: 13.23, h: 5.82 },
  },

  // Table styles
  table: {
    header:     { fontFace: "Lucida Sans", fontSize: 16, bold: true, color: "FFFFFF", fill: { color: "29B6A4" }, align: "center", valign: "middle" },
    cell:       { fontFace: "Lucida Sans", fontSize: 16, color: "262626", align: "center", valign: "middle" },
    altRow:     { fill: { color: "F2F2F2" } },
    groupLabel: { fontFace: "Lucida Sans", fontSize: 20, bold: true, color: "262626", align: "center", valign: "middle" },
    border:     { type: "solid", pt: 0.5, color: "D9D9D9" },
    position:   { x: 0.6713, y: 1.50, w: 12.2687 },
    rowH:       0.55,
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
   * Title slide.
   *
   * Simple form: pass strings for title, subtitle, date, notice.
   * Advanced form: pass opts.textItems array for full control.
   *
   * @param {string|object} titleOrOpts - Title string, or opts object
   * @param {string} [subtitle]
   * @param {string} [date]
   * @param {string} [notice]
   */
  addTitleSlide(titleOrOpts, subtitle, date, notice) {
    const slide = this.pptx.addSlide();
    const textBox = { x: 0.53, y: 2.25, w: 12.12, h: 2.15 };

    let textItems;

    if (typeof titleOrOpts === "object" && titleOrOpts.textItems) {
      // Advanced: raw textItems with default styling
      textItems = titleOrOpts.textItems.map((item) => ({
        text: item.text,
        options: {
          fontFace: F.TITLE, fontSize: 24, bold: false,
          color: C.DARK_TEXT, breakLine: true,
          ...item.options,
        },
      }));
    } else {
      // Simple: build from strings
      const t = typeof titleOrOpts === "string" ? titleOrOpts : "";
      textItems = [
        { text: t, options: { fontFace: F.TITLE, fontSize: 32, bold: true, color: C.DARK_TEXT, breakLine: true } },
      ];
      if (subtitle) {
        textItems.push({ text: subtitle, options: { fontFace: F.TITLE, fontSize: 24, bold: false, color: C.DARK_TEXT, breakLine: true } });
      }
      if (date || notice) {
        textItems.push({ text: "", options: { fontSize: 12, breakLine: true } });
        textItems.push({ text: "", options: { fontSize: 12, breakLine: true } });
      }
      if (date) {
        textItems.push({ text: date, options: { fontFace: F.LABEL, fontSize: 12, bold: true, color: C.DARK_TEXT, breakLine: true } });
      }
      if (notice) {
        textItems.push({ text: notice, options: { fontFace: F.LABEL, fontSize: 12, bold: true, color: C.DARK_TEXT } });
      }
    }

    slide.addText(textItems, {
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
   * 3-figure slide: 1 centered on top row, 2 on bottom row.
   *
   * @param {string} title
   * @param {string} subtitle
   * @param {string[]} figPaths - [topCenter, bottomLeft, bottomRight]
   * @param {string[]} panelTitles - [topTitle, bottomLeftTitle, bottomRightTitle]
   * @param {object} [opts]
   * @param {object} [opts.fig_box] - Override figure box
   * @param {number} [opts.gap] - Horizontal gap (default: 0.00)
   * @param {number} [opts.vgap] - Vertical gap (default: 0.00)
   */
  add3FigureSlide(title, subtitle, figPaths, panelTitles, opts = {}) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, subtitle);

    const box = opts.fig_box || theme.figBox.FOUR_PANEL;
    const gap = opts.gap ?? 0.00;
    const vgap = opts.vgap ?? 0.00;
    const PANEL_TITLE_H = 0.22;
    const titleFontSize = opts.titleFontSize ?? 14;
    const cols = 2, rows = 2;

    const availH = box.h - 2 * PANEL_TITLE_H;
    const cellW = (box.w - gap * (cols - 1)) / cols;
    const cellH = (availH - vgap * (rows - 1)) / rows;

    // Resolve all 3 images
    const imgs = figPaths.map((fp) => {
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

    const row0H = imgs[0] ? imgs[0].renderedH : cellH;
    const row1H = Math.max(imgs[1] ? imgs[1].renderedH : cellH, imgs[2] ? imgs[2].renderedH : cellH);

    const gridH = PANEL_TITLE_H + row0H + vgap + PANEL_TITLE_H + row1H;
    const gridW = cols * cellW + gap * (cols - 1);
    const gridX0 = box.x + (box.w - gridW) / 2;
    const gridY0 = box.y;

    const titles = panelTitles || ["", "", ""];

    // Top row: 1 centered panel
    {
      const cx = gridX0 + (gridW - cellW) / 2;
      const titleY = gridY0;
      const imgY = gridY0 + PANEL_TITLE_H;

      if (titles[0]) {
        slide.addText(titles[0], {
          x: cx, y: titleY, w: cellW, h: PANEL_TITLE_H,
          fontFace: F.LABEL, fontSize: titleFontSize, bold: true, color: C.DARK_TEXT,
          align: "center", valign: "bottom",
        });
      }

      if (imgs[0]) {
        const cellBox = { x: cx, y: imgY, w: cellW, h: row0H };
        const p = containInBox(cellBox, imgs[0].aspect, "top");
        slide.addImage({ path: imgs[0].path, x: p.x, y: p.y, w: p.w, h: p.h });
      }
    }

    // Bottom row: 2 panels
    const botTitleY = gridY0 + PANEL_TITLE_H + row0H + vgap;
    const botImgY = botTitleY + PANEL_TITLE_H;

    for (let c = 0; c < 2; c++) {
      const cx = gridX0 + c * (cellW + gap);
      const img = imgs[c + 1];

      if (titles[c + 1]) {
        slide.addText(titles[c + 1], {
          x: cx, y: botTitleY, w: cellW, h: PANEL_TITLE_H,
          fontFace: F.LABEL, fontSize: titleFontSize, bold: true, color: C.DARK_TEXT,
          align: "center", valign: "bottom",
        });
      }

      if (img) {
        const cellBox = { x: cx, y: botImgY, w: cellW, h: row1H };
        const p = containInBox(cellBox, img.aspect, "top");
        slide.addImage({ path: img.path, x: p.x, y: p.y, w: p.w, h: p.h });
      }
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

      slide.addText([
        { text: "\u2022 ", options: { fontFace: F.BODY, fontSize, color: C.OI_GREEN, bold: false } },
        { text, options: { fontFace: F.BODY, fontSize, color, bold } },
      ], {
        x, y: cursorY, w, h: boxH,
        align: "left", valign: "top",
      });

      cursorY += boxH;
    }

    this.addLogo(slide);
    return slide;
  }

  /**
   * Rich text slide: title bar + bulleted text with OI styling applied automatically.
   *
   * Accepts either:
   *   (a) Simple format: array of strings or [text, indentLevel] pairs.
   *       Strings become 22pt bullets. Use "  - sub point" or [text, 1] for sub-bullets (18pt).
   *       Append " (small)" to force 18pt. Use "" for blank spacer lines.
   *       Prefix with "1. " / "2. " for numbered items.
   *   (b) Full PptxGenJS text items [{text, options}, ...] — OI defaults applied to any
   *       missing bullet color, fontSize, or text color.
   *
   * @param {string} title
   * @param {Array} textItems
   * @param {object} [opts]
   * @param {string} [opts.subtitle]
   * @param {object} [opts.textBox] - Override {x, y, w, h}
   */
  addRichTextSlide(title, textItems, opts = {}) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, opts.subtitle);

    // Auto-style items — use colored text-run prefixes for bullets/numbers
    // since pptxgenjs does not support bullet.color
    let numberCounter = 0;
    const styledItems = [];
    for (const item of textItems) {
      // Simple string or [text, indent] format
      if (typeof item === "string" || Array.isArray(item)) {
        let text, indent;
        if (Array.isArray(item)) {
          [text, indent] = item;
        } else {
          text = item;
          indent = 0;
        }

        // Blank spacer
        if (text === "") {
          numberCounter = 0;
          styledItems.push({ text: "", options: { fontSize: 18, breakLine: true } });
          continue;
        }

        // Detect indent from leading whitespace or "  - " prefix
        if (text.startsWith("  - ") || text.startsWith("    -")) {
          text = text.replace(/^\s*-\s*/, "");
          indent = 1;
        }

        // Detect (small) suffix
        let fontSize = indent > 0 ? 18 : 22;
        if (text.endsWith("(small)")) {
          text = text.replace(/\s*\(small\)\s*$/, "");
          fontSize = 18;
        }

        // Detect numbered prefix "1. ", "2. "
        const numMatch = text.match(/^(\d+)\.\s+/);
        let prefix;
        if (numMatch) {
          numberCounter = parseInt(numMatch[1], 10);
          text = text.replace(/^\d+\.\s+/, "");
          prefix = `${numberCounter}. `;
          numberCounter++;
        } else {
          prefix = indent > 0 ? "\u2013 " : "\u2022 ";
        }

        // Use invisible bullet (zero-width space) to get indentLevel margins from pptxgenjs
        // Paragraph-level props (paraSpace, indent) go on the first run of the paragraph
        const bulletShim = { characterCode: "200B" };
        const paraSpaceBefore = 0;
        const paraSpaceAfter = indent > 0 ? 4 : 14;
        styledItems.push(
          { text: prefix, options: { fontSize, color: C.OI_GREEN, bold: false, bullet: bulletShim, indentLevel: indent || 0, paraSpaceBefore, paraSpaceAfter } },
          { text, options: {
            fontSize,
            color: C.DARK_TEXT,
            breakLine: true,
          }},
        );
        continue;
      }

      // Full {text, options} format — apply OI defaults
      const o = item.options || {};
      const indent = o.indentLevel || 0;
      const fontSize = o.fontSize || 22;

      // Determine prefix
      let prefix;
      if (o.bullet && o.bullet.type === "number") {
        numberCounter++;
        prefix = `${numberCounter}. `;
      } else {
        prefix = indent > 0 ? "\u2013 " : "\u2022 ";
      }

      // Strip bullet from options (we handle it as text prefix now)
      // Use invisible bullet (zero-width space) to get indentLevel margins
      const { bullet, ...restOpts } = o;
      const bulletShim = { characterCode: "200B" };
      const options = {
        fontSize,
        color: C.DARK_TEXT,
        breakLine: true,
        paraSpaceBefore: 0,
        paraSpaceAfter: indent > 0 ? 4 : 14,
        ...restOpts,
      };
      // Remove bullet from restOpts if it leaked through
      delete options.bullet;

      if (item.text) {
        styledItems.push(
          { text: prefix, options: { fontSize, color: C.OI_GREEN, bold: false, bullet: bulletShim, indentLevel: indent, paraSpaceBefore: options.paraSpaceBefore, paraSpaceAfter: options.paraSpaceAfter } },
          { text: item.text, options },
        );
      } else {
        numberCounter = 0;
        styledItems.push({ text: "", options });
      }
    }

    const textBox = opts.textBox || { x: 0.6713, y: 1.46, w: 12.2718, h: 4.75 };
    slide.addText(styledItems, {
      x: textBox.x, y: textBox.y, w: textBox.w, h: textBox.h,
      fontFace: F.BODY, valign: "top",
    });

    this.addLogo(slide);
    return slide;
  }

  /**
   * Table slide: title bar + a styled table.
   *
   * Accepts either:
   *   (a) Pre-styled PptxGenJS rows (array of arrays of {text, options} objects)
   *   (b) Simple string arrays — first row becomes header, rest auto-styled with alternating rows
   *
   * @param {string} title
   * @param {Array} tableRows - Table rows: string[][] for auto-styling, or pre-styled PptxGenJS rows
   * @param {object} [tableOpts] - PptxGenJS table options override (x, y, w, colW, rowH, border, etc.)
   * @param {object} [opts]
   * @param {string} [opts.subtitle]
   * @param {string} [opts.footnote] - Text below the table
   */
  addTableSlide(title, tableRows, tableOpts = {}, opts = {}) {
    const slide = this.pptx.addSlide();
    this.addTitleBar(slide, title, opts.subtitle);

    const ts = theme.table;

    // Auto-style simple string rows
    let styledRows = tableRows;
    if (tableRows.length > 0 && typeof tableRows[0][0] === "string") {
      styledRows = tableRows.map((row, rowIdx) => {
        const isHeader = rowIdx === 0;
        const isAlt = !isHeader && rowIdx % 2 === 0;
        return row.map((cellText) => ({
          text: cellText,
          options: isHeader
            ? { ...ts.header }
            : isAlt
              ? { ...ts.cell, ...ts.altRow }
              : { ...ts.cell },
        }));
      });
    }

    const pos = ts.position;
    const mergedOpts = {
      x: pos.x, y: pos.y, w: pos.w,
      rowH: ts.rowH,
      border: ts.border,
      autoPage: false,
      ...tableOpts,
    };

    slide.addTable(styledRows, mergedOpts);

    if (opts.footnote) {
      slide.addText(opts.footnote, {
        x: pos.x, y: 6.7137, w: pos.w, h: 0.35,
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
