#!/usr/bin/env node
/**
 * oi_shapes.js — native-PowerPoint-shape figures for the OI deck builder.
 *
 * Diagrams (flowcharts, tree/boosting explainers, icon layouts) are described in a
 * small JSON "figspec" and rendered as REAL PowerPoint shapes, so anyone can open
 * the deck and move/edit them by hand. The figspec is the source of truth: rebuilds
 * are deterministic, and kept hand-edits should be back-ported into the spec
 * (see scripts/extract_shapes.js).
 *
 * Usage:
 *   const { OIDeckBuilder } = require("./oi_shapes");   // re-exports with methods installed
 *   deck.addDiagramSlide("Title", "Subtitle", "figspecs/regression_tree.json");
 *   deck.addShapeFigure(slide, specObjectOrPath, { x, y, w, h });  // lower-level
 *
 * FIGSPEC FORMAT (all coordinates in "canvas inches"; the canvas is contain-fit
 * into the target box, so specs are resolution-independent):
 * {
 *   "canvas": { "w": 11, "h": 5.2 },
 *   "defaults": { "fontFace": "Lucida Sans", "fontSize": 14, "color": "DARK_TEXT" },
 *   "shapes": [
 *     { "type": "rect",    "x":1,"y":1,"w":2,"h":0.7, "text":"Leaf", "fill":"OI_GREEN",
 *       "color":"FFFFFF", "rounded":true, "line":{"color":"NAVY","width":1} },
 *     { "type": "diamond", ... }, { "type": "ellipse", ... },
 *     { "type": "line",  "x1":1,"y1":1,"x2":3,"y2":2, "width":1, "color":"LINE_GRAY",
 *       "arrow":"end", "dash":"dash", "label":"Yes", "labelSize":12 },
 *     { "type": "text",  "x":1,"y":1,"w":3,"h":0.4, "text":"...", "align":"center",
 *       "bold":true, "italic":false }
 *   ]
 * }
 * Colors may be theme color names (OI_GREEN, NAVY, DARK_TEXT, ...) or raw hex.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const builder = require("./oi_deck_builder");
const { OIDeckBuilder, layoutFor, containInBox } = builder;

/** Resolve a color name against the theme palette, else pass hex through. */
function resolveColor(colors, c, fallback) {
  if (c == null) return fallback;
  const s = String(c).replace(/^#/, "");
  return colors[s] || s;
}

/** Load a figspec from an object or a JSON file path. */
function loadFigSpec(specOrPath, baseDir) {
  if (typeof specOrPath !== "string") return specOrPath;
  let p = specOrPath;
  if (!fs.existsSync(p) && baseDir) p = path.join(baseDir, specOrPath);
  if (!fs.existsSync(p) && !/\.json$/.test(p)) p = p + ".json";
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Render a figspec as native shapes inside `box` (inches on the slide).
 * The spec canvas is contain-fit into the box and centered; font sizes scale
 * with the same factor (disable with spec.scaleFonts = false).
 */
OIDeckBuilder.prototype.addShapeFigure = function (slide, specOrPath, box) {
  const spec = loadFigSpec(specOrPath, this.figspecDir || ".");
  const T = this.theme;
  const colors = T.colors;
  const canvas = spec.canvas || { w: box.w, h: box.h };
  const scale = Math.min(box.w / canvas.w, box.h / canvas.h);
  const ox = box.x + (box.w - canvas.w * scale) / 2;
  const oy = box.y + (box.h - canvas.h * scale) / 2;
  const fscale = spec.scaleFonts === false ? 1 : scale;

  const d = {
    fontFace: "Lucida Sans",
    fontSize: 14,
    color: colors.DARK_TEXT,
    lineColor: colors.LINE_GRAY,
    lineWidth: T.layout.underlineWeight,
    ...(spec.defaults || {}),
  };
  d.color = resolveColor(colors, d.color, colors.DARK_TEXT);
  d.lineColor = resolveColor(colors, d.lineColor, colors.LINE_GRAY);

  const SX = (v) => ox + v * scale;             // spec x -> slide x
  const SY = (v) => oy + v * scale;             // spec y -> slide y
  const SL = (v) => v * scale;                  // spec length -> slide length
  const SF = (v) => Math.max(6, Math.round((v ?? d.fontSize) * fscale * 2) / 2); // font pt
  const round = (v) => Math.round(v * 1000) / 1000;

  const SHAPE_MAP = { rect: "rect", ellipse: "ellipse", diamond: "diamond" };

  for (const s of spec.shapes || []) {
    const type = s.type || "rect";

    if (type === "line" || type === "arrow") {
      const x1 = s.x1 ?? (s.from ? s.from[0] : 0), y1 = s.y1 ?? (s.from ? s.from[1] : 0);
      const x2 = s.x2 ?? (s.to ? s.to[0] : 0),   y2 = s.y2 ?? (s.to ? s.to[1] : 0);
      const lx = Math.min(x1, x2), ly = Math.min(y1, y2);
      const lineOpts = {
        color: resolveColor(colors, s.color, d.lineColor),
        width: (s.width ?? d.lineWidth),
      };
      if (s.dash) lineOpts.dashType = s.dash;
      const arrow = s.arrow ?? (type === "arrow" ? "end" : null);
      if (arrow === "end" || arrow === "both") lineOpts.endArrowType = s.arrowType || "triangle";
      if (arrow === "begin" || arrow === "both") lineOpts.beginArrowType = s.arrowType || "triangle";
      slide.addShape(this.pptx.ShapeType.line, {
        x: round(SX(lx)), y: round(SY(ly)), w: round(SL(Math.abs(x2 - x1))), h: round(SL(Math.abs(y2 - y1))),
        flipH: x2 < x1, flipV: y2 < y1,
        line: lineOpts,
      });
      if (s.label) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const lw = s.labelW ?? 1.2, lh = s.labelH ?? 0.3;
        slide.addText(s.label, {
          x: round(SX(mx - lw / 2 + (s.labelDx ?? 0))), y: round(SY(my - lh / 2 + (s.labelDy ?? 0))),
          w: round(SL(lw)), h: round(SL(lh)),
          fontFace: s.fontFace || d.fontFace, fontSize: SF(s.labelSize ?? 12),
          color: resolveColor(colors, s.labelColor, d.color),
          align: "center", valign: "middle", italic: !!s.labelItalic,
        });
      }
      continue;
    }

    if (type === "text") {
      slide.addText(s.text ?? "", {
        x: round(SX(s.x)), y: round(SY(s.y)), w: round(SL(s.w ?? 2)), h: round(SL(s.h ?? 0.4)),
        fontFace: s.fontFace || d.fontFace, fontSize: SF(s.fontSize),
        color: resolveColor(colors, s.color, d.color),
        bold: !!s.bold, italic: !!s.italic,
        align: s.align || "center", valign: s.valign || "middle",
      });
      continue;
    }

    // Filled shapes (rect / roundRect / ellipse / diamond), with optional text inside.
    const shapeName = type === "rect" && s.rounded ? "roundRect" : (SHAPE_MAP[type] || "rect");
    const shapeOpts = {
      shape: this.pptx.ShapeType[shapeName],
      x: round(SX(s.x)), y: round(SY(s.y)), w: round(SL(s.w)), h: round(SL(s.h)),
      fill: s.fill ? { color: resolveColor(colors, s.fill) } : { color: "FFFFFF" },
      line: s.line === null ? { type: "none" } : {
        color: resolveColor(colors, s.line && s.line.color, d.lineColor),
        width: (s.line && s.line.width) ?? d.lineWidth,
        ...(s.line && s.line.dash ? { dashType: s.line.dash } : {}),
      },
      ...(shapeName === "roundRect" ? { rectRadius: s.rectRadius ?? 0.06 } : {}),
    };
    if (s.text != null) {
      slide.addText(s.text, {
        ...shapeOpts,
        fontFace: s.fontFace || d.fontFace, fontSize: SF(s.fontSize),
        color: resolveColor(colors, s.color, d.color),
        bold: !!s.bold, italic: !!s.italic,
        align: s.align || "center", valign: s.valign || "middle",
        margin: s.margin ?? 2,
      });
    } else {
      slide.addShape(this.pptx.ShapeType[shapeName], shapeOpts);
    }
  }
  return slide;
};

/**
 * Diagram slide: OI title bar + a figspec rendered as native editable shapes.
 * Same chrome/conventions as addFigureSlide.
 *
 * @param {string} title
 * @param {string} subtitle
 * @param {object|string} specOrPath - figspec object or path to figspecs/*.json
 * @param {object} [opts] - { fig_box, showSource, citation }
 */
OIDeckBuilder.prototype.addDiagramSlide = function (title, subtitle, specOrPath, opts = {}) {
  const hasSource = opts.showSource ?? this.showSource;
  const slide = this._newSlide(layoutFor(!!subtitle, hasSource));
  this.addTitleBar(slide, title, subtitle);
  const T = this.theme;
  const box = opts.fig_box ||
    (this.templateLayouts && hasSource ? T.figBox.SINGLE_SRC : T.figBox.SINGLE);
  this.addShapeFigure(slide, specOrPath, box);
  if (hasSource) this.addSourceLine(slide, opts.citation);
  this.addLogo(slide);
  return slide;
};

module.exports = { ...builder, loadFigSpec };
