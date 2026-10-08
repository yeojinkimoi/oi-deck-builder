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
  "C:/Users/realj/Opportunity Insights Dropbox/Opportunity Insights Shared Workspace/Research files/outside/workforce_training/Slides/SOO-2026/draft-figure-slide.pptx";
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: FIG_DIR,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
  // Source footnote on every figure slide (bold "Source: " + citation).
  showSource: false,
});

const fig = (name) => deck.fig(name);

// Single-figure placement uses the builder default, which now matches the
// blank template's content region (x=0.586, y=1.288, w=11.961, h=5.484).
const figSlide = (title, subtitle, name) =>
  deck.addFigureSlide(title, subtitle, fig(name));

// Repeated title/subtitle strings
const WT_TITLE = "Effects of Workforce Training Programs on Earnings";
const ST_39SITES = "Observational vs. Randomized Trial Estimates for Programs Implemented in 39 Sites";
const ST_26SITES = "Observational vs. Randomized Trial Estimates for Programs Implemented in 26 sites (w/o ERA)";
const DIGITAL_TWINS = "Digital Twins Almost Identical to RCT Control Group";
const ST_PACE = "Evidence from PACE Randomized Trial in 2014";
const ST_SEIS = "Observational vs. Randomized Trial Estimates for Per Scholas (SEIS RCT)";
const ST_WA = "Observational vs. Randomized Trial Estimates for Per Scholas (Work Advance RCT)";
const ST_STED = "Observational vs. Randomized Trial Estimates for STED (LAP Sites)";

// Real-time evaluation section (Year Up digital twins over time)
const RT_TITLE = "Using Synthetic Digital Twins for Real-Time Program Evaluation";
const RT_SUB_COHORT = "Impacts of Year Up Program on Earnings, By Cohort of Program Enrollment";
const RT_SUB_SITE = "Impacts of Year Up Program on Earnings, By Site and Cohort of Program Enrollment";

// Explaining site/cohort differences (Year Up)
const YU_EXPLAIN_TITLE = "Explaining Differences in Impacts of YearUp Across Sites and Cohorts";
const YU_EXPLAIN_SUB = "Earnings Impacts vs. Job Placement Rates in Target Sectors";

// WGU BS+RN section
const WGU_TITLE = "Impact of Western Governor’s University BS+RN on Earnings";
const WGU_SUB_GRAD3 = "WGU Enrollees who Graduate 3 Years After Entry vs. Synthetic Digital Twins";
const WGU_SUB_GRAD2 = "WGU Enrollees who Graduate 2 Years After Entry vs. Synthetic Digital Twins";
const BACHED_TITLE = "Impact of Bachelor of Education on Earnings";

// WGU withdrawal section
const WGU_WD_TITLE = "Effect of Enrolling but not Completing WGU BS+RN on Earnings";
const WGU_WD_SUB = "WGU Enrollees in BS+RN Program who Withdraw vs. Synthetic Digital Twins";

// Dallas College section
const DC_NURS_TITLE = "Impact of Dallas College Nursing Associate Degree on Earnings";
const DC_NURS_SUB = "Enrollees who Graduate 3 Years After Entry vs. Synthetic Digital Twins";
const DC_VTECH_TITLE = "Impact of Dallas College Veterinary Technology Program on Earnings";
const DC_VTECH_SUB = "Credential Earners vs. Synthetic Digital Twins";
const DC_CE_TITLE = "Impact of Dallas College CE on Earnings";
const DC_CR_TITLE = "Impact of Dallas College CR on Earnings";
const DC_HSCR_TITLE = "Impact of Dallas College Health Sciences Credit Programs on Earnings";
const DC_TE_SUB = "Treatment Effects on Earnings 5 Years After Enrollment";

// Preferred estimates section
const PREF_TITLE = "Preferred Estimates versus Pre- Post- Estimates";
const PREF_SUB = "Treatment Effects by Program";

async function main() {
  const YU_TITLE = "Impact of Year Up on Earnings";
  const LALONDE_TITLE = "Comparison to Lalonde (1986) Results";
  const LALONDE_SUB = "Noise-Adjusted Root Mean-Squared Error Using Digital Twins vs. Traditional Parametric Models";

  // Slide 1: Year Up event study — mean (a0)
  figSlide(YU_TITLE, ST_PACE, "YU_PACE_all_rct_dml_event_study_mean_a0");

  // Slide 2: Year Up event study — mean (a1)
  figSlide(YU_TITLE, ST_PACE, "YU_PACE_all_rct_dml_event_study_mean_a1");

  // Slide 3: Year Up event study — mean (a)
  figSlide(YU_TITLE, ST_PACE, "YU_PACE_all_rct_dml_event_study_mean_a");

  // Slide 4: Year Up event study — mean (b)
  figSlide(DIGITAL_TWINS, ST_PACE, "YU_PACE_all_rct_dml_event_study_mean_b");

  // Slide 5: Year Up event study — mean (b), repeated
  figSlide(DIGITAL_TWINS, ST_PACE, "YU_PACE_all_rct_dml_event_study_mean_b");

  // Slide 6: Year Up event study — treatment effect (RCT only)
  figSlide(DIGITAL_TWINS, ST_PACE, "YU_PACE_all_rct_dml_event_study_te_rct");

  // Slide 7: Year Up event study — treatment effect
  figSlide(DIGITAL_TWINS, ST_PACE, "YU_PACE_all_rct_dml_event_study_te");

  // Slide 8: 39-sites scatter (highlighted)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_highlighted");

  // Slide 9: Per Scholas (SEIS) — mean (a)
  figSlide(WT_TITLE, ST_SEIS, "SEIS_PS_rct_dml_event_study_mean_a");

  // Slide 10: Per Scholas (SEIS) — mean (b)
  figSlide(WT_TITLE, ST_SEIS, "SEIS_PS_rct_dml_event_study_mean_b");

  // Slide 11: Per Scholas (SEIS) — mean (b), repeated
  figSlide(WT_TITLE, ST_SEIS, "SEIS_PS_rct_dml_event_study_mean_b");

  // Slide 12: Per Scholas (SEIS) — treatment effect
  figSlide(WT_TITLE, ST_SEIS, "SEIS_PS_rct_dml_event_study_te");

  // Slide 13: Work Advance — mean (a)
  figSlide(WT_TITLE, ST_WA, "WA_PS_rct_dml_event_study_mean_a");

  // Slide 14: Work Advance — mean (b)
  figSlide(WT_TITLE, ST_WA, "WA_PS_rct_dml_event_study_mean_b");

  // Slide 15: Work Advance — mean (b), repeated
  figSlide(WT_TITLE, ST_WA, "WA_PS_rct_dml_event_study_mean_b");

  // Slide 16: Work Advance — treatment effect
  figSlide(WT_TITLE, ST_WA, "WA_PS_rct_dml_event_study_te");

  // Slide 17: STED (LAP) — mean (a)
  figSlide(WT_TITLE, ST_STED, "STED_LAP_rct_dml_event_study_mean_a");

  // Slide 18: STED (LAP) — mean (b)
  figSlide(WT_TITLE, ST_STED, "STED_LAP_rct_dml_event_study_mean_b");

  // Slide 19: STED (LAP) — mean (b), repeated
  figSlide(WT_TITLE, ST_STED, "STED_LAP_rct_dml_event_study_mean_b");

  // Slide 20: STED (LAP) — treatment effect
  figSlide(WT_TITLE, ST_STED, "STED_LAP_rct_dml_event_study_te");

  // Slide 21: 39-sites scatter (blank)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_blank");

  // Slide 22: 39-sites scatter (formatted)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_fmted");

  // Slide 23: 39-sites scatter (lined)
  figSlide(WT_TITLE, ST_39SITES, "rct_dml_wages2_5_scatter_lined");

  // Slide 24: 26-sites scatter (formatted, w/o ERA)
  figSlide(WT_TITLE, ST_26SITES, "rct_dml_wages2_5_scatter_fmted_woera");

  // Slide 25: 26-sites scatter (lined, w/o ERA)
  figSlide(WT_TITLE, ST_26SITES, "rct_dml_wages2_5_scatter_lined_woera");

  // Slide 26: RMSE vs. Lalonde — noise-adjusted (blank)
  figSlide(LALONDE_TITLE, LALONDE_SUB, "rmse_noise_adj_0");

  // Slide 27: RMSE vs. Lalonde — noise-adjusted (1)
  figSlide(LALONDE_TITLE, LALONDE_SUB, "rmse_noise_adj_1");

  // Slide 28: RMSE vs. Lalonde — noise-adjusted (2)
  figSlide(LALONDE_TITLE, LALONDE_SUB, "rmse_noise_adj_2");

  // Slide 29: RMSE vs. Lalonde — noise-adjusted (3)
  figSlide(LALONDE_TITLE, LALONDE_SUB, "rmse_noise_adj_3");

  // Slide 30: Year Up over time — panel (a)
  figSlide(RT_TITLE, RT_SUB_COHORT, "yearup_over_time_a");

  // Slide 31: Year Up over time — panel (b)
  figSlide(RT_TITLE, RT_SUB_COHORT, "yearup_over_time_b");

  // Slide 32: Year Up city comparison
  figSlide(RT_TITLE, RT_SUB_SITE, "yearup_city_comparison");

  // Slide 33: Year Up earnings vs. placement rates
  figSlide(YU_EXPLAIN_TITLE, YU_EXPLAIN_SUB, "yearup_earnings_vs_placement_rates");

  // Slide 34: WGU BS+RN — graduate 3yr event study
  figSlide(WGU_TITLE, WGU_SUB_GRAD3, "WGU_BSRN_grad3_event_study");

  // Slide 35: WGU BS+RN — withdrawal event study
  figSlide(WGU_WD_TITLE, WGU_WD_SUB, "WGU_BSRN_wd_event_study");

  // Slide 36: Bachelor of Education — graduate 2yr event study
  figSlide(BACHED_TITLE, WGU_SUB_GRAD2, "WGU_BachEd_grad2_event_study");

  // Slide 37: Dallas College Nursing — event study
  figSlide(DC_NURS_TITLE, DC_NURS_SUB, "DC_NURS_event_study");

  // Slide 38: Dallas College Veterinary Technology — event study
  figSlide(DC_VTECH_TITLE, DC_VTECH_SUB, "DC_VTECH_event_study");

  // Slide 39: Dallas College CE — treatment effects
  figSlide(DC_CE_TITLE, DC_TE_SUB, "DallasCollege_school_CE_te_barplot");

  // Slide 40: Dallas College CR — treatment effects
  figSlide(DC_CR_TITLE, DC_TE_SUB, "DallasCollege_school_CR_te_barplot");

  // Slide 41: Dallas College Health Sciences Credit — treatment effects
  figSlide(DC_HSCR_TITLE, DC_TE_SUB, "DallasCollege_HSCR_te_barplot");

  // Slide 42: Preferred vs. pre-post — pooled
  figSlide(PREF_TITLE, PREF_SUB, "hbarplot_pref_pooled");

  // Slide 43: Preferred vs. pre-post — all pooled
  figSlide(PREF_TITLE, PREF_SUB, "hbarplot_all_pooled");

  await deck.save();
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
