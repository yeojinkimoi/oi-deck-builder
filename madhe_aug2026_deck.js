#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { OIDeckBuilder, parseArgs } = require("./oi_deck_builder");

const BASE = __dirname;
const cliOpts = parseArgs();
// Figures live in Dropbox; override with --fig-dir if the path differs on your machine.
const FIG_DIR =
  cliOpts.figDir ??
  "C:/Users/realj/Opportunity Insights Dropbox/Opportunity Insights Shared Workspace/Research files/outside/workforce_training/Slides/MADHE_aug2026/figures";
const OUTPUT = cliOpts.output ?? path.join(BASE, "MADHE_aug2026_Figures.pptx");
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: FIG_DIR,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
});

const fig = (name) => deck.fig(name);

// No title slide -- this is a figure deck meant to drop into a larger presentation.
//
// Figures that have not been generated yet are SKIPPED rather than emitted as
// empty slides, and reported at the end of the run. Re-run once Stata has
// written them to pick them up automatically.
const skipped = [];
let planned = 0;

const figExists = (name) =>
  fs.existsSync(path.join(FIG_DIR, name + ".svg")) ||
  fs.existsSync(path.join(FIG_DIR, name + ".png"));

const figSlide = (title, subtitle, name) => {
  planned += 1;
  if (!figExists(name)) {
    skipped.push({ n: planned, name });
    return;
  }
  deck.addFigureSlide(title, subtitle, fig(name));
};

// ---------------------------------------------------------------- titles ---
const T_INST_LEVEL = "Institution-Level Earnings Relative to Non-Completers";
const T_UMASS_PRG_VA = "UMass Program-Level VA Relative to Non-Completers";
const T_STATE_PRG_VA =
  "State University Program-Level VA Relative to Non-Completers";
const T_INST_SC =
  "Institution-Level VA Relative to Non-Completers vs. Median Earnings";
const T_INST_CARN =
  "Institution-Level VA Relative to Non-Completers vs. Context-Adjusted Earnings";
// Slides 20-32 share one title: the institution x field scatter build and the
// cumulative by-field build (distinguished by subtitle).
const T_PRG_SC =
  "Program-Level VA Relative to Non-Completers vs. Median Earnings";
const T_HEALTH = "Zooming In on Health Programs";
const T_AMHERST = "UMass Amherst Program-Level VA";
const T_FIELD = "Field-Level VA Relative to Non-Completers vs. Median Earnings";
const T_FIELD_UMASS = "UMass Field-Level VA";
const T_FIELD_STATE = "State University Field-Level VA";

// ------------------------------------------------------------- subtitles ---
const WOM = "; Excluding Mass Maritime";
const S_LEVELS = "Adjusted Earnings Levels at Ages 25\u201327";
const S_DIFFS = "Adjusted Earnings Differences at Ages 25\u201327";
const S_SC8 = "College Scorecard Median Earnings, 8 Years After Entry";
const S_CARN =
  "Carnegie Earnings Benchmark Adjusted for Student Demographics and Geography";
const S_SC4 = "College Scorecard Median Earnings, 4 Years After Completion";
const S_SC4_INSTPRG = `${S_SC4}; One Point per Institution-Field Program`;
const S_SC4_FIELD = `${S_SC4}; One Point per Field Across Institutions`;
const S_SC4_FIELD_UMASS = `${S_SC4}; One Point per Field Across UMass Institutions`;
const S_SC4_FIELD_STATE = `${S_SC4}; One Point per Field Across State Universities`;

// Field order for the institution x field cumulative build (slides 24-31).
// Verified 2026-08-09 against an earlier generation of these figures: each
// byfield_N added exactly one new marker color, in this sequence, matching
// legend_field_manual.svg.
const FIELD_ORDER = [
  "Health",
  "Education",
  "CS & Engineering",
  "Business",
  "Science & Math",
  "Social Sciences",
  "Arts & Humanities",
  "Other",
];

// The program-level bar animations run 1-8; the deck shows the first two
// steps and the final step.
const PRG_STEPS = [1, 2, 8];

// The scatter builds run 1-4: axes -> points -> fit line -> labels.
const SCATTER_FRAMES = [1, 2, 3, 4];

async function main() {
  // === Institution-level earnings levels (includes Mass Maritime) =========
  // Slides 1-5
  for (const i of [0, 1, 2, 3, 4]) {
    figSlide(T_INST_LEVEL, S_LEVELS, `inst_va_estimate_noncomp_animation_${i}`);
  }

  // === UMass program-level value added ====================================
  // Slides 6-8
  for (const i of PRG_STEPS) {
    figSlide(
      T_UMASS_PRG_VA,
      S_DIFFS,
      `umass_program_va_estimate_noncomp_animation_${i}`
    );
  }

  // === State university program-level VA -- excluding Mass Maritime =======
  // Slides 9-11
  for (const i of PRG_STEPS) {
    figSlide(
      T_STATE_PRG_VA,
      S_DIFFS + WOM,
      `state_program_va_estimate_noncomp_animation_${i}`
    );
  }

  // === Institution-level VA vs. Scorecard -- excluding Mass Maritime ======
  // Slides 12-15
  for (const i of SCATTER_FRAMES) {
    figSlide(
      T_INST_SC,
      S_SC8 + WOM,
      `scatterplot_inst_va_estimate_noncomp_lvl_scorecard_womaritime_${i}`
    );
  }

  // === Institution-level VA vs. Carnegie -- excluding Mass Maritime =======
  // Slides 16-19: plain, + 45-degree line, + labels, then fit stat
  const CARN = "scatterplot_inst_va_estimate_noncomp_lvl_carnegie_earningscontext";
  figSlide(T_INST_CARN, S_CARN + WOM, `${CARN}_womaritime`);
  figSlide(T_INST_CARN, S_CARN + WOM, `${CARN}_womaritime_45line`);
  figSlide(T_INST_CARN, S_CARN + WOM, `${CARN}_wlbl_womaritime_45line`);
  figSlide(T_INST_CARN, S_CARN + WOM, `${CARN}_wstat_womaritime`);

  // === Institution x field VA vs. Scorecard -- excluding Mass Maritime ====
  // Slides 20-23
  for (const i of SCATTER_FRAMES) {
    figSlide(
      T_PRG_SC,
      S_SC4_INSTPRG + WOM,
      `scatterplot_instbyprg_va_estimate_noncomp_lvl_scorecard_womaritime_${i}`
    );
  }

  // === Institution x field animation -- excluding Mass Maritime ===========
  // Slides 24-31: cumulative build, one field added per slide
  FIELD_ORDER.forEach((field, idx) => {
    figSlide(
      T_PRG_SC,
      `${S_SC4}; Adding ${field}`,
      `scatterplot_instbyprg_va_estimate_noncomp_lvl_scorecard_byfield_${idx + 1}_womaritime`
    );
  });

  // Slide 32: all eight fields together
  figSlide(
    T_PRG_SC,
    `${S_SC4}; All Fields`,
    "scatterplot_instbyprg_va_estimate_noncomp_lvl_scorecard_byfield_womaritime"
  );

  // === Health programs ====================================================
  // Slides 33-36. These figures carry no "_womaritime" suffix: Maritime has no
  // health programs, so Stata emits a single version that already excludes it.
  const HEALTH = "scatterplot_health_va_estimate_noncomp_lvl_scorecard";
  figSlide(T_HEALTH, S_SC4 + WOM, HEALTH);
  figSlide(T_HEALTH, S_SC4 + WOM, `${HEALTH}_45line`);
  figSlide(T_HEALTH, S_SC4 + WOM, `${HEALTH}_wlbl_45line`);
  figSlide(T_HEALTH, S_SC4 + WOM, `${HEALTH}_wstat`);

  // === UMass Amherst programs =============================================
  // Slides 37-40
  const AMHERST = "scatterplot_prgamherst_va_estimate_noncomp_lvl";
  figSlide(T_AMHERST, S_SC4, `${AMHERST}_scorecard`);
  figSlide(T_AMHERST, S_SC4, `${AMHERST}_scorecard_wstat`);
  figSlide(T_AMHERST, `${S_SC4}; Programs Colored by Field`, `${AMHERST}_byfield_scorecard`);
  figSlide(
    T_AMHERST,
    `${S_SC4}; Programs Colored by Field`,
    `${AMHERST}_byfield_scorecard_wstat`
  );

  // === Field-level across all institutions -- excluding Mass Maritime =====
  // Slides 41-43
  const PRG = "scatterplot_prg_va_estimate_noncomp_lvl";
  figSlide(T_FIELD, S_SC4_FIELD, `${PRG}_scorecard_womaritime`);
  figSlide(T_FIELD, S_SC4_FIELD, `${PRG}_byfield_scorecard_womaritime`);
  figSlide(T_FIELD, S_SC4_FIELD, `${PRG}_byfield_scorecard_wstat_womaritime`);

  // === Field-level across UMass institutions ==============================
  // Slides 44-46
  figSlide(T_FIELD_UMASS, S_SC4_FIELD_UMASS, `${PRG}_scorecard_umass_womaritime`);
  figSlide(T_FIELD_UMASS, S_SC4_FIELD_UMASS, `${PRG}_byfield_scorecard_umass_womaritime`);
  figSlide(
    T_FIELD_UMASS,
    S_SC4_FIELD_UMASS,
    `${PRG}_byfield_scorecard_umass_wstat_womaritime`
  );

  // === Field-level across state universities -- excl. Mass Maritime =======
  // Slides 47-49
  figSlide(T_FIELD_STATE, S_SC4_FIELD_STATE, `${PRG}_scorecard_state_womaritime`);
  figSlide(T_FIELD_STATE, S_SC4_FIELD_STATE, `${PRG}_byfield_scorecard_state_womaritime`);
  figSlide(
    T_FIELD_STATE,
    S_SC4_FIELD_STATE,
    `${PRG}_byfield_scorecard_state_wstat_womaritime`
  );

  if (skipped.length) {
    console.warn(
      `\n  WARNING: ${skipped.length} of ${planned} figures not found in\n  ${FIG_DIR}\n  Those slides were SKIPPED:`
    );
    for (const s of skipped) {
      console.warn(`    slide ${String(s.n).padStart(2)}: ${s.name}`);
    }
    console.warn("  Generate them, then re-run to get the full deck.\n");
  }

  await deck.save();
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
