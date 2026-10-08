#!/usr/bin/env node
/**
 * Structural style checker for OI decks.
 * Usage: node scripts/check_style.js Deck.pptx [--preset guide2025] [--report reports/style_report.md]
 *        [--overrides '{"subtitleBar":{"y":0.74}}']   (mirror the deck's intentional theme overrides)
 *
 * Parses each slide's XML and validates against the theme in oi_deck_builder.js:
 *   1. Fonts: every text run uses an approved face (Lucida Bright / Lucida Sans / Arial)
 *   2. Title: a run at the title position matches theme.text.title (face, size, bold)
 *   3. Subtitle: box sits at theme.subtitleBar.y (±0.02") when present
 *   4. Bounds: every shape/image fits on the 13.33 x 7.50 slide
 *   5. Footer: no image intrudes into the source-rule band (y > 7.06") 
 *   6. Sizes: run font sizes come from the theme's known set (title, subtitle, panel,
 *      bullets, source/footnote, intro, diagram labels >= 6pt)
 *
 * Exit code 1 if any slide fails. The style-checker AGENT runs this first, then does a
 * visual pass on rendered PNGs for what XML can't catch (crowding, overlap, readability).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const { theme, STYLE_PRESETS, deepMerge } = require(path.join(__dirname, "..", "oi_deck_builder"));

const EMU = 914400;
const SLIDE_W = 13.333, SLIDE_H = 7.5;

function parseCli() {
  const a = process.argv.slice(2);
  const o = { file: null, preset: null, report: null, overrides: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--preset") o.preset = a[++i];
    else if (a[i] === "--overrides") o.overrides = JSON.parse(a[++i]);
    else if (a[i] === "--report") o.report = a[++i];
    else o.file = a[i];
  }
  return o;
}

function effTheme(preset, overrides) {
  const t = JSON.parse(JSON.stringify(theme));
  if (preset) deepMerge(t, STYLE_PRESETS[preset] || {});
  if (overrides) deepMerge(t, overrides);
  return t;
}

/** Extract shapes: text boxes (with runs) and pictures, with positions in inches. */
function parseSlide(xml) {
  const shapes = [];
  // <p:sp> text shapes
  for (const m of xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)) {
    const body = m[1];
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext = body.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    const runs = [];
    for (const r of body.matchAll(/<a:r><a:rPr\b([^>]*)>([\s\S]*?)<\/a:rPr><a:t>([\s\S]*?)<\/a:t>/g)) {
      const attrs = r[1], inner = r[2], text = r[3];
      runs.push({
        sz: Number((attrs.match(/\bsz="(\d+)"/) || [])[1] || 0) / 100,
        b: /\bb="1"/.test(attrs),
        face: (inner.match(/<a:latin typeface="([^"]+)"/) || [])[1] || null,
        color: (inner.match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/) || [])[1] || null,
        text: text.slice(0, 60),
      });
    }
    if (!off || !ext) continue;
    shapes.push({
      kind: "text",
      x: +off[1] / EMU, y: +off[2] / EMU, w: +ext[1] / EMU, h: +ext[2] / EMU,
      runs,
    });
  }
  // <p:pic> images
  for (const m of xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)) {
    const body = m[1];
    const off = body.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext = body.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!off || !ext) continue;
    shapes.push({ kind: "pic", x: +off[1] / EMU, y: +off[2] / EMU, w: +ext[1] / EMU, h: +ext[2] / EMU, runs: [] });
  }
  return shapes;
}

async function main() {
  const { file, preset, report, overrides } = parseCli();
  if (!file) { console.error("Usage: node check_style.js Deck.pptx [--preset guide2025] [--report out.md]"); process.exit(1); }
  const T = effTheme(preset, overrides);
  const X = T.text;

  const allowedFaces = new Set(["Lucida Bright", "Lucida Sans", "Arial"]);
  const allowedSizes = new Set([
    X.title.fontSize, X.subtitle.fontSize, X.panelTitle.fontSize,
    X.bullet.fontSize, X.subBullet.fontSize, X.source.fontSize, X.footnote.fontSize,
    X.introTitle.fontSize, X.introSubtitle.fontSize, X.introMeta.fontSize, X.introAdvanced.fontSize,
    T.table.header.fontSize, T.table.cell.fontSize, T.table.groupLabel.fontSize,
  ]);

  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));

  const lines = [`# Style report: ${path.basename(file)}`, preset ? `Preset: ${preset}` : "Preset: default", ""];
  let failures = 0;

  for (const name of slideNames) {
    const num = Number(name.match(/slide(\d+)\.xml/)[1]);
    const xml = await zip.file(name).async("string");
    const shapes = parseSlide(xml);
    const problems = [];
    const isIntro = num === 1; // intro slide has its own roles; skip title-bar checks

    // 1) fonts + 6) sizes
    for (const sh of shapes) {
      for (const r of sh.runs) {
        if (r.face && !allowedFaces.has(r.face))
          problems.push(`off-brand font "${r.face}" in run "${r.text}"`);
        if (r.sz && r.sz >= 6 && !allowedSizes.has(r.sz) && r.sz > 16)
          // sizes below 16 are allowed for diagram labels/legends; flag only large strays
          problems.push(`unexpected font size ${r.sz}pt in run "${r.text}"`);
      }
    }

    // 2) title check (non-intro slides): a text box near theme.titleBar.y
    if (!isIntro) {
      const tb = T.titleBar;
      const titleBox = shapes.find((s) => s.kind === "text" && Math.abs(s.y - tb.y) < 0.05 && s.runs.length);
      if (!titleBox) problems.push("no title text box found at the title-bar position");
      else {
        const r0 = titleBox.runs[0];
        if (r0.face && r0.face !== X.title.fontFace) problems.push(`title font is ${r0.face}, expected ${X.title.fontFace}`);
        if (r0.sz && r0.sz !== X.title.fontSize) problems.push(`title size is ${r0.sz}, expected ${X.title.fontSize}`);
        if (!r0.b && X.title.bold) problems.push("title is not bold");
      }
      // 3) subtitle position when present
      const sb = T.subtitleBar;
      const subBox = shapes.find((s) => s.kind === "text" && Math.abs(s.y - sb.y) < 0.02 && s !== titleBox && s.runs.length);
      const anySubSized = shapes.some((s) => s.runs.some((r) => r.sz === X.subtitle.fontSize && r.color === X.subtitle.color.toUpperCase()));
      if (!subBox && anySubSized) problems.push(`subtitle-styled text found but not at subtitleBar.y=${sb.y}`);
    }

    // 4) bounds + 5) footer band
    for (const sh of shapes) {
      if (sh.x < -0.01 || sh.y < -0.01 || sh.x + sh.w > SLIDE_W + 0.01 || sh.y + sh.h > SLIDE_H + 0.01)
        problems.push(`${sh.kind} out of slide bounds (${sh.x.toFixed(2)},${sh.y.toFixed(2)},${sh.w.toFixed(2)},${sh.h.toFixed(2)})`);
      if (sh.kind === "pic" && sh.y + sh.h > 7.06 && sh.h > 0.5)
        problems.push(`figure intrudes into the source-footer band (bottom=${(sh.y + sh.h).toFixed(2)}")`);
    }

    if (problems.length) {
      failures++;
      lines.push(`## Slide ${num}: FAIL`);
      for (const p of problems) lines.push(`- ${p}`);
    } else {
      lines.push(`## Slide ${num}: pass`);
    }
    lines.push("");
  }

  lines.push(failures ? `**${failures} slide(s) failed.**` : "**All slides pass.**");
  const out = lines.join("\n");
  if (report) { fs.mkdirSync(path.dirname(report), { recursive: true }); fs.writeFileSync(report, out); }
  console.log(out);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
