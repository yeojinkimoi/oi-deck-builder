#!/usr/bin/env node
"use strict";

/**
 * oi-deck — run the OI deck pipeline from inside a deck folder.
 *
 * The package lives wherever it was installed; your deck folder holds
 * everything else. From the deck folder:
 *
 *   oi-deck new <Name>     scaffold pipeline.yaml + outline.md + code/ here
 *   oi-deck run            walk the DAG, skipping fresh steps
 *   oi-deck run --force    run everything
 *   oi-deck run --dry-run  show what would run
 *   oi-deck run --only figures
 *   oi-deck lint           parse outline.md, build nothing
 *   oi-deck check          style-check the built .pptx
 *   oi-deck where          print where the package is installed
 *
 * Everything resolves relative to the current directory, so paths in
 * pipeline.yaml are short and portable: `code/figures.do`, `figures/*.svg`,
 * `../../Disclosures/sep2026/release.xlsx`.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PKG = path.resolve(__dirname, "..");
const SCRIPTS = path.join(PKG, "scripts");

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
};

function run(script, args) {
  const res = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    stdio: "inherit",
    env: Object.assign({}, process.env, { OI_DECK_HOME: PKG }),
    windowsHide: true,
  });
  process.exit(res.status === null ? 1 : res.status);
}

function findDeckPptx(cwd) {
  const yml = path.join(cwd, "pipeline.yaml");
  if (fs.existsSync(yml)) {
    const m = fs.readFileSync(yml, "utf8").match(/^\s*-\s*([\w./-]+\.pptx)\s*$/m);
    if (m && fs.existsSync(path.join(cwd, m[1]))) return path.join(cwd, m[1]);
  }
  const candidates = fs.readdirSync(cwd).filter((f) => /\.pptx$/i.test(f) && !f.startsWith("~$"));
  if (candidates.length === 1) return path.join(cwd, candidates[0]);
  return null;
}

function scaffold(cwd, name) {
  const tpl = path.join(PKG, "decks", "_template");
  if (!fs.existsSync(tpl)) {
    console.error(C.red(`oi-deck: template missing at ${tpl}`));
    process.exit(1);
  }
  const deckName = name || path.basename(cwd);
  const slug = deckName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const outName = deckName.replace(/[^A-Za-z0-9_-]+/g, "") + ".pptx";

  for (const sub of ["code", "data", "figures"]) {
    fs.mkdirSync(path.join(cwd, sub), { recursive: true });
  }

  // pipeline.yaml is NOT scaffolded: a standard deck is code/figures.do then
  // outline.md, which the runner infers from the layout. Pass --pipeline to
  // get an explicit spec, needed only for extra steps (a cleaning step, a ROI
  // calculation, a second do-file).
  const copies = [
    ["outline.md", "outline.md"],
    ["figures.do", path.join("code", "figures.do")],
  ];
  if (process.argv.includes("--pipeline")) {
    copies.unshift(["pipeline.yaml", "pipeline.yaml"]);
  }
  let wrote = 0, skipped = 0;
  for (const [from, to] of copies) {
    const dst = path.join(cwd, to);
    if (fs.existsSync(dst)) { skipped++; console.log(C.dim(`  exists  ${to}`)); continue; }
    let body = fs.readFileSync(path.join(tpl, from), "utf8");
    body = body
      .replace(/MY_DECK/g, deckName)
      .replace(/MY_PROGRAM/g, deckName)
      .replace(/my_deck/g, slug)
      .replace(/MyDeck\.pptx/g, outName);
    fs.writeFileSync(dst, body);
    wrote++;
    console.log(C.green(`  created ${to}`));
  }
  console.log(
    `\n  ${C.bold(deckName)} scaffolded in ${cwd}` +
      (skipped ? C.dim(` (${skipped} file(s) already present, left alone)`) : "")
  );
  console.log(C.dim("  next: edit pipeline.yaml and code/figures.do, then `oi-deck run`\n"));
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const cwd = process.cwd();

  switch (cmd) {
    case "run":
      // pipeline.yaml is optional: without one, run_pipeline.js implies
      // code/figures.do -> outline.md from the folder layout.
      return run("run_pipeline.js", [cwd, ...rest]);

    case "lint":
      return run("outline_to_deck.js", [path.join(cwd, "outline.md"), "--lint", ...rest]);

    case "check": {
      const deck = rest.find((a) => !a.startsWith("--")) || findDeckPptx(cwd);
      if (!deck) {
        console.error(C.red("oi-deck: could not find a built .pptx here; pass one."));
        process.exit(1);
      }
      return run("check_style.js", [deck, ...rest.filter((a) => a.startsWith("--"))]);
    }

    case "fingerprint": {
      const deck = rest.find((a) => !a.startsWith("--")) || findDeckPptx(cwd);
      if (!deck) { console.error(C.red("oi-deck: no .pptx found")); process.exit(1); }
      return run("fingerprint.js", [deck]);
    }

    case "new":
      return scaffold(cwd, rest[0]);

    case "where":
      console.log(PKG);
      return;

    default:
      console.log(`
${C.bold("oi-deck")} — run the OI deck pipeline from inside a deck folder

  ${C.bold("oi-deck new")} [Name]      scaffold outline.md + code/figures.do here
      --pipeline            also write an explicit pipeline.yaml (for extra steps)
  ${C.bold("oi-deck run")}             walk the DAG, skipping fresh steps
      --force               run every step
      --dry-run             show what would run
      --only <id>           run one step
  ${C.bold("oi-deck lint")}            parse outline.md, build nothing
  ${C.bold("oi-deck check")} [deck]    style-check the built .pptx
  ${C.bold("oi-deck fingerprint")}     structural fingerprint, for regression diffs
  ${C.bold("oi-deck where")}           where the package is installed

package: ${C.dim(PKG)}
`);
      process.exit(cmd ? 1 : 0);
  }
}

main();
