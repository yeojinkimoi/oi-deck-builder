#!/usr/bin/env node
"use strict";

/**
 * outline_to_deck.js — turn an outline.md into a deck.js, then build it.
 *
 *   node scripts/outline_to_deck.js outline.md
 *   node scripts/outline_to_deck.js outline.md --fig-dir ../figs --output Deck.pptx
 *   node scripts/outline_to_deck.js outline.md --lint        # parse only
 *   node scripts/outline_to_deck.js outline.md --draft       # skip missing figures
 *
 * Why a parser rather than an LLM: across the six real outlines in this repo
 * (dallascollege, madhe_aug2026, sfi2026, soo2026, SAT_Admissions, wgu) 149 of
 * 150 slide headings already conform to the documented grammar. A format that
 * stable is safe to parse, and a deterministic build removes the class of
 * error where a subtitle is copied from the slide above and never updated.
 *
 * It handles only the deterministic subset. Anything else exits with
 * "UNSUPPORTED: line N" rather than emitting a partial deck — the
 * deck-generator agent takes over for those.
 *
 * Facts: every facts*.json in the figure directory is merged, and {{key}} in
 * any title, subtitle, callout, table cell or note is replaced by that fact's
 * rendered string. {{key.value}} gives the raw number instead. A {{key}} with
 * no matching fact is an error, not a silent blank.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const errors = [];
function err(line, msg) {
  errors.push({ line, msg });
}

// ------------------------------------------------------------------ parsing

const HEADING =
  /^###\s+(?:Slide\s+\S+\s*[—–-]\s*)?(TITLE SLIDE|TEXT|TABLE|DIAGRAM|[1-4]-FIGURE)\s*:?\s*(.*)$/i;
const FIELD = /^-\s+\*\*([^*]+)\*\*\s*:\s*(.*)$/;
const SETTING = /^-\s+\*\*([^*]+)\*\*\s*:\s*(.*)$/;

function parseOutline(text) {
  const lines = text.split(/\r?\n/);
  const settings = {};
  const slides = [];
  let section = null; // "settings" | "slides"
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const ln = i + 1;
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    if (/^##\s+Deck Settings/i.test(line)) { section = "settings"; continue; }
    if (/^##\s+Slides/i.test(line)) { section = "slides"; continue; }
    if (/^#\s/.test(line)) continue; // document title

    const h = line.match(HEADING);
    if (h) {
      section = "slides";
      cur = {
        type: h[1].toUpperCase(),
        title: h[2].trim(),
        fields: {},
        bullets: [],
        line: ln,
      };
      slides.push(cur);
      continue;
    }

    if (/^###\s/.test(line)) {
      err(ln, `heading does not match "### [Slide N —] TYPE: Title" — ${line.trim()}`);
      cur = null;
      continue;
    }

    if (section === "settings") {
      const m = line.match(SETTING);
      if (m) settings[m[1].trim().toLowerCase()] = m[2].trim();
      continue;
    }

    if (!cur) continue;

    const f = line.match(FIELD);
    if (f) {
      const key = f[1].trim().toLowerCase();
      const val = f[2].trim();
      if (key === "rows") { cur.fields.rows = []; cur._collecting = "rows"; }
      else { cur.fields[key] = val; cur._collecting = null; }
      continue;
    }

    // continuation of **Rows**:
    if (cur._collecting === "rows" && /^\s+-\s+/.test(raw)) {
      cur.fields.rows.push(raw.replace(/^\s*-\s+/, "").trim());
      continue;
    }

    // plain bullet (TEXT slides)
    const b = raw.match(/^(\s*)-\s+(.*)$/);
    if (b) {
      cur.bullets.push({ indent: b[1].length >= 2 ? 1 : 0, text: b[2].trim(), line: ln });
      cur._collecting = null;
      continue;
    }
  }
  for (const s of slides) delete s._collecting;
  return { settings, slides };
}

// ------------------------------------------------------------------ facts

function loadFacts(figDir) {
  const facts = {};
  if (!fs.existsSync(figDir)) return facts;
  for (const f of fs.readdirSync(figDir)) {
    if (!/^facts.*\.json$/i.test(f)) continue;
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(path.join(figDir, f), "utf8"));
    } catch (e) {
      console.error(C.red(`  cannot parse ${f}: ${e.message}`));
      process.exit(1);
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === "_meta") continue;
      facts[k] = v;
    }
  }
  return facts;
}

function interpolate(str, facts, line) {
  if (typeof str !== "string" || !str.includes("{{")) return str;
  return str.replace(/\{\{\s*([\w.]+?)\s*\}\}/g, (m, key) => {
    if (key.endsWith(".value")) {
      const base = key.slice(0, -6);
      if (facts[base]) return String(facts[base].value);
    }
    if (facts[key]) return facts[key].rendered;
    err(line, `{{${key}}} has no matching fact (is it in facts*.json?)`);
    return m;
  });
}

// ------------------------------------------------------------ title formats

/**
 * Named title conventions, chosen in Deck Settings:
 *
 *     - **Program**: TSTC
 *     - **Title format**: 1
 *     - **Figure title format**: 2
 *
 * FORMAT 1 — the front / title slide
 *     The Impacts of {Program} Programs on Earnings
 *     Preliminary Estimates Using {Comparison}
 *
 * FORMAT 2 — one figure per program/panel
 *     Impact of {Program} on Earnings: {Panel}
 *     {Program} Enrollees who {Cohort} vs. {Comparison}
 *
 * The year-5 effect is deliberately NOT appended -- the same number on every
 * subtitle reads as noise. Add it with `- **Show effect**: yes` at deck level
 * or `- **Fact**: <key>` on one slide.
 *
 * A slide supplies only what varies:
 *
 *     ### Slide 3 — 1-FIGURE:
 *     - **Figure**: cert_construction_graduate_event_study
 *     - **Panel**: Construction Certificate
 *
 * Cohort defaults to "Graduate"; the fact key is derived from the figure name
 * (basename minus _event_study, prefixed with the Effect fact setting). An
 * explicit Title or Subtitle always wins, so any slide can opt out.
 */
const TITLE_FORMATS = {
  1: {
    title: (s) => `The Impacts of ${s.program} Programs on Earnings`,
    subtitle: (s) => `Preliminary Estimates Using ${s.comparison}`,
  },
};

const FIGURE_TITLE_FORMATS = {
  2: {
    title: (s, f) => `Impact of ${s.program} on Earnings: ${f.panel}`,
    subtitle: (s, f) =>
      `${s.program} Enrollees who ${f.cohort} vs. ${s.comparison}` +
      (f.fact ? ` -- {{${f.fact}}} ${s.effectWord}` : ""),
  },
};

function applyTitleFormats(model) {
  const S = model.settings;
  const ctx = {
    program: S.program || "",
    comparison: S.comparison || "Digital Twins",
    effectWord: S["effect word"] || "Increase",
  };
  const factPrefix = S["effect fact"] || "te_yr5";
  const showEffect = /^(yes|true|1)$/i.test(String(S["show effect"] || ""));

  // ---- format 1: the front slide
  const tf = S["title format"];
  if (tf) {
    const fmt = TITLE_FORMATS[tf];
    if (!fmt) { err(0, `Title format ${tf} is not defined (have: ${Object.keys(TITLE_FORMATS).join(", ")})`); }
    else {
      if (!ctx.program) err(0, "Title format needs a **Program** setting");
      if (!S.title) S.title = fmt.title(ctx);
      if (!S.subtitle) S.subtitle = fmt.subtitle(ctx);
    }
  }

  // ---- format 2: per-program figure slides
  const ff = S["figure title format"];
  if (!ff) return;
  const fmt = FIGURE_TITLE_FORMATS[ff];
  if (!fmt) {
    err(0, `Figure title format ${ff} is not defined (have: ${Object.keys(FIGURE_TITLE_FORMATS).join(", ")})`);
    return;
  }
  if (!ctx.program) err(0, "Figure title format needs a **Program** setting");

  for (const sl of model.slides) {
    if (!/FIGURE/.test(sl.type)) continue;
    const hasTitle = sl.title && sl.title.trim();
    const hasSub = sl.fields.subtitle && sl.fields.subtitle.trim();
    if (hasTitle && hasSub) continue; // fully hand-written, leave alone

    const panel = sl.fields.panel;
    if (!panel) {
      if (!hasTitle) err(sl.line, `figure title format ${ff} needs a **Panel** on this slide, or a title in the heading`);
      continue;
    }

    // The year-5 effect is NOT in the subtitle by default -- repeating it on
    // every slide is noise. Opt in per deck with `- **Show effect**: yes`, or
    // per slide with `- **Fact**: <key>`.
    let fact = sl.fields.fact;
    if (fact === undefined) {
      fact = showEffect
        ? (() => {
            const figName = splitFig(sl.fields.figure || sl.fields.left || "").name;
            return figName ? `${factPrefix}.${figName.replace(/_event_study$/, "")}` : null;
          })()
        : null;
    }
    if (fact === "none" || fact === "" || fact === "no") fact = null;

    // Cohort: per-slide wins, then the deck-level default, then "Graduate".
    const f = { panel, cohort: sl.fields.cohort || S.cohort || "Graduate", fact };
    if (!hasTitle) sl.title = fmt.title(ctx, f);
    if (!hasSub) sl.fields.subtitle = fmt.subtitle(ctx, f);
  }
}

/**
 * Insert a provenance slide straight after the title slide, naming the
 * disclosure workbook the figures were actually built from.
 *
 * The filename comes from facts (oi_use_disclosure records source.workbook,
 * source.sheet, source.statistic, source.rows when it reads), not from
 * anything typed in the outline -- so it cannot go stale when the release
 * changes. Suppress with `- **Source slide**: no`.
 */
function insertSourceSlide(model, facts) {
  const S = model.settings;
  if (/^(no|false|0)$/i.test(String(S["source slide"] || ""))) return;

  const wb = facts["source.workbook"];
  if (!wb) return; // nothing read, nothing to claim

  const sheet = facts["source.sheet"];
  const stat = facts["source.statistic"];
  const rows = facts["source.rows"];

  const bullets = [
    { indent: 0, text: "Figures in this deck are generated from:", line: 0 },
    { indent: 1, text: wb.rendered, line: 0 },
  ];
  const detail = [
    sheet ? `sheet: ${sheet.rendered}` : null,
    stat ? `statistic: ${stat.rendered}` : null,
    rows ? `${rows.rendered} rows` : null,
  ].filter(Boolean);
  if (detail.length) {
    bullets.push({ indent: 1, text: detail.join("  ·  ") + " (small)", line: 0 });
  }

  const slide = {
    type: "TEXT",
    title: S["source slide title"] || "Data Source",
    fields: {},
    bullets,
    line: 0,
    _generated: true,
  };

  const i = model.slides.findIndex((s) => s.type === "TITLE SLIDE");
  model.slides.splice(i < 0 ? 0 : i + 1, 0, slide);
}

// ------------------------------------------------------------------ figures

function figExists(figDir, name) {
  return (
    fs.existsSync(path.join(figDir, name + ".svg")) ||
    fs.existsSync(path.join(figDir, name + ".png"))
  );
}

function splitFig(spec) {
  // "figure_name | Panel Title"
  const [name, ...rest] = String(spec).split("|");
  return { name: name.trim(), panel: rest.join("|").trim() };
}

// ------------------------------------------------------------------ codegen

const q = (s) => JSON.stringify(String(s));

function emitDeck(model, opts) {
  const { settings, slides } = model;
  const L = [];
  L.push("#!/usr/bin/env node");
  L.push('"use strict";');
  L.push("");
  L.push("// GENERATED by scripts/outline_to_deck.js from outline.md — do not hand-edit.");
  L.push("// Re-run:  npm run pipeline " + (opts.deckName || "decks/<deck>"));
  L.push("");
  L.push('const path = require("path");');
  L.push("const OI_HOME = process.env.OI_DECK_HOME || " + q(opts.pkgHome) + ";");
  L.push('const { OIDeckBuilder, parseArgs } = require(path.join(OI_HOME, "oi_deck_builder.js"));');
  L.push("");
  L.push("const BASE = __dirname;");
  L.push("const cliOpts = parseArgs();");
  L.push("const FIG_DIR   = cliOpts.figDir   ?? " + q(opts.figDir) + ";");
  L.push("const OUTPUT    = cliOpts.output   ?? path.join(BASE, " + q(opts.output) + ");");
  L.push("const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, \".pptx_cache\");");
  L.push("");
  L.push("const deck = new OIDeckBuilder({");
  L.push("  figDir: FIG_DIR,");
  L.push("  output: OUTPUT,");
  L.push("  cacheDir: CACHE_DIR,");
  L.push("});");
  L.push("");
  L.push("const fig = (name) => deck.fig(name);");
  L.push("");
  L.push("async function main() {");

  for (const s of slides) {
    L.push("");
    L.push(`  // --- line ${s.line}: ${s.type}: ${s.title}`);
    const notes = s.fields.notes ? `, { notes: ${q(s.fields.notes)} }` : "";

    if (s.type === "TITLE SLIDE") {
      L.push(
        `  deck.addTitleSlide(${q(settings.title || s.title)}, ` +
          `${q(settings.subtitle || "")}, ${q(settings.date || "")}, ${q(settings.notice || "")});`
      );
      continue;
    }

    if (s.type === "TEXT") {
      const items = s.bullets.map((b) =>
        b.indent ? `[${q(b.text)}, 1]` : q(b.text)
      );
      const o = [];
      if (s.fields.subtitle) o.push(`subtitle: ${q(s.fields.subtitle)}`);
      if (s.fields.notes) o.push(`notes: ${q(s.fields.notes)}`);
      L.push(`  deck.addRichTextSlide(${q(s.title)}, [`);
      for (const it of items) L.push(`    ${it},`);
      L.push(`  ]${o.length ? `, { ${o.join(", ")} }` : ""});`);
      continue;
    }

    if (s.type === "TABLE") {
      const cols = (s.fields.columns || "").split(",").map((c) => c.trim());
      const rows = (s.fields.rows || []).map((r) => r.split("|").map((c) => c.trim()));
      const o = [];
      if (s.fields.subtitle) o.push(`subtitle: ${q(s.fields.subtitle)}`);
      if (s.fields.footnote) o.push(`footnote: ${q(s.fields.footnote)}`);
      if (s.fields.notes) o.push(`notes: ${q(s.fields.notes)}`);
      L.push(`  deck.addTableSlide(${q(s.title)}, [`);
      L.push(`    [${cols.map(q).join(", ")}],`);
      for (const r of rows) L.push(`    [${r.map(q).join(", ")}],`);
      L.push(`  ], {}${o.length ? `, { ${o.join(", ")} }` : ", {}"});`);
      continue;
    }

    if (s.type === "DIAGRAM") {
      L.push(
        `  deck.addDiagramSlide(${q(s.title)}, ${q(s.fields.subtitle || "")}, ` +
          `${q(s.fields.figspec)});`
      );
      continue;
    }

    // n-FIGURE
    const n = parseInt(s.type, 10);
    const sub = q(s.fields.subtitle || "");
    const pick = (...keys) => {
      for (const k of keys) if (s.fields[k] !== undefined) return s.fields[k];
      return undefined;
    };

    if (n === 1) {
      const { name } = splitFig(pick("figure"));
      L.push(`  figSlide(${q(s.title)}, ${sub}, ${q(name)}${notes});`);
      continue;
    }
    if (n === 2) {
      const l = splitFig(pick("left"));
      const r = splitFig(pick("right"));
      L.push(
        `  multiFigSlide(${q(s.title)}, ${sub}, [${q(l.name)}, ${q(r.name)}], 2, 1, ` +
          `[${q(l.panel)}, ${q(r.panel)}]${notes});`
      );
      continue;
    }
    if (n === 3) {
      const t = splitFig(pick("top center", "top"));
      const bl = splitFig(pick("bottom left"));
      const br = splitFig(pick("bottom right"));
      L.push(
        `  threeFigSlide(${q(s.title)}, ${sub}, [${q(t.name)}, ${q(bl.name)}, ${q(br.name)}], ` +
          `[${q(t.panel)}, ${q(bl.panel)}, ${q(br.panel)}]${notes});`
      );
      continue;
    }
    if (n === 4) {
      const tl = splitFig(pick("top left"));
      const tr = splitFig(pick("top right"));
      const bl = splitFig(pick("bottom left"));
      const br = splitFig(pick("bottom right"));
      L.push(
        `  multiFigSlide(${q(s.title)}, ${sub}, ` +
          `[${q(tl.name)}, ${q(tr.name)}, ${q(bl.name)}, ${q(br.name)}], 2, 2, ` +
          `[${q(tl.panel)}, ${q(tr.panel)}, ${q(bl.panel)}, ${q(br.panel)}]${notes});`
      );
      continue;
    }
  }

  L.push("");
  L.push("  await deck.save();");
  L.push("  report();");
  L.push("}");
  L.push("");
  // helpers: skip-and-report, borrowed from madhe_aug2026_deck.js
  L.push("const fs2 = require(\"fs\");");
  L.push("const DRAFT = process.argv.includes(\"--draft\");");
  L.push("let planned = 0;");
  L.push("const skipped = [];");
  L.push("const have = (name) =>");
  L.push("  fs2.existsSync(path.join(FIG_DIR, name + \".svg\")) ||");
  L.push("  fs2.existsSync(path.join(FIG_DIR, name + \".png\"));");
  L.push("function guard(names) {");
  L.push("  planned += 1;");
  L.push("  const missing = names.filter((n) => n && !have(n));");
  L.push("  if (!missing.length) return true;");
  L.push("  if (!DRAFT) {");
  L.push("    console.error(`\\nMissing figure(s) on slide ${planned}: ${missing.join(\", \")}`);");
  L.push("    console.error(\"Run the figures step first, or pass --draft to skip.\");");
  L.push("    process.exit(1);");
  L.push("  }");
  L.push("  skipped.push({ n: planned, names: missing });");
  L.push("  return false;");
  L.push("}");
  L.push("function figSlide(t, s, name, opts) {");
  L.push("  if (guard([name])) deck.addFigureSlide(t, s, fig(name), opts);");
  L.push("}");
  L.push("function multiFigSlide(t, s, names, cols, rows, panelTitles, opts) {");
  L.push("  if (guard(names))");
  L.push("    deck.addMultiFigureSlide(t, s, names.map(fig), cols, rows, Object.assign({ panelTitles }, opts));");
  L.push("}");
  L.push("function threeFigSlide(t, s, names, panelTitles, opts) {");
  L.push("  if (guard(names)) deck.add3FigureSlide(t, s, names.map(fig), panelTitles, opts);");
  L.push("}");
  L.push("function report() {");
  L.push("  if (skipped.length)");
  L.push("    console.warn(`\\n  skipped ${skipped.length} slide(s) with missing figures: ` +");
  L.push("      skipped.map((s) => `#${s.n} ${s.names.join(\",\")}`).join(\"; \"));");
  L.push("}");
  L.push("");
  L.push('main().catch((e) => { console.error("Build failed:", e); process.exit(1); });');
  L.push("");
  return L.join("\n");
}

// ------------------------------------------------------------------ main

function main() {
  const argv = process.argv.slice(2);
  const arg = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : dflt;
  };
  const outlinePath = path.resolve(argv.find((a) => !a.startsWith("--")) || "outline.md");
  if (!fs.existsSync(outlinePath)) {
    console.error(C.red(`outline not found: ${outlinePath}`));
    process.exit(1);
  }
  const deckDir = path.dirname(outlinePath);

  const model = parseOutline(fs.readFileSync(outlinePath, "utf8"));
  // Expand the named title conventions before facts are interpolated,
  // because format 2 produces {{fact}} placeholders of its own.
  applyTitleFormats(model);
  const figDir = path.resolve(
    deckDir,
    arg("--fig-dir", model.settings["figure directory"] || "figures")
  );
  const output = arg("--output", model.settings.output || "Deck.pptx");

  // ---- facts
  const facts = loadFacts(figDir);
  const walk = (s, line) => interpolate(s, facts, line);
  model.settings.title = walk(model.settings.title, 0);
  model.settings.subtitle = walk(model.settings.subtitle, 0);
  for (const s of model.slides) {
    s.title = walk(s.title, s.line);
    for (const k of Object.keys(s.fields)) {
      if (Array.isArray(s.fields[k])) s.fields[k] = s.fields[k].map((v) => walk(v, s.line));
      else s.fields[k] = walk(s.fields[k], s.line);
    }
    s.bullets = s.bullets.map((b) => ({ ...b, text: walk(b.text, b.line) }));
  }

  // ---- provenance slide, from what the reader actually read
  insertSourceSlide(model, facts);

  // ---- validate figures referenced actually exist
  for (const s of model.slides) {
    if (!/FIGURE/.test(s.type)) continue;
    // Allowlist, not denylist: only these fields ever name a figure, so adding
    // a new metadata field (panel, cohort, fact, ...) cannot be misread as one.
    const FIG_FIELDS = new Set([
      "figure", "left", "right", "top", "top center",
      "top left", "top right", "bottom left", "bottom right",
    ]);
    for (const [k, v] of Object.entries(s.fields)) {
      if (!FIG_FIELDS.has(k)) continue;
      const { name } = splitFig(v);
      if (name && !figExists(figDir, name)) {
        const near = fs.existsSync(figDir)
          ? fs.readdirSync(figDir)
              .filter((f) => /\.(svg|png)$/i.test(f))
              .map((f) => f.replace(/\.(svg|png)$/i, ""))
              .filter((f) => f.includes(name.slice(0, 8)) || name.includes(f.slice(0, 8)))
              .slice(0, 3)
          : [];
        err(s.line, `figure "${name}" not found in ${path.basename(figDir)}` +
          (near.length ? ` — did you mean ${near.join(", ")}?` : ""));
      }
    }
  }

  console.log(C.bold(`\noutline: ${path.basename(outlinePath)}`));
  console.log(C.dim(`  ${model.slides.length} slides, ${Object.keys(facts).length} facts, figures in ${figDir}`));

  if (errors.length) {
    console.error(C.red(`\n  ${errors.length} problem(s):`));
    for (const e of errors) console.error(C.red(`    line ${e.line}: ${e.msg}`));
    process.exit(1);
  }
  console.log(C.green("  outline OK"));

  if (argv.includes("--lint")) return;

  // ---- emit deck.js
  // The deck folder usually sits outside this package -- a deck keeps all of
  // its files together, wherever it lives -- so the generated deck.js cannot
  // use a relative require. It resolves OI_DECK_HOME at run time (set by the
  // oi-deck CLI) and falls back to wherever the package was when generated.
  const pkgHome = path.resolve(__dirname, "..").split(path.sep).join("/");
  const code = emitDeck(model, {
    pkgHome,
    figDir,
    output,
    deckName: path.relative(path.resolve(__dirname, ".."), deckDir).replace(/\\/g, "/"),
  });
  const deckJs = path.join(deckDir, "deck.js");
  fs.writeFileSync(deckJs, code);
  console.log(C.dim(`  wrote ${path.relative(process.cwd(), deckJs)}`));

  // ---- build
  const res = spawnSync(process.execPath, [deckJs, ...(argv.includes("--draft") ? ["--draft"] : [])], {
    cwd: deckDir,
    stdio: "inherit",
    windowsHide: true,
  });
  process.exit(res.status === null ? 1 : res.status);
}

main();
