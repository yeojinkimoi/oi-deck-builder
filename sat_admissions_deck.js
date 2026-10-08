#!/usr/bin/env node
"use strict";

const path = require("path");
const { OIDeckBuilder, parseArgs } = require("./oi_deck_builder");

const BASE = __dirname;
const cliOpts = parseArgs();
const FIG_DIR = cliOpts.figDir ?? "C:/Users/realj/Documents/20260830_figs/figures";
const OUTPUT = cliOpts.output ?? path.join(BASE, "SAT_Admissions_Figures.pptx");
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: FIG_DIR,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
  showSource: false,
});

const fig = (name) => deck.fig(name);
const figSlide = (title, subtitle, name) =>
  deck.addFigureSlide(title, subtitle, fig(name));

// Repeated titles (one per figure family; builds reuse the same title)
const T_FIG1A = "How SAT Scores Affect Admission";
const T_FIG1B = "The SAT Effect Is Nonlinear";
const T_FIG1C = "SAT Effects Are Similar by Disadvantage";
const T_FIG1D = "SAT Scores Reinforce Strong Applications";
const T_FIG1_RECAP = "The Causal Effect of SAT Scores";
const T_FIG3A = "When Does Withholding a Score Help?";
const T_VARDECOMP = "What Drives Predicted Admission?";
const T_RATINGS = "Which Ratings Do SAT Scores Change?";
const T_REGIME = "Testing Regime Changes Little";
const T_RELIABILITY = "Readers Agree Most on Academics";
const T_VARDECOMP_FULL = "Full Variance Decomposition";

async function main() {
  // No title slide (per outline deck settings).

  // --- Figure 1a: Between- and within-applicant relationships (4-frame build) ---
  figSlide(T_FIG1A, "Raw Relationship Across All Applicants", "fig1a_1");
  figSlide(T_FIG1A, "Restricting to Second-Round Applicants", "fig1a_2");
  figSlide(T_FIG1A, "Between-Applicant Relationship", "fig1a_3");
  figSlide(T_FIG1A, "Within-Applicant Causal Effect", "fig1a_final");

  // --- Figure 1b: Nonlinearity in the causal SAT effect (3-frame build) ---
  figSlide(T_FIG1B, "Average Within-Applicant Effect", "fig1b_1");
  figSlide(T_FIG1B, "Flexible Estimates by SAT Sextile", "fig1b_2");
  figSlide(T_FIG1B, "Separate Slopes by SAT Tercile", "fig1b_final");

  // --- Figure 1c: Heterogeneity by disadvantage ---
  figSlide(
    T_FIG1C,
    "Within-Applicant Effects for Disadvantaged and Other Applicants",
    "fig1c_final"
  );

  // --- Figure 1d: Heterogeneity by non-test application strength ---
  figSlide(
    T_FIG1D,
    "Larger Effects for Applicants with Strong Non-Test Credentials",
    "fig1d_final"
  );

  // --- Figure 1 recap ---
  figSlide(T_FIG1_RECAP, "Summary of Figure 1", "fig1_combined");

  // --- Figure 3a: The student test-submission decision (4-frame build) ---
  figSlide(T_FIG3A, "Overall Effect of Omitting an SAT Score", "fig3a_1");
  figSlide(T_FIG3A, "The Overall SAT Threshold Is About 1433", "fig3a_2");
  figSlide(T_FIG3A, "Effects by Applicant Disadvantage", "fig3a_3");
  figSlide(T_FIG3A, "Group-Specific SAT Thresholds", "fig3a_4");

  // --- Table 2, column 5: Variance decomposition (covariance omitted) ---
  figSlide(
    T_VARDECOMP,
    "Variance Decomposition; Covariance Omitted from Display",
    "bar1_wocov"
  );
  figSlide(T_VARDECOMP, "Adding 95% Confidence Intervals", "bar1_wocov_wci");

  // --- Table 2, columns 2-4: Overall, academic, non-academic ratings (4-frame build) ---
  figSlide(T_RATINGS, "Overall Rating", "bar2_1");
  figSlide(T_RATINGS, "Adding the Academic Rating", "bar2_2");
  figSlide(T_RATINGS, "Adding the Non-Academic Rating", "bar2_3");
  figSlide(
    T_RATINGS,
    "No Non-Academic Halo Effect; 95% Confidence Intervals",
    "bar2_wci"
  );

  // --- Table 2, final two columns: Test-optional vs. test-mandatory ---
  figSlide(T_REGIME, "Test-Optional versus Test-Mandatory Evaluation", "bar3");
  figSlide(T_REGIME, "Adding 95% Confidence Intervals", "bar3_wci");

  // --- Table 1: Inter-reader reliability ---
  figSlide(
    T_RELIABILITY,
    "Inter-Reader Reliability Across Evaluation Measures",
    "bar4"
  );

  // --- Appendix: Full variance decomposition (includes covariance term) ---
  figSlide(T_VARDECOMP_FULL, "Including the Covariance Component", "bar1");
  figSlide(
    T_VARDECOMP_FULL,
    "Including Covariance and 95% Confidence Intervals",
    "bar1_wci"
  );

  await deck.save();
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
