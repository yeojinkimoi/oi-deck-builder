#!/usr/bin/env node
"use strict";

/**
 * run_pipeline.js — walk a deck's pipeline.yaml as a DAG, running only the
 * steps whose inputs are newer than their outputs.
 *
 *   node scripts/run_pipeline.js decks/tstc_oct2026
 *   node scripts/run_pipeline.js decks/tstc_oct2026 --force
 *   node scripts/run_pipeline.js decks/tstc_oct2026 --only figures
 *   node scripts/run_pipeline.js decks/tstc_oct2026 --dry-run
 *
 * pipeline.yaml:
 *
 *   deck: tstc_oct2026
 *   stata_dir: "C:/path/to/the/do-files"      # optional, default: deck dir
 *   steps:
 *     - id:  clean
 *       run: stata prepare_data.do
 *       in:  [prepare_data.do]
 *       out: [data/tstc_event_study.dta]
 *     - id:  figures
 *       run: stata generate_figs.do
 *       in:  [data/tstc_event_study.dta, generate_figs.do]
 *       out: ["figures/*.svg", figures/facts.json]
 *
 * Dependency edges are inferred: step B depends on step A when any of B's
 * `in` patterns matches something in A's `out`. There is no `needs:` key to
 * keep in sync with the file lists.
 *
 * `run` verbs:
 *   stata <file.do> [args]   batch Stata, then fail on a non-zero exit OR an
 *                            "r(NNN);" in the log — batch Stata exits 0 on
 *                            some errors, so the log check is required
 *   node  <script> [args]    node, failing on non-zero exit
 *   <anything else>          run through the shell
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { spawnSync } = require("child_process");

// ---------------------------------------------------------------- utilities

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function die(msg) {
  console.error(C.red(`pipeline: ${msg}`));
  process.exit(1);
}

/** Expand a glob with a single * in the basename. No globstar — the pipeline
 *  only ever needs "figures/*.svg". */
function expandGlob(pattern, root) {
  if (!pattern.includes("*")) {
    const p = path.resolve(root, pattern);
    return fs.existsSync(p) ? [p] : [];
  }
  const dir = path.resolve(root, path.dirname(pattern));
  const base = path.basename(pattern);
  if (!fs.existsSync(dir)) return [];
  const rx = new RegExp(
    "^" + base.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"
  );
  return fs
    .readdirSync(dir)
    .filter((f) => rx.test(f))
    .map((f) => path.join(dir, f));
}

function newestMtime(files) {
  let t = -Infinity;
  for (const f of files) {
    try {
      t = Math.max(t, fs.statSync(f).mtimeMs);
    } catch {}
  }
  return t;
}

function oldestMtime(files) {
  let t = Infinity;
  for (const f of files) {
    try {
      t = Math.min(t, fs.statSync(f).mtimeMs);
    } catch {
      return -Infinity; // missing output ⇒ always stale
    }
  }
  return t;
}

// ---------------------------------------------------------------- Stata

function findStata() {
  if (process.env.OI_STATA && fs.existsSync(process.env.OI_STATA)) {
    return process.env.OI_STATA;
  }
  const roots = ["C:/Program Files", "C:/Program Files (x86)"];
  const exes = [
    "StataMP-64.exe", "StataSE-64.exe", "StataBE-64.exe",
    "StataMP.exe", "StataSE.exe",
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs
      .readdirSync(root)
      .filter((d) => /^Stata/i.test(d))
      .sort()
      .reverse(); // newest-looking first
    for (const d of dirs) {
      for (const exe of exes) {
        const p = path.join(root, d, exe);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

/**
 * Batch Stata exits 0 even when the do-file errored, so the log has to be
 * read. Any "r(NNN);" is a failure.
 */
function runStata(doFile, cwd, extraArgs) {
  const stata = findStata();
  if (!stata) {
    die("no Stata executable found. Set OI_STATA to its full path.");
  }
  const abs = path.resolve(cwd, doFile);
  if (!fs.existsSync(abs)) die(`do-file not found: ${abs}`);

  const logPath = abs.replace(/\.do$/i, ".log");
  try { fs.unlinkSync(logPath); } catch {}

  const res = spawnSync(stata, ["-e", "do", abs, ...extraArgs], {
    cwd: path.dirname(abs),
    stdio: "inherit",
    windowsHide: true,
  });

  if (res.error) return { ok: false, why: String(res.error) };
  if (res.status !== 0) return { ok: false, why: `Stata exited ${res.status}` };

  if (!fs.existsSync(logPath)) {
    return { ok: false, why: `no log produced at ${path.basename(logPath)}` };
  }
  const log = fs.readFileSync(logPath, "utf8");
  const errs = log.match(/^r\(\d+\);/gm);
  if (errs) {
    const idx = log.search(/^r\(\d+\);/m);
    const context = log.slice(Math.max(0, idx - 400), idx + 20).trimEnd();
    return {
      ok: false,
      why: `Stata reported ${errs[0]} (exit code was 0 — log checked)`,
      context,
    };
  }
  return { ok: true };
}

function runNode(script, cwd, extraArgs) {
  const res = spawnSync(process.execPath, [script, ...extraArgs], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (res.error) return { ok: false, why: String(res.error) };
  if (res.status !== 0) return { ok: false, why: `node exited ${res.status}` };
  return { ok: true };
}

function runShell(cmd, cwd) {
  const res = spawnSync(cmd, { cwd, stdio: "inherit", shell: true, windowsHide: true });
  if (res.error) return { ok: false, why: String(res.error) };
  if (res.status !== 0) return { ok: false, why: `command exited ${res.status}` };
  return { ok: true };
}

/**
 * Split a `run:` string into argv, respecting double quotes. Required because
 * OI paths live under "Opportunity Insights Dropbox" — a plain whitespace
 * split turns one path into three arguments.
 */
function tokenize(cmd) {
  const out = [];
  const rx = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = rx.exec(cmd)) !== null) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

function runStep(step, deckDir, stataDir) {
  const run = String(step.run).trim();
  const [verb, ...rest] = tokenize(run);
  if (verb === "stata") {
    return runStata(rest[0], stataDir, rest.slice(1));
  }
  if (verb === "node") {
    return runNode(path.resolve(deckDir, rest[0]), deckDir, rest.slice(1));
  }
  return runShell(run, deckDir);
}

// ---------------------------------------------------------------- DAG

function topoSort(steps) {
  // B depends on A when any of B.in matches a pattern in A.out.
  const producers = new Map(); // normalized out-pattern -> step id
  for (const s of steps) for (const o of s.out || []) producers.set(o, s.id);

  const deps = new Map(steps.map((s) => [s.id, new Set()]));
  for (const s of steps) {
    for (const i of s.in || []) {
      for (const [outPat, producerId] of producers) {
        if (producerId === s.id) continue;
        if (outPat === i || patternsOverlap(outPat, i)) deps.get(s.id).add(producerId);
      }
    }
  }

  const order = [];
  const state = new Map(); // id -> 0 unvisited, 1 visiting, 2 done
  const byId = new Map(steps.map((s) => [s.id, s]));

  function visit(id, stack) {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      die(`cycle in pipeline: ${[...stack, id].join(" -> ")}`);
    }
    state.set(id, 1);
    for (const d of deps.get(id)) visit(d, [...stack, id]);
    state.set(id, 2);
    order.push(byId.get(id));
  }
  for (const s of steps) visit(s.id, []);
  return { order, deps };
}

/** "figures/*.svg" and "figures/a.svg" overlap; so do identical strings. */
function patternsOverlap(a, b) {
  const toRx = (p) =>
    new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return toRx(a).test(b) || toRx(b).test(a);
}

// ---------------------------------------------------------------- main

function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const onlyIdx = argv.indexOf("--only");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--only");

  const deckDir = path.resolve(positional[0] || ".");
  const specPath = path.join(deckDir, "pipeline.yaml");
  if (!fs.existsSync(specPath)) die(`no pipeline.yaml in ${deckDir}`);

  const spec = yaml.load(fs.readFileSync(specPath, "utf8"));
  if (!spec || !Array.isArray(spec.steps)) die("pipeline.yaml has no steps[]");

  // ${name} substitution from vars:, falling back to the environment. This is
  // how a deck whose Stata code and figures live in Dropbox, while its
  // outline and deck.js live here, writes paths that reach both.
  const vars = Object.assign({}, spec.vars || {});
  const subst = (s) =>
    String(s).replace(/\$\{(\w+)\}/g, (m, k) => {
      const v = vars[k] ?? process.env[k];
      if (v === undefined) die(`pipeline.yaml refers to \${${k}}, which is not in vars: or the environment`);
      return v;
    });
  for (const k of Object.keys(vars)) vars[k] = subst(vars[k]);
  for (const s of spec.steps) {
    s.run = subst(s.run);
    s.in = (s.in || []).map(subst);
    s.out = (s.out || []).map(subst);
  }

  const stataDir = spec.stata_dir ? path.resolve(deckDir, subst(spec.stata_dir)) : deckDir;

  const ids = spec.steps.map((s) => s.id);
  if (new Set(ids).size !== ids.length) die("duplicate step ids");
  if (only && !ids.includes(only)) die(`--only ${only}: no such step (have: ${ids.join(", ")})`);

  const { order, deps } = topoSort(spec.steps);

  console.log(C.bold(`\npipeline: ${spec.deck || path.basename(deckDir)}`));
  console.log(C.dim(`  ${deckDir}`));
  console.log(C.dim(`  order: ${order.map((s) => s.id).join(" -> ")}\n`));

  const forced = new Set();
  let ran = 0, skipped = 0;

  for (const step of order) {
    if (only && step.id !== only) { skipped++; continue; }

    const ins = (step.in || []).flatMap((p) => expandGlob(p, deckDir));
    const outs = (step.out || []).flatMap((p) => expandGlob(p, deckDir));
    const declaredOuts = (step.out || []).length;

    const upstreamRan = [...deps.get(step.id)].some((d) => forced.has(d));
    const missingOut = declaredOuts > 0 && outs.length === 0;
    const inNewer = ins.length > 0 && outs.length > 0 &&
                    newestMtime(ins) > oldestMtime(outs);

    const stale = flags.has("--force") || upstreamRan || missingOut || inNewer || declaredOuts === 0;

    const why = flags.has("--force") ? "forced"
      : upstreamRan ? "upstream reran"
      : missingOut ? "output missing"
      : inNewer ? "input newer"
      : declaredOuts === 0 ? "declares no output"
      : "";

    if (!stale) {
      console.log(`  ${C.green("fresh")}  ${C.bold(step.id.padEnd(10))} ${C.dim(step.run)}`);
      skipped++;
      continue;
    }

    console.log(`  ${C.yellow("run")}    ${C.bold(step.id.padEnd(10))} ${C.dim(step.run)}  ${C.dim("(" + why + ")")}`);
    if (flags.has("--dry-run")) { forced.add(step.id); continue; }

    const t0 = Date.now();
    const res = runStep(step, deckDir, stataDir);
    if (!res.ok) {
      console.error(C.red(`\n  FAILED  ${step.id}: ${res.why}`));
      if (res.context) console.error(C.dim("\n" + res.context + "\n"));
      process.exit(1);
    }
    console.log(C.dim(`         ok in ${((Date.now() - t0) / 1000).toFixed(1)}s`));
    forced.add(step.id);
    ran++;
  }

  console.log(
    `\n  ${C.bold("done")}  ${ran} ran, ${skipped} fresh/skipped` +
    (flags.has("--dry-run") ? C.dim("  (dry run — nothing executed)") : "") + "\n"
  );
}

main();
