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

  // Typography roles — one entry per kind of text on a slide. Every slide method
  // reads from here (no inline font sizes), so a role can be changed deck-wide via
  // the constructor's `theme` override or a style preset.
  text: {
    // lineSpacingMultiple 0.9 mirrors the template master's <a:lnSpc spcPct="90000">,
    // which the native title/subtitle placeholders inherit but a plain text box does
    // not. Without it the header text renders ~0.038" (title) / ~0.028" (subtitle)
    // lower than the template, and the subtitle's descenders sit on the teal rule.
    title:         { fontFace: "Lucida Bright", fontSize: 24, bold: true,  color: "262626", lineSpacingMultiple: 0.9 },
    subtitle:      { fontFace: "Lucida Sans",   fontSize: 16, bold: false, color: "626365", lineSpacingMultiple: 0.9 },
    panelTitle:    { fontFace: "Lucida Sans",   fontSize: 14, bold: true,  color: "262626" },
    bullet:        { fontFace: "Arial",         fontSize: 22, bold: false, color: "262626" },
    subBullet:     { fontFace: "Arial",         fontSize: 18, bold: false, color: "262626" },
    source:        { fontFace: "Lucida Sans",   fontSize: 14, bold: false, color: "262626" },
    footnote:      { fontFace: "Lucida Sans",   fontSize: 14, bold: false, color: "262626" },
    introTitle:    { fontFace: "Lucida Bright", fontSize: 32, bold: true,  color: "262626" },
    introSubtitle: { fontFace: "Lucida Sans",   fontSize: 20, bold: false, color: "262626" },
    introMeta:     { fontFace: "Lucida Sans",   fontSize: 12, bold: true,  color: "262626" },
    introAdvanced: { fontFace: "Lucida Bright", fontSize: 28, bold: false, color: "262626" },
    missingFigure: { fontFace: "Arial",         fontSize: 18, bold: false, color: "AA0000" },
  },

  // Layout constants (inches / points) formerly inlined in slide methods.
  layout: {
    panelTitleH: 0.22,          // height reserved above each panel for its title
    panelGap: 0.10,             // default horizontal gap between panels
    richTextBox: { x: 0.586, y: 1.46, w: 11.961, h: 4.75 }, // addRichTextSlide default box
    footnoteY: 6.7137,          // addTableSlide footnote top
    footnoteH: 0.35,
    paraSpaceAfter: { bullet: 14, subBullet: 4 },           // pt, addRichTextSlide
    underlineWeight: 1,         // teal title underline (legacy self-chrome mode)
    sourceRuleWeight: 0.75,     // source footer rule (legacy self-chrome mode)
  },

  // Figure placement boxes (inches).
  //
  // Every box shares the same horizontal span: x=0.679, w=11.975. That is the
  // template's own content width — its source rule runs 0.679 → 12.658, i.e. equal
  // 0.679" margins on both sides — so the left edge still aligns with the teal title
  // underline (also x=0.679) AND the box is symmetric about the slide's centerline
  // (13.333/2 = 6.667). Figures are contained + centered inside the box, so a
  // centered box is what makes them land centered on the slide. Only y/h differ.
  figBox: {
    // y=1.540 matches FOUR_PANEL: the subtitle box ends at 0.787+0.285 = 1.072 and
    // the teal rule sits at 1.095, so a figure starting at 1.185 cleared the subtitle
    // by 0.113" and read as touching it. A 17x9 figure is height-constrained in this
    // box, so the top is what sets the gap; the bottom stays clear of the slide edge.
    // h runs to the slide's bottom edge (1.540 + 5.960 = 7.500): the figure is
    // height-constrained here, so its canvas bleeds flush to the bottom.
    SINGLE:     { x: 0.679, y: 1.540, w: 11.975, h: 5.960 },
    // Source-footer variant: bottom pulled up to the content region (~6.77") so the
    // figure's canvas doesn't cover the layout's source rule at y=7.09.
    SINGLE_SRC: { x: 0.679, y: 1.540, w: 11.975, h: 5.230 },
    // 2-panel: pulled down for breathing room after the title.
    TWO_PANEL:  { x: 0.679, y: 2.040, w: 11.975, h: 4.732 },
    // 4-panel: slight breathing room after the title.
    FOUR_PANEL: { x: 0.679, y: 1.540, w: 11.975, h: 5.232 },
  },

  // Table styles
  table: {
    header:     { fontFace: "Lucida Sans", fontSize: 13, bold: true, color: "FFFFFF", fill: { color: "29B6A4" }, align: "center", valign: "middle" },
    cell:       { fontFace: "Lucida Sans", fontSize: 13, color: "262626", align: "center", valign: "middle" },
    altRow:     { fill: { color: "F2F2F2" } },
    groupLabel: { fontFace: "Lucida Sans", fontSize: 20, bold: true, color: "262626", align: "center", valign: "middle" },
    border:     { type: "solid", pt: 0.5, color: "D9D9D9" },
    position:   { x: 0.586, y: 1.50, w: 11.961 },
    rowH:       0.55,
  },

  // Header positioning — matches blank template.pptx (slideLayout3) placeholders
  // exactly. Title and subtitle are SEPARATE boxes so the subtitle is pinned to the
  // template's y (not flowed under the title, which would drift with title line height).
  titleBar:    { x: 0.572, y: 0.399, w: 11.961, h: 0.399 },
  subtitleBar: { x: 0.572, y: 0.787, w: 11.975, h: 0.285 },
  titleUnderline: { x: 0.679, y: 1.095, w: 2.092, h: 0 },

  // Logo positioning (small logo matches template "Picture 3").
  logoSmall: { x: 12.943, y: 7.088, w: 0.345, h: 0.333 },
  logoTitle: { x: 10.50, y: 6.80, w: 2.15, h: 0.37 },

  // Source line positioning (aligned to the content left margin)
  sourceRule: { x: 0.586, y: 7.09, w: 11.961, h: 0 },
  // Text sits just below the layout's source rule (matches template placeholder y=7.122).
  sourceText: { x: 0.586, y: 7.12, w: 11.961, h: 0.34 },
};

// Shorthand accessors
const C = theme.colors;
const F = theme.fonts;

// ══════════════════════════════════════════════════════════════════════════════
// TEMPLATE LAYOUTS
// ══════════════════════════════════════════════════════════════════════════════
//
// The generated deck is grafted onto the real OI template ("EOP Blank
// Template.pptx"), reusing its slide master + named layouts (with the teal
// underline, small logo, and source rule already positioned) + theme + embedded
// Lucida fonts. Each generated slide is routed to one of these named layouts by
// content type; the chrome (logo/underline/source-rule) comes from the layout, so
// the builder only draws the dynamic content (title/subtitle/source text, figures).

const LAYOUTS = {
  INTRO:    "OI Theme: Intro Slide",
  TS_SRC:   "OI-Theme: Title and Subtitle with Source Footer",
  TS_NOSRC: "1_OI-Theme: Title and Subtitle, no Source Footer",
  T_SRC:    "OI Theme: Title - No Subtitle with Source Footer",
  T_NOSRC:  "1_OI Theme: Title - No Subtitle, no Source Footer",
};

/** Route a slide to a template layout by (has subtitle) × (has source footer). */
function layoutFor(hasSubtitle, hasSource) {
  if (hasSubtitle && hasSource)  return LAYOUTS.TS_SRC;
  if (hasSubtitle && !hasSource) return LAYOUTS.TS_NOSRC;
  if (!hasSubtitle && hasSource) return LAYOUTS.T_SRC;
  return LAYOUTS.T_NOSRC;
}

// Title-slide background, as the constructor's introBackground option accepts it.
// "white" is a synonym for "plain" because that is how people describe the look;
// both canonicalize to "plain" so the rest of the builder tests one value.
const INTRO_BACKGROUNDS = { plain: "plain", white: "plain", photo: "photo" };

/**
 * Canonicalize introBackground, or throw naming what is allowed.
 *
 * A typo must not quietly fall back to the default: the whole point of the option
 * is that the two front pages look nothing alike, so silently rendering the wrong
 * one is worse than failing the build.
 */
function normalizeIntroBackground(value) {
  if (value === undefined || value === null || value === "") return "plain";
  const key = String(value).trim().toLowerCase();
  if (INTRO_BACKGROUNDS[key]) return INTRO_BACKGROUNDS[key];
  throw new Error(
    `introBackground: unknown value ${JSON.stringify(value)}. ` +
      `Valid values: ${Object.keys(INTRO_BACKGROUNDS).join(", ")} ` +
      `("white" is a synonym for "plain"; "plain" is the default).`
  );
}

// Intro-slide text placement (right-aligned, sitting in the layout's white band).
// Matches the template's Intro layout placeholders (center title / subtitle / body).
theme.introBox = {
  title:    { x: 1.681, y: 4.94, w: 10.972, h: 1.00 },
  subtitle: { x: 4.416, y: 6.02, w: 8.237,  h: 0.50 },
  meta:     { x: 4.416, y: 6.56, w: 8.237,  h: 0.66 },
  advanced: { x: 1.681, y: 4.83, w: 10.972, h: 2.42 }, // textItems form
  legacy:   { x: 0.53,  y: 2.25, w: 12.12,  h: 2.15 }, // plain title slide (drawn in full)
  gap:      [20, 10], // pt, spacer lines between the subtitle and the date/notice
};

// ══════════════════════════════════════════════════════════════════════════════
// STYLE PRESETS + THEME MERGING
// ══════════════════════════════════════════════════════════════════════════════
//
// A preset is a partial theme deep-merged onto the defaults. "guide2025" applies
// the official OI EOP Presentations Style Guide (PDF in "Guides and Brand DNA/")
// where the historical defaults deviate from it. Opt in per deck:
//   new OIDeckBuilder({ stylePreset: "guide2025" })
// Arbitrary per-deck overrides merge on top of any preset:
//   new OIDeckBuilder({ theme: { subtitleBar: { y: 0.85 } } })

const STYLE_PRESETS = {
  guide2025: {
    text: {
      // Style guide: "Section titles … Lucida Bright, Size 16, Bolded"
      panelTitle: { fontFace: "Lucida Bright", fontSize: 16 },
      // Style guide: "Primary text (bullet points) – Lucida Sans, min 16, max 24"
      bullet:    { fontFace: "Lucida Sans" },
      subBullet: { fontFace: "Lucida Sans" },
    },
    // Style guide: "Descriptive text (… table content) – Lucida Sans, Size 16"
    table: {
      header: { fontSize: 16 },
      cell:   { fontSize: 16 },
    },
    // Style guide: "Line weight – 0.5 (aqua header, source footer, axes, labels)"
    layout: { underlineWeight: 0.5, sourceRuleWeight: 0.5 },
  },
};

/** True for plain objects (not arrays/buffers/null). */
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && !Buffer.isBuffer(v);
}

/** Deep-merge `patch` onto `base` (mutates and returns `base`; arrays/scalars replace). */
function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return base;
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(base[k])) deepMerge(base[k], v);
    else base[k] = isPlainObject(v) ? deepMerge({}, v) : v;
  }
  return base;
}

/** Deep-clone a plain-object tree (theme values are JSON-safe). */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Normalize a color map to `{ "RRGGBB": "RRGGBB" }` with uppercase, hash-stripped keys/values.
 * Accepts keys/values with or without a leading "#".
 */
function normalizeColorMap(colorMap) {
  if (!colorMap) return null;
  const out = {};
  for (const [from, to] of Object.entries(colorMap)) {
    const k = String(from).replace(/^#/, "").toUpperCase();
    const v = String(to).replace(/^#/, "").toUpperCase();
    if (/^[0-9A-F]{6}$/.test(k) && /^[0-9A-F]{6}$/.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Apply a normalized color map to raw SVG text (matches `#RRGGBB`, case-insensitive). */
function applyColorMap(svg, normMap) {
  if (!normMap) return svg;
  return svg.replace(/#([0-9a-fA-F]{6})/g, (m, hex) => {
    const to = normMap[hex.toUpperCase()];
    return to ? "#" + to : m;
  });
}

/** Short deterministic tag for a color map, used to keep recolored PNGs in a separate cache slot. */
function colorMapTag(normMap) {
  if (!normMap) return "";
  const key = Object.entries(normMap).sort().map(([f, t]) => f + t).join("");
  return "_" + require("crypto").createHash("md5").update(key).digest("hex").slice(0, 8);
}

/**
 * Rasterize an SVG file to a high-res PNG. Optionally recolor via a normalized color map.
 */
function rasterizeSvgToPng(svgPath, pngPath, width = 2400, normMap = null) {
  const { Resvg } = require("@resvg/resvg-js");
  let svg = fs.readFileSync(svgPath, "utf8");
  svg = applyColorMap(svg, normMap);
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
 * Read an SVG's intrinsic pixel dimensions via resvg (used for aspect-ratio
 * layout when embedding the SVG directly instead of a rasterized PNG).
 */
function getSvgSize(svgPath) {
  const { Resvg } = require("@resvg/resvg-js");
  const resvg = new Resvg(fs.readFileSync(svgPath, "utf8"));
  return { width: resvg.width, height: resvg.height };
}

/**
 * Post-process a written .pptx to repair SVG preview images.
 *
 * When PptxGenJS embeds an SVG in Node it cannot rasterize the PNG fallback
 * ("preview") that PowerPoint stores alongside every SVG, so it writes a broken
 * 1px placeholder. Modern PowerPoint renders the real SVG (and can "Convert to
 * Shape" / ungroup it), but older viewers, thumbnails, and export paths show the
 * broken PNG. This pass finds each embedded SVG, rasterizes it with resvg, and
 * overwrites the matching preview PNG so the fallback looks correct everywhere.
 *
 * Matching is done from the slide XML itself: an SVG picture stores its preview
 * as `<a:blip r:embed="rIdPNG">` with a nested `<asvg:svgBlip r:embed="rIdSVG">`.
 * Both rIds resolve to media targets via the slide's .rels file.
 */
async function injectSvgPreviews(pptxPath, rasterWidth = 2400) {
  const JSZip = require("jszip");
  const { Resvg } = require("@resvg/resvg-js");

  const zip = await JSZip.loadAsync(fs.readFileSync(pptxPath));

  // Resolve a .rels Target (relative to ppt/slides/) to a zip path.
  const resolveTarget = (target) => {
    let t = target;
    let base = "ppt/slides/";
    while (t.startsWith("../")) {
      t = t.slice(3);
      base = base.replace(/[^/]+\/$/, "");
    }
    return base + t;
  };

  const slideNames = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(n)
  );

  let patched = 0;
  for (const slideName of slideNames) {
    const xml = await zip.file(slideName).async("string");

    // Collect (previewPngRid, svgRid) pairs from each <a:blip>…</a:blip> that
    // carries a nested svgBlip.
    const pairs = [];
    const blipRe = /<a:blip\b[^>]*\br:embed="(rId\d+)"[^>]*>([\s\S]*?)<\/a:blip>/g;
    let bm;
    while ((bm = blipRe.exec(xml)) !== null) {
      const svgMatch = bm[2].match(/<asvg:svgBlip\b[^>]*\br:embed="(rId\d+)"/);
      if (svgMatch) pairs.push({ pngRid: bm[1], svgRid: svgMatch[1] });
    }
    if (pairs.length === 0) continue;

    // Map rId -> Target from the slide's .rels file.
    const relsName = `ppt/slides/_rels/${path.basename(slideName)}.rels`;
    const relsFile = zip.file(relsName);
    if (!relsFile) continue;
    const relsXml = await relsFile.async("string");
    const relMap = {};
    const relRe = /<Relationship\b[^>]*?\/?>/g;
    let rm;
    while ((rm = relRe.exec(relsXml)) !== null) {
      const id = (rm[0].match(/\bId="([^"]+)"/) || [])[1];
      const target = (rm[0].match(/\bTarget="([^"]+)"/) || [])[1];
      if (id && target) relMap[id] = target;
    }

    for (const { pngRid, svgRid } of pairs) {
      const svgTarget = relMap[svgRid];
      const pngTarget = relMap[pngRid];
      if (!svgTarget || !pngTarget) continue;

      const svgZipPath = resolveTarget(svgTarget);
      const pngZipPath = resolveTarget(pngTarget);
      const svgFile = zip.file(svgZipPath);
      if (!svgFile) continue;

      const svgStr = await svgFile.async("string");
      const resvg = new Resvg(svgStr, { fitTo: { mode: "width", value: rasterWidth } });
      zip.file(pngZipPath, resvg.render().asPng());
      patched++;
    }
  }

  if (patched > 0) {
    const out = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    fs.writeFileSync(pptxPath, out);
    console.log(`  Repaired ${patched} SVG preview image${patched === 1 ? "" : "s"}.`);
  }
}

/**
 * Graft a PptxGenJS-generated deck onto the real OI template package.
 *
 * PptxGenJS cannot open an existing .pptx and reuse its layouts, so instead we
 * generate content slides with PptxGenJS, then rebuild the package using the
 * template as the base: the template's slide master, named slide layouts (teal
 * underline, small logo, source rule), theme, and embedded Lucida fonts are kept;
 * the template's own example slides are dropped; and each generated content slide
 * is copied in, pointed at the correct named layout via its .rels.
 *
 * @param {string} deckPath      - path to the PptxGenJS-written .pptx (overwritten in place)
 * @param {string} templatePath  - path to the OI template .pptx
 * @param {string[]} layoutNames - layout name per slide, in slide order (slide1..N)
 * @param {boolean[]} [hideMasterSp] - per slide, same order: strip the layout's own
 *        drawn chrome from that ONE slide (see the showMasterSp note in the copy loop)
 */
async function graftOntoTemplate(deckPath, templatePath, layoutNames, hideMasterSp = []) {
  const JSZip = require("jszip");

  const deckZip = await JSZip.loadAsync(fs.readFileSync(deckPath));
  const tzip = await JSZip.loadAsync(fs.readFileSync(templatePath));

  const basename = (p) => p.split("/").pop();
  const extname = (p) => { const b = basename(p); const i = b.lastIndexOf("."); return i >= 0 ? b.slice(i) : ""; };
  // Resolve a slide-relative rel Target (e.g. "../media/image3.png") to a zip path.
  const resolveFromSlide = (target) => {
    let t = target, base = "ppt/slides/";
    while (t.startsWith("../")) { t = t.slice(3); base = base.replace(/[^/]+\/$/, ""); }
    return base + t;
  };

  // 1) Map template layout NAME -> layout partname (slideLayoutN.xml).
  const layoutNameToPart = {};
  for (const name of Object.keys(tzip.files)) {
    const m = name.match(/^ppt\/slideLayouts\/(slideLayout\d+\.xml)$/);
    if (!m) continue;
    const xml = await tzip.file(name).async("string");
    const nm = (xml.match(/<p:cSld[^>]*\bname="([^"]*)"/) || [])[1];
    if (nm) layoutNameToPart[nm.replace(/&amp;/g, "&")] = m[1];
  }
  const missing = [...new Set(layoutNames)].filter((n) => !layoutNameToPart[n]);
  if (missing.length) {
    throw new Error(`Template is missing layouts: ${missing.join(", ")}. Available: ${Object.keys(layoutNameToPart).join(", ")}`);
  }

  // 2) Output = clone of the template minus its slides / notesSlides.
  const out = new JSZip();
  for (const [name, file] of Object.entries(tzip.files)) {
    if (file.dir) continue;
    if (/^ppt\/slides\//.test(name)) continue;      // drop template example slides + rels
    if (/^ppt\/notesSlides\//.test(name)) continue; // drop template notes
    out.file(name, await file.async("nodebuffer"));
  }

  // 3) Copy generated content slides + their media into the output.
  const deckSlides = Object.keys(deckZip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)[1]) - Number(b.match(/slide(\d+)\.xml/)[1]));

  let mediaCounter = 0;
  const added = []; // { num }
  const notesToAdd = []; // { num, xml } — speaker notes with real text, preserved through the graft
  for (let i = 0; i < deckSlides.length; i++) {
    const srcSlide = deckSlides[i];
    const num = i + 1;
    let slideXml = await deckZip.file(srcSlide).async("string");

    // Every layout in the OI template draws chrome of its own -- the Intro one a
    // photo background and logo band, the other four a teal rule and the small
    // corner logo. A slide the builder draws in full (the plain title slide) wants
    // none of it, so it sets showMasterSp="0": the "Hide Background Graphics"
    // attribute, which drops every NON-placeholder shape the layout and master
    // contribute, on this one slide only. That is why the plain title slide can sit
    // on a real template layout instead of needing a synthesized blank one.
    //
    // It is per slide, not per layout name, deliberately: T_NOSRC is a layout that
    // ordinary no-subtitle slides use, and they must keep their chrome.
    if (hideMasterSp[i] && !/\bshowMasterSp=/.test(slideXml)) {
      const before = slideXml;
      slideXml = slideXml.replace(/<p:sld\b((?:\s[^>]*)?)>/, '<p:sld$1 showMasterSp="0">');
      // Assert rather than trust: if a future PptxGenJS changes the root tag the
      // replace would no-op and the chrome would quietly come back -- a visual-only
      // regression no test catches.
      if (slideXml === before) {
        throw new Error(
          `Could not set showMasterSp on slide ${num}: no <p:sld> root tag matched. ` +
            `The plain title slide would render with the layout's chrome.`
        );
      }
    }

    const relName = `ppt/slides/_rels/${basename(srcSlide)}.rels`;
    const relXml = deckZip.file(relName) ? await deckZip.file(relName).async("string") : "";
    const rels = [...relXml.matchAll(/<Relationship\b[^>]*?\/>/g)].map((m) => m[0]);

    const newRels = [];
    for (const r of rels) {
      const type = (r.match(/\bType="([^"]+)"/) || [])[1] || "";
      const id = (r.match(/\bId="([^"]+)"/) || [])[1];
      const target = (r.match(/\bTarget="([^"]+)"/) || [])[1] || "";
      if (/\/slideLayout$/.test(type)) {
        const part = layoutNameToPart[layoutNames[i]] || layoutNameToPart[LAYOUTS.T_NOSRC];
        newRels.push(`<Relationship Id="${id}" Type="${type}" Target="../slideLayouts/${part}"/>`);
      } else if (/\/notesSlide$/.test(type)) {
        // Preserve speaker notes, but only when the notes body has real text (skip the
        // empty notesSlide PptxGenJS emits for every slide — its only <a:t> is the
        // slide-number field). notesMaster/theme are inherited from the template clone.
        const nf = deckZip.file(resolveFromSlide(target));
        if (nf) {
          const nxml = await nf.async("string");
          const body = nxml.replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, "");
          if (/<a:t>[^<]*\S[^<]*<\/a:t>/.test(body)) {
            notesToAdd.push({ num, xml: nxml });
            newRels.push(`<Relationship Id="${id}" Type="${type}" Target="../notesSlides/notesSlide${num}.xml"/>`);
          }
        }
        continue;
      } else if (/\/image$/.test(type)) {
        const srcMedia = resolveFromSlide(target);
        const ext = extname(srcMedia);
        const newBase = `oi_gen_s${num}_${mediaCounter++}${ext}`;
        out.file(`ppt/media/${newBase}`, await deckZip.file(srcMedia).async("nodebuffer"));
        newRels.push(`<Relationship Id="${id}" Type="${type}" Target="../media/${newBase}"/>`);
      } else {
        newRels.push(r); // keep anything else verbatim
      }
    }

    out.file(`ppt/slides/slide${num}.xml`, slideXml);
    out.file(
      `ppt/slides/_rels/slide${num}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${newRels.join("")}</Relationships>`
    );
    added.push({ num });
  }

  // 3b) Write preserved notesSlides (+ rels pointing at the template's notesMaster and the slide).
  for (const n of notesToAdd) {
    out.file(`ppt/notesSlides/notesSlide${n.num}.xml`, n.xml);
    out.file(
      `ppt/notesSlides/_rels/notesSlide${n.num}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${n.num}.xml"/>` +
        `</Relationships>`
    );
  }

  // 4) presentation.xml.rels — drop old slide rels, append new ones after max rId.
  let presRels = await out.file("ppt/_rels/presentation.xml.rels").async("string");
  presRels = presRels.replace(/<Relationship\b[^>]*?Type="[^"]*\/slide"[^>]*?\/>/g, "");
  let maxRid = Math.max(0, ...[...presRels.matchAll(/\bId="rId(\d+)"/g)].map((m) => Number(m[1])));
  for (const s of added) { s.rid = `rId${++maxRid}`; }
  const relEntries = added
    .map((s) => `<Relationship Id="${s.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${s.num}.xml"/>`)
    .join("");
  presRels = presRels.replace("</Relationships>", relEntries + "</Relationships>");
  out.file("ppt/_rels/presentation.xml.rels", presRels);

  // 5) presentation.xml — rebuild sldIdLst in slide order.
  let presXml = await out.file("ppt/presentation.xml").async("string");
  let sldId = 256;
  const sldIds = added.map((s) => `<p:sldId id="${sldId++}" r:id="${s.rid}"/>`).join("");
  if (/<p:sldIdLst\s*\/>/.test(presXml)) {
    presXml = presXml.replace(/<p:sldIdLst\s*\/>/, `<p:sldIdLst>${sldIds}</p:sldIdLst>`);
  } else {
    presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${sldIds}</p:sldIdLst>`);
  }
  out.file("ppt/presentation.xml", presXml);

  // 6) [Content_Types].xml — refresh slide overrides + ensure media Defaults.
  let ct = await out.file("[Content_Types].xml").async("string");
  ct = ct.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, "");
  ct = ct.replace(/<Override PartName="\/ppt\/notesSlides\/[^"]*"[^>]*\/>/g, "");
  const overrides = added
    .map((s) => `<Override PartName="/ppt/slides/slide${s.num}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join("");
  const notesOverrides = notesToAdd
    .map((n) => `<Override PartName="/ppt/notesSlides/notesSlide${n.num}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`)
    .join("");
  ct = ct.replace("</Types>", overrides + notesOverrides + "</Types>");
  for (const [ext, type] of [["png", "image/png"], ["svg", "image/svg+xml"], ["jpeg", "image/jpeg"], ["jpg", "image/jpg"]]) {
    if (!new RegExp(`<Default Extension="${ext}"`).test(ct)) {
      ct = ct.replace('<Default Extension="xml"', `<Default Extension="${ext}" ContentType="${type}"/><Default Extension="xml"`);
    }
  }
  out.file("[Content_Types].xml", ct);

  // 7) docProps/app.xml — keep the slide count from going stale (avoids repair prompts).
  const appName = "docProps/app.xml";
  if (out.file(appName)) {
    let app = await out.file(appName).async("string");
    app = app.replace(/<Slides>\d+<\/Slides>/, `<Slides>${added.length}</Slides>`);
    out.file(appName, app);
  }

  const buf = await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(deckPath, buf);
  console.log(`  Grafted ${added.length} slide${added.length === 1 ? "" : "s"} onto template layouts.`);
}

/**
 * Fit an image into a fixed box while preserving aspect ratio ("contain" fit).
 * valign: "middle" centers vertically; "top" pins to top of box.
 */
function containInBox(box, imgAspect, valign = "middle", halign = "center") {
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
    // A height-constrained figure is narrower than its box. Centering it leaves the
    // figure floating right of the content margin -- for a 17x9 event study, 0.358"
    // right of where the title, subtitle and teal rule all start. halign:"left"
    // anchors it to the margin instead, and does so for any aspect ratio.
    x = halign === "left" ? box.x : box.x + (box.w - w) / 2;
  }

  const round = (v) => Math.round(v * 1000) / 1000;
  return { x: round(x), y: round(y), w: round(w), h: round(h) };
}

/**
 * Resolve a figure path to an embeddable PNG.
 * Priority: .svg (-> cached PNG) > .png
 * Callers pass .pdf names; we auto-detect the best available format.
 */
function resolveFigure(figPath, cacheDir, rasterWidth = 2400, colorMap = null) {
  if (!figPath) return null;

  const noExt = figPath.replace(/\.[^.]+$/, "");
  const normMap = normalizeColorMap(colorMap);
  const tag = colorMapTag(normMap);

  // 1) SVG -> cached PNG
  const svgPath = noExt + ".svg";
  if (fs.existsSync(svgPath)) {
    ensureDir(cacheDir);
    const pngPath = path.join(cacheDir, path.basename(noExt) + tag + ".png");
    const needRegen =
      !fs.existsSync(pngPath) ||
      fs.statSync(pngPath).mtimeMs < fs.statSync(svgPath).mtimeMs;

    if (needRegen) {
      console.log(`  Rasterizing ${path.basename(svgPath)}${tag ? " (recolored)" : ""} -> cache...`);
      rasterizeSvgToPng(svgPath, pngPath, rasterWidth, normMap);
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
    if (args[i] === "--embed-svg") opts.embedSvg = true;
    if (args[i] === "--no-embed-svg") opts.embedSvg = false;
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
   * @param {boolean} [opts.showSource] - Add the source footnote to every figure slide by default
   * @param {string} [opts.citation]  - Default source citation text (used when a slide shows the source line)
   * @param {boolean} [opts.embedSvg] - Embed figures as vector SVG (so they can be
   *   "Convert to Shape" / ungrouped in PowerPoint) instead of a flat PNG. Default: true.
   *   Falls back to PNG for figures that only exist as PNG. Set false for pure-PNG decks.
   * @param {string} [opts.stylePreset] - Named style preset (see STYLE_PRESETS), e.g.
   *   "guide2025" for the official OI EOP style-guide values.
   * @param {object} [opts.theme]     - Partial theme deep-merged onto the defaults (after
   *   any preset). E.g. { text: { subtitle: { fontSize: 14 } }, subtitleBar: { y: 0.85 } }.
   */
  constructor(opts = {}) {
    // Per-instance theme: defaults, then optional style preset, then per-deck overrides.
    // All slide methods read from this.theme (the module-level `theme` is the default set).
    if (opts.stylePreset && !STYLE_PRESETS[opts.stylePreset]) {
      throw new Error(`Unknown stylePreset "${opts.stylePreset}". Available: ${Object.keys(STYLE_PRESETS).join(", ")}`);
    }
    this.theme = deepClone(theme);
    if (opts.stylePreset) deepMerge(this.theme, STYLE_PRESETS[opts.stylePreset]);
    if (opts.theme) deepMerge(this.theme, opts.theme);

    this.figDir = opts.figDir || ".";
    this.output = opts.output || "deck.pptx";
    this.cacheDir = opts.cacheDir || path.join(path.dirname(this.figDir), ".pptx_cache");
    this.rasterWidth = opts.rasterWidth || 2400;
    // Embed SVGs directly (vector, ungroupable in PowerPoint) when available.
    // Any SVG without a matching PNG preview is repaired in save() via injectSvgPreviews.
    this.embedSvg = opts.embedSvg !== false;
    // Optional SVG recolor map applied at rasterization, e.g. { "FAA523": "000000" }.
    // Keys/values are hex (with or without "#"). Source SVGs are never modified.
    this.colorMap = opts.colorMap || null;
    const builderDir = __dirname;
    // Assets resolve from this folder first, then the parent (so oi-slide-v2 can live
    // inside the original oi-slide checkout without duplicating binaries).
    const firstExisting = (...cands) => cands.find((c) => fs.existsSync(c)) || cands[0];
    this.logoSmallPath = opts.logoSmall || firstExisting(
      path.join(builderDir, "oi_logo.png"), path.join(builderDir, "..", "oi_logo.png"));
    this.logoTitlePath = opts.logoTitle || firstExisting(
      path.join(builderDir, "oi_logo_full.png"), path.join(builderDir, "..", "oi_logo_full.png"));

    // Real OI template to graft named layouts from. When present, every generated
    // slide is routed to one of the template's named layouts and the layout supplies
    // the chrome (small logo, teal underline, source rule, intro background), so the
    // builder skips drawing those. Set templateLayouts:false to fall back to the
    // legacy self-drawn chrome (e.g. if the template file is unavailable).
    this.templatePath = opts.templatePath || firstExisting(
      path.join(builderDir, "EOP Blank Template.pptx"), path.join(builderDir, "..", "EOP Blank Template.pptx"));
    this.templateLayouts = opts.templateLayouts !== false && fs.existsSync(this.templatePath);

    // Title-slide background. "plain" is the DEFAULT on purpose, not by accident:
    // the house front page is the white one -- right-aligned title block at y=2.25,
    // full OI logo bottom-right -- and the template's photographic Intro layout is
    // the thing you opt into. Changing this default changes every deck the package
    // generates, so it is stated here rather than inferred from a falsy check.
    // "white" is accepted as a synonym because that is what people call it.
    this.introBackground = normalizeIntroBackground(opts.introBackground);
    // Layout name recorded per slide (slide creation order), consumed by the graft.
    this._layoutForSlide = [];
    // Parallel to _layoutForSlide: whether that slide hides the layout's own drawn
    // chrome. Pushed in _newSlide together with the layout name so the two arrays
    // cannot drift and land the attribute on the wrong slide.
    this._hideMasterSp = [];

    this.pptx = new pptxgen();
    this.pptx.layout = "LAYOUT_WIDE"; // 13.33" x 7.50"
    this.pptx.author = opts.author || "Opportunity Insights";
    this.pptx.company = opts.company || "Opportunity Insights";

    // Source footnote defaults. Set showSource: true in the constructor to add
    // the source line to every figure slide without repeating per-slide opts.
    this.showSource = opts.showSource || false;
    this.citation = opts.citation || "Chetty, Fogel, Katz, Noray, Porter, Reisinger (2025)";
  }

  // ── Convenience: figure path helper ──────────────────────────────────────

  /** Build a figure path from a short name (extension is a hint; resolveFigure finds SVG/PNG). */
  fig(name) {
    return path.join(this.figDir, name + ".pdf");
  }

  /** Resolve a figure path to an embeddable PNG (with SVG rasterization + caching). */
  resolveFigure(figPath) {
    return resolveFigure(figPath, this.cacheDir, this.rasterWidth, this.colorMap);
  }

  /**
   * Prepare the SVG that will actually be embedded. Without a color map this is
   * the original file; with a color map we write a recolored copy to the cache so
   * the source SVG is never modified (and the repaired PNG preview matches it).
   */
  _prepareEmbedSvg(svgPath) {
    const normMap = normalizeColorMap(this.colorMap);
    if (!normMap) return svgPath;
    ensureDir(this.cacheDir);
    const out = path.join(
      this.cacheDir,
      path.basename(svgPath, ".svg") + colorMapTag(normMap) + ".svg"
    );
    const needRegen =
      !fs.existsSync(out) ||
      fs.statSync(out).mtimeMs < fs.statSync(svgPath).mtimeMs;
    if (needRegen) {
      fs.writeFileSync(out, applyColorMap(fs.readFileSync(svgPath, "utf8"), normMap));
    }
    return out;
  }

  /**
   * Resolve a figure to an embeddable asset plus its aspect ratio (width/height).
   *
   * When `embedSvg` is on and an SVG exists, returns the SVG path so PowerPoint
   * embeds the vector (later ungroupable via "Convert to Shape"). Otherwise falls
   * back to a rasterized/cached PNG. Returns null if nothing usable is found.
   *
   * @returns {{ path: string, aspect: number } | null}
   */
  resolveAsset(figPath) {
    if (!figPath) return null;

    if (this.embedSvg) {
      const svgPath = figPath.replace(/\.[^.]+$/, "") + ".svg";
      if (fs.existsSync(svgPath)) {
        const embedPath = this._prepareEmbedSvg(svgPath);
        const { width, height } = getSvgSize(embedPath);
        if (width > 0 && height > 0) {
          return { path: embedPath, aspect: width / height };
        }
      }
    }

    const resolved = this.resolveFigure(figPath);
    if (resolved && fs.existsSync(resolved)) {
      const { width, height } = getPngSize(resolved);
      return { path: resolved, aspect: width / height };
    }
    return null;
  }

  // ── Low-level slide element helpers ──────────────────────────────────────

  /** Add a raw slide and return it (for custom layouts). */
  addSlide() {
    return this._newSlide(LAYOUTS.T_NOSRC);
  }

  /**
   * Create a slide and record which template layout it should be grafted onto.
   * Slides are recorded in creation order, matching slide1..N in the written file.
   *
   * hideMasterSp strips that layout's own drawn chrome (teal rule, corner logo,
   * photo band) from this slide alone. Recorded here, in lockstep with the layout
   * name, so the two can never fall out of step.
   */
  _newSlide(layoutName, hideMasterSp = false) {
    this._layoutForSlide.push(layoutName);
    this._hideMasterSp.push(hideMasterSp);
    return this.pptx.addSlide();
  }

  /** Add title bar (title + optional subtitle + teal underline). */
  addTitleBar(slide, titleText, subtitleText = null) {
    const T = this.theme, X = T.text;
    // Title and subtitle are placed in separate boxes at the template's exact
    // placeholder positions so each is pinned (the subtitle does not drift with
    // the title's line height).
    const tb = T.titleBar;
    slide.addText(titleText, {
      x: tb.x, y: tb.y, w: tb.w, h: tb.h,
      ...X.title,
      align: "left", valign: "top",
    });

    if (subtitleText) {
      const sb = T.subtitleBar;
      slide.addText(subtitleText, {
        x: sb.x, y: sb.y, w: sb.w, h: sb.h,
        ...X.subtitle,
        align: "left", valign: "top",
      });
    }

    // The teal underline is part of the template layout (positioned differently for
    // subtitle vs. no-subtitle layouts) — only draw it in legacy self-chrome mode.
    if (!this.templateLayouts) {
      const ul = T.titleUnderline;
      slide.addShape(this.pptx.ShapeType.line, {
        x: ul.x, y: ul.y, w: ul.w, h: ul.h,
        line: { color: T.colors.OI_GREEN, width: T.layout.underlineWeight },
      });
    }
  }

  /** Add source line with bold "Source: " + regular citation (rule comes from layout). */
  addSourceLine(slide, citation = this.citation) {
    const T = this.theme, X = T.text;
    // The horizontal source rule is part of the "…with Source Footer" layouts —
    // only draw it in legacy self-chrome mode.
    if (!this.templateLayouts) {
      const sr = T.sourceRule;
      slide.addShape(this.pptx.ShapeType.line, {
        x: sr.x, y: sr.y, w: sr.w, h: sr.h,
        line: { color: T.colors.LINE_GRAY, width: T.layout.sourceRuleWeight },
      });
    }

    const st = T.sourceText;
    slide.addText([
      {
        text: "Source: ",
        options: { ...X.source, bold: true },
      },
      {
        text: citation,
        options: { ...X.source },
      },
    ], {
      x: st.x, y: st.y, w: st.w, h: st.h,
      align: "left", valign: "top",
    });
  }

  /** Add small OI logo to bottom-right corner (no-op when the layout supplies it). */
  addLogo(slide) {
    // The layout supplies the corner logo on every slide that calls this. The plain
    // title slide is the exception -- it hides the layout's shapes -- but it stamps
    // its own full-size logo inline and never routes through here.
    if (this.templateLayouts) return;
    if (this.logoSmallPath && fs.existsSync(this.logoSmallPath)) {
      const pos = this.theme.logoSmall;
      slide.addImage({
        path: this.logoSmallPath,
        x: pos.x, y: pos.y, w: pos.w, h: pos.h,
      });
    }
  }

  /** Attach a speaker note to a slide (opts.notes). Preserved through the template graft. */
  _applyNotes(slide, opts) {
    if (opts && opts.notes) slide.addNotes(String(opts.notes));
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
    const T = this.theme, X = T.text, ib = T.introBox;
    const advanced = typeof titleOrOpts === "object" && titleOrOpts.textItems;

    // Plain is the default; the photographic Intro layout is opt-in. The plain
    // slide still needs a layout to sit on -- the graft points every slide at one --
    // so it borrows the leanest of them (T_NOSRC) and hides its drawn shapes, which
    // leaves the master's white page and nothing else. Nothing is synthesized: the
    // deck ships the template's own five layouts, unaltered.
    //
    // Without a template at all, templateLayouts is false, no graft runs, and the
    // plain branch below already draws the whole page -- so that path is unchanged.
    const useTemplateIntro = this.templateLayouts && this.introBackground === "photo";
    const slide = useTemplateIntro
      ? this._newSlide(LAYOUTS.INTRO)
      : this._newSlide(LAYOUTS.T_NOSRC, true);

    if (useTemplateIntro) {
      // Intro layout supplies the photo background + full OI logo band. Place the
      // title / subtitle / date+notice right-aligned inside that band, matching the
      // layout's center-title / subtitle / body placeholders.
      const title = advanced ? "" : (typeof titleOrOpts === "string" ? titleOrOpts : "");
      if (advanced) {
        const items = titleOrOpts.textItems.map((item) => ({
          text: item.text,
          options: { ...X.introAdvanced, breakLine: true, ...item.options },
        }));
        const b = ib.advanced;
        slide.addText(items, { x: b.x, y: b.y, w: b.w, h: b.h, align: "right", valign: "top" });
      } else {
        slide.addText(title, {
          ...ib.title, ...X.introTitle,
          align: "right", valign: "bottom",
        });
        if (subtitle) {
          slide.addText(subtitle, {
            ...ib.subtitle, ...X.introSubtitle,
            align: "right", valign: "top",
          });
        }
        const meta = [];
        if (date) meta.push({ text: date, options: { ...X.introMeta, breakLine: true } });
        if (notice) meta.push({ text: notice, options: { ...X.introMeta } });
        if (meta.length) {
          slide.addText(meta, { ...ib.meta, align: "right", valign: "top" });
        }
      }
      return slide;
    }

    // ── Plain title slide: drawn in full, on a white page (the default) ──────
    // State the white explicitly instead of inheriting the master's schemeClr bg1.
    // Hiding the layout's shapes does not touch a layout's own <p:bg>, so a future
    // OI template that gives this layout a background would otherwise show through;
    // a slide-level background wins over both layout and master.
    slide.background = { color: "FFFFFF" };
    const textBox = ib.legacy;
    let textItems;
    if (advanced) {
      textItems = titleOrOpts.textItems.map((item) => ({
        text: item.text,
        options: { ...X.introAdvanced, fontSize: X.title.fontSize, breakLine: true, ...item.options },
      }));
    } else {
      const t = typeof titleOrOpts === "string" ? titleOrOpts : "";
      textItems = [{ text: t, options: { ...X.introTitle, breakLine: true } }];
      if (subtitle) textItems.push({ text: subtitle, options: { ...X.introTitle, fontSize: X.title.fontSize, bold: false, breakLine: true } });
      // Gap between the subtitle and the date/notice block. The spacer runs carry a
      // SPACE, not "": PptxGenJS drops fontSize on an empty run, so empty spacers
      // inherit the 32pt title size and the meta block lands ~34pt too low.
      if (date || notice) {
        for (const pt of T.introBox.gap) {
          textItems.push({ text: " ", options: { fontSize: pt, breakLine: true } });
        }
      }
      if (date) textItems.push({ text: date, options: { ...X.introMeta, breakLine: true } });
      if (notice) textItems.push({ text: notice, options: { ...X.introMeta } });
    }
    slide.addText(textItems, { x: textBox.x, y: textBox.y, w: textBox.w, h: textBox.h, align: "right", valign: "top" });
    if (this.logoTitlePath && fs.existsSync(this.logoTitlePath)) {
      const pos = T.logoTitle;
      slide.addImage({ path: this.logoTitlePath, x: pos.x, y: pos.y, w: pos.w, h: pos.h });
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
    const hasSource = opts.showSource ?? this.showSource;
    const slide = this._newSlide(layoutFor(!!subtitle, hasSource));
    this.addTitleBar(slide, title, subtitle);

    // On source-footer layouts the layout owns a rule at y=7.09; use the shorter
    // box so the figure's canvas doesn't cover it. (Multi-panel boxes already clear it.)
    const T = this.theme;
    const defaultBox = this.templateLayouts && hasSource ? T.figBox.SINGLE_SRC : T.figBox.SINGLE;
    const box = opts.fig_box || defaultBox;
    const asset = this.resolveAsset(figPath);

    if (asset) {
      const placement = containInBox(box, asset.aspect, "middle", "left");
      slide.addImage({
        path: asset.path,
        x: placement.x, y: placement.y,
        w: placement.w, h: placement.h,
      });
    } else {
      slide.addText(`Missing figure:\n${path.basename(figPath || "")}`, {
        x: 1.0, y: 3.0, w: 11.0, h: 1.2,
        ...T.text.missingFigure,
        align: "center", valign: "middle",
      });
    }

    if (opts.showSource ?? this.showSource) {
      this.addSourceLine(slide, opts.citation);
    }
    this.addLogo(slide);
    this._applyNotes(slide, opts);
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
    const hasSource = opts.showSource ?? this.showSource;
    const slide = this._newSlide(layoutFor(!!subtitle, hasSource));
    this.addTitleBar(slide, title, subtitle);

    const T = this.theme, X = T.text;
    const defaultBox = rows > 1 ? T.figBox.FOUR_PANEL : T.figBox.TWO_PANEL;
    const box = opts.fig_box || defaultBox;
    const gap = opts.gap ?? T.layout.panelGap;
    const vgap = opts.vgap ?? (rows > 1 ? 0.00 : T.layout.panelGap);
    const panelTitles = opts.panelTitles ?? null;
    const PANEL_TITLE_H = T.layout.panelTitleH;
    const titleFontSize = opts.titleFontSize ?? X.panelTitle.fontSize;

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
      const asset = this.resolveAsset(fp);
      if (asset) {
        const imgAspect = asset.aspect;
        const cellAspect = cellW / cellH;
        const renderedH = imgAspect >= cellAspect ? cellW / imgAspect : cellH;
        return { path: asset.path, aspect: imgAspect, renderedH };
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
          ...X.panelTitle, fontSize: titleFontSize,
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
          ...X.missingFigure, fontSize: X.panelTitle.fontSize,
          align: "center", valign: "middle",
        });
      }
    }

    if (opts.showSource ?? this.showSource) {
      this.addSourceLine(slide, opts.citation);
    }
    this.addLogo(slide);
    this._applyNotes(slide, opts);
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
    const hasSource = opts.showSource ?? this.showSource;
    const slide = this._newSlide(layoutFor(!!subtitle, hasSource));
    this.addTitleBar(slide, title, subtitle);

    const T = this.theme, X = T.text;
    const box = opts.fig_box || T.figBox.FOUR_PANEL;
    const gap = opts.gap ?? 0.00;
    const vgap = opts.vgap ?? 0.00;
    const PANEL_TITLE_H = T.layout.panelTitleH;
    const titleFontSize = opts.titleFontSize ?? X.panelTitle.fontSize;
    const cols = 2, rows = 2;

    const availH = box.h - 2 * PANEL_TITLE_H;
    const cellW = (box.w - gap * (cols - 1)) / cols;
    const cellH = (availH - vgap * (rows - 1)) / rows;

    // Resolve all 3 images
    const imgs = figPaths.map((fp) => {
      const asset = this.resolveAsset(fp);
      if (asset) {
        const imgAspect = asset.aspect;
        const cellAspect = cellW / cellH;
        const renderedH = imgAspect >= cellAspect ? cellW / imgAspect : cellH;
        return { path: asset.path, aspect: imgAspect, renderedH };
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
          ...X.panelTitle, fontSize: titleFontSize,
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
          ...X.panelTitle, fontSize: titleFontSize,
          align: "center", valign: "bottom",
        });
      }

      if (img) {
        const cellBox = { x: cx, y: botImgY, w: cellW, h: row1H };
        const p = containInBox(cellBox, img.aspect, "top");
        slide.addImage({ path: img.path, x: p.x, y: p.y, w: p.w, h: p.h });
      }
    }

    if (opts.showSource ?? this.showSource) {
      this.addSourceLine(slide, opts.citation);
    }
    this.addLogo(slide);
    this._applyNotes(slide, opts);
    return slide;
  }

  /**
   * Text slide with title bar + bullet points.
   *
   * Each bullet can be a string (default 22pt) or [text, fontSize, color, bold].
   */
  addTextSlide(title, bulletPoints, subtitle = null) {
    const slide = this._newSlide(layoutFor(!!subtitle, false));
    this.addTitleBar(slide, title, subtitle);
    const T = this.theme, X = T.text;

    const x = 1.15, w = 11.62;
    let cursorY = T.layout.richTextBox.y;
    const SPACE_BEFORE = 0.18;

    for (let i = 0; i < bulletPoints.length; i++) {
      const point = bulletPoints[i];
      let text, fontSize, color, bold;

      if (Array.isArray(point)) {
        [text, fontSize, color, bold] = point;
      } else {
        text = point; fontSize = X.bullet.fontSize; color = X.bullet.color; bold = false;
      }

      if (typeof fontSize !== "number") fontSize = X.bullet.fontSize;
      if (typeof color === "string") color = color.replace("#", "");

      const boxH = Math.max(0.30, (fontSize / 72) * 1.4 * (text.length > 80 ? 2 : 1));
      if (i > 0) cursorY += SPACE_BEFORE;

      slide.addText([
        { text: "\u2022 ", options: { fontFace: X.bullet.fontFace, fontSize, color: T.colors.OI_GREEN, bold: false } },
        { text, options: { fontFace: X.bullet.fontFace, fontSize, color, bold } },
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
    const hasSource = opts.showSource ?? false;
    const slide = this._newSlide(layoutFor(!!opts.subtitle, hasSource));
    this.addTitleBar(slide, title, opts.subtitle);
    const T = this.theme, X = T.text;
    const SIZE_TOP = X.bullet.fontSize, SIZE_SUB = X.subBullet.fontSize;
    const SPACE_TOP = T.layout.paraSpaceAfter.bullet, SPACE_SUB = T.layout.paraSpaceAfter.subBullet;

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
          styledItems.push({ text: "", options: { fontSize: SIZE_SUB, breakLine: true } });
          continue;
        }

        // Detect indent from leading whitespace or "  - " prefix
        if (text.startsWith("  - ") || text.startsWith("    -")) {
          text = text.replace(/^\s*-\s*/, "");
          indent = 1;
        }

        // Detect (small) suffix
        let fontSize = indent > 0 ? SIZE_SUB : SIZE_TOP;
        if (text.endsWith("(small)")) {
          text = text.replace(/\s*\(small\)\s*$/, "");
          fontSize = SIZE_SUB;
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
        const paraSpaceAfter = indent > 0 ? SPACE_SUB : SPACE_TOP;
        styledItems.push(
          { text: prefix, options: { fontSize, color: T.colors.OI_GREEN, bold: false, bullet: bulletShim, indentLevel: indent || 0, paraSpaceBefore, paraSpaceAfter } },
          { text, options: {
            fontSize,
            color: X.bullet.color,
            breakLine: true,
          }},
        );
        continue;
      }

      // Full {text, options} format — apply OI defaults
      const o = item.options || {};
      const indent = o.indentLevel || 0;
      const fontSize = o.fontSize || SIZE_TOP;

      // Determine prefix
      let prefix;
      if (o.bullet && o.bullet.type === "number") {
        numberCounter++;
        prefix = `${numberCounter}. `;
      } else {
        prefix = indent > 0 ? "– " : "• ";
      }

      // Strip bullet from options (we handle it as text prefix now)
      // Use invisible bullet (zero-width space) to get indentLevel margins
      const { bullet, ...restOpts } = o;
      const bulletShim = { characterCode: "200B" };
      const options = {
        fontSize,
        color: X.bullet.color,
        breakLine: true,
        paraSpaceBefore: 0,
        paraSpaceAfter: indent > 0 ? SPACE_SUB : SPACE_TOP,
        ...restOpts,
      };
      // Remove bullet from restOpts if it leaked through
      delete options.bullet;

      if (item.text) {
        styledItems.push(
          { text: prefix, options: { fontSize, color: T.colors.OI_GREEN, bold: false, bullet: bulletShim, indentLevel: indent, paraSpaceBefore: options.paraSpaceBefore, paraSpaceAfter: options.paraSpaceAfter } },
          { text: item.text, options },
        );
      } else {
        numberCounter = 0;
        styledItems.push({ text: "", options });
      }
    }

    const textBox = opts.textBox || T.layout.richTextBox;
    slide.addText(styledItems, {
      x: textBox.x, y: textBox.y, w: textBox.w, h: textBox.h,
      fontFace: X.bullet.fontFace, valign: "top",
    });

    if (hasSource) this.addSourceLine(slide, opts.citation);
    this.addLogo(slide);
    this._applyNotes(slide, opts);
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
    const hasSource = opts.showSource ?? false;
    const slide = this._newSlide(layoutFor(!!opts.subtitle, hasSource));
    this.addTitleBar(slide, title, opts.subtitle);

    const T = this.theme;
    const ts = T.table;

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
        x: pos.x, y: T.layout.footnoteY, w: pos.w, h: T.layout.footnoteH,
        ...T.text.footnote,
        align: "left", valign: "top",
      });
    }

    if (hasSource) this.addSourceLine(slide, opts.citation);
    this.addLogo(slide);
    this._applyNotes(slide, opts);
    return slide;
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async save(outputPath) {
    // Resolve once, here: pptxgenjs joins a relative fileName against cwd, which is
    // not necessarily where the caller meant. An absolute path survives untouched.
    // injectSvgPreviews() and graftOntoTemplate() below are handed this same value,
    // so all three act on the one real path.
    const out = path.resolve(outputPath || this.output);
    await this.pptx.writeFile({ fileName: out });
    // Repair the broken PNG previews PptxGenJS leaves on Node-embedded SVGs so the
    // vector figures render in every viewer while staying ungroupable in PowerPoint.
    if (this.embedSvg) {
      await injectSvgPreviews(out, this.rasterWidth);
    }
    // Graft the generated slides onto the real OI template so each slide uses the
    // correct named layout (inheriting the template's master, logo, teal underline,
    // source rule, theme, and embedded fonts).
    if (this.templateLayouts) {
      await graftOntoTemplate(out, this.templatePath, this._layoutForSlide, this._hideMasterSp);
    }
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
  STYLE_PRESETS,
  deepMerge,
  LAYOUTS,
  layoutFor,

  // Utility functions (for custom slide layouts)
  ensureDir,
  rasterizeSvgToPng,
  getPngSize,
  getSvgSize,
  injectSvgPreviews,
  graftOntoTemplate,
  containInBox,
  resolveFigure,
  parseArgs,
};
// end of oi_deck_builder.js
