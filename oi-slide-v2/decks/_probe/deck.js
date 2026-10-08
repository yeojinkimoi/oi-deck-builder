#!/usr/bin/env node
"use strict";

const path = require("path");
const { OIDeckBuilder, parseArgs } = require("../../oi_shapes");

const BASE = __dirname;
const cliOpts = parseArgs();
const OUTPUT = cliOpts.output ?? path.join(BASE, "_probe.pptx");
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: cliOpts.figDir ?? BASE,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
  stylePreset: "guide2025",
});

async function main() {
  // Slide 1 — title
  deck.addTitleSlide(
    "Tree-Based ML — Probe",
    "generate → compose proof",
    "July 2026",
    "PROBE — GENERATE→COMPOSE"
  );

  // Slide 2 — text (Motivation)
  deck.addRichTextSlide("Why Tree-Based Models?", [
    "Flexible prediction without assuming a functional form",
    ["Splits are learned from the data, not specified by the researcher", 1],
    "",
    "Two workhorses: regression trees and gradient boosting",
  ], { subtitle: "Motivation" });

  // (Slide 3 — the regression-tree DIAGRAM — is inserted here by the compose step,
  //  generated with python-pptx: decks/_probe/diagrams/regression_tree.py)

  // Slide 4 — text (Practical Notes)
  deck.addRichTextSlide("Practical Notes", [
    "Depth controls flexibility: shallow underfits, deep overfits",
    "The diagram slide is native python-pptx shapes — open and drag the nodes",
  ]);

  await deck.save();
}

main().catch((err) => { console.error("Build failed:", err); process.exit(1); });
