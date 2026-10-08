#!/usr/bin/env node
"use strict";

const path = require("path");
const { OIDeckBuilder, parseArgs } = require("./oi_deck_builder");

const BASE = __dirname;
const cliOpts = parseArgs();
// Figures live in Dropbox; override with --fig-dir if the path differs on your machine.
const FIG_DIR =
  cliOpts.figDir ??
  "C:/Users/realj/Opportunity Insights Dropbox/Opportunity Insights Shared Workspace/Research files/outside/workforce_training/Slides/SOO-2026/figures";
// Default output. Override per run with --output "C:/some/path/Name.pptx".
const OUTPUT =
  cliOpts.output ??
  "C:/Users/realj/Opportunity Insights Dropbox/Opportunity Insights Shared Workspace/Research files/outside/workforce_training/Slides/SFI_CoP_July2026/SFI_CoP_July2026_Figures.pptx";
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: FIG_DIR,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
});

const fig = (name) => deck.fig(name);

// This deck has no title slide -- it is a set of single-figure slides meant to
// drop into a larger presentation.
const figSlide = (title, subtitle, name) =>
  deck.addFigureSlide(title, subtitle, fig(name));

// Scatter section: every slide shares the same title/subtitle.
const WT_TITLE = "Effects of Workforce Training Programs on Earnings";
const ST_39SITES =
  "Observational vs. Randomized Trial Estimates for Programs Implemented in 39 sites";

// Year Up section.
const YU_TITLE_YEAR = "Impacts of Year Up on Earnings, by Year of Enrollment";
const YU_SUB_MEAN = "Mean Impacts, Averaging Across All Sites";
const YU_TITLE_SITE = "Impacts of Year Up on Earnings, by Site and Year of Enrollment";

async function main() {
  // Slide 1: 39-sites scatter (formatted, w/ correlation)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_fmted_wcorr");

  // Slide 2: PACE/WorkAdvance scatter (highlighted)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_pacewa_highlighted");

  // Slide 3: PACE/WorkAdvance scatter (highlighted, w/ correlation)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_pacewa_highlighted_wcorr");

  // Slide 4: PACE/WorkAdvance scatter (plain)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_pacewa");

  // Slide 5: PACE/WorkAdvance scatter (w/ correlation)
  // Outline said "..._pacewa_corr" (no such file); using "..._pacewa_wcorr".
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_pacewa_wcorr");

  // Slide 6: Year Up over time -- single cohort
  figSlide(YU_TITLE_YEAR, YU_SUB_MEAN, "yearup_over_time_one_cohort");

  // Slide 7: Year Up over time -- all cohorts
  figSlide(YU_TITLE_YEAR, YU_SUB_MEAN, "yearup_over_time");

  // Slide 8: Year Up by site and year (no subtitle)
  figSlide(YU_TITLE_SITE, "", "yearup_city_comparison");

  await deck.save();
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
