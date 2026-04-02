#!/usr/bin/env node
/**
 * wgu_deck.js
 *
 * WGU President deck — generated from wgu_outline_template.md.
 * Uses oi_deck_builder for all styling, layout, and figure placement.
 *
 * Run:
 *   node wgu_deck.js
 *   node wgu_deck.js --fig-dir ./my_figures --output MyDeck.pptx
 */

"use strict";

const path = require("path");
const { OIDeckBuilder, parseArgs } = require("../oi_deck_builder");

const BASE = __dirname;
const cliOpts = parseArgs();
const FIG_DIR = cliOpts.figDir ?? path.join(BASE, "figures");
const OUTPUT = cliOpts.output ?? path.join(BASE, "WGU_President.pptx");
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: FIG_DIR,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
  rasterWidth: cliOpts.rasterWidth ?? 2400,
});

const fig = (name) => deck.fig(name);

async function main() {
  console.log("Building WGU President deck...");
  console.log(`  Figures: ${FIG_DIR}`);
  console.log(`  Output:  ${OUTPUT}`);
  console.log(`  Cache:   ${CACHE_DIR}`);

  // ── TITLE SLIDE ─────────────────────────────────────────────────────────
  deck.addTitleSlide(
    "The Impacts of WGU Programs on Students\u2019 Earnings",
    "Preliminary Estimates Using Matched Comparison Groups",
    "February 2026",
    "PRELIMINARY DATA -- DO NOT CITE"
  );

  // ── TEXT: Data Sources ─────────────────────────────────────────────────
  deck.addRichTextSlide("Data Sources", [
    "Data: WGU enrollment records linked to Census+tax data covering full U.S. population (including tax filers and non-filers)",
    ["99% of WGU enrollees successfully linked", 1],
    ["Includes WGU graduates, withdrawers, and certificates", 1],
    "",
    "Analysis sample: 262,000 WGU enrollees from 2013-18",
    ["Earnings observed from 2008-2023 in tax records", 1],
    "",
    "Primary outcome: earnings reported on W-2 forms, measured in real 2021 dollars",
    ["Includes those not working as 0s", 1],
    ["Excludes self-employment income (can be incorporated later)", 1],
  ]);

  // ── TEXT: Identifying Matched Controls ─────────────────────────────────
  deck.addRichTextSlide("Identifying Matched Controls", [
    "For each WGU enrollee, identify matched controls based on:",
    ["Pre-enrollment earnings trajectory: W-2 earnings in the three years prior to enrollment (small)", 1],
    ["Age, sex, and county of residence in year of enrollment (small)", 1],
    "",
    "Then compare average earnings of WGU enrollees to those of matched controls pre vs. post enrollment",
    ["Average WGU enrollee has 350 matched controls (small)", 1],
    ["11% of matched control group enrolls in other non-WGU degree programs at the same time (small)", 1],
  ]);

  // ── TABLE: WGU Program Categories ─────────────────────────────────────
  deck.addTableSlide("WGU Program Categories", [
    ["Degree Level", "Program", "Example Program", "Number of Students", "Graduation Rate"],
    ["Bachelor", "Education",  "BA, Interdisciplinary Studies (K-8)",        "31,000", "53%"],
    ["Bachelor", "Health",     "BS, Nursing",                                "54,000", "75%"],
    ["Bachelor", "Business",   "BS, Business Management",                    "65,000", "46%"],
    ["Bachelor", "Technology", "BS, Information Technology",                  "29,000", "46%"],
    ["Master",   "Education",  "MS, Curriculum and Instruction",             "22,000", "81%"],
    ["Master",   "Health",     "MS, Nursing Education (BSN-MSN)",            "25,000", "67%"],
    ["Master",   "Business",   "MBA",                                        "32,000", "67%"],
    ["Master",   "Technology", "MS, Cybersecurity and Information Assurance", "5,000",  "59%"],
  ], {
    colW: [2.0254, 2.2869, 3.8115, 2.0724, 2.0724],
  }, {
    subtitle: "Programs Grouped into Eight Degree-Sectors",
    footnote: "Programs aggregated from individual WGU degree programs into 8 groups by degree level and field of study.",
  });

  // ── 1-FIGURE: B.Ed bin=2 animation sequence ───────────────────────────
  deck.addFigureSlide(
    "Impact of Bachelor of Education on Earnings",
    "WGU Enrollees who Graduate 2 Years After Entry vs. Matched Controls",
    fig("slide1_BaEd_bin2_grad_treat_only"),
  );

  deck.addFigureSlide(
    "Impact of Bachelor of Education on Earnings",
    "WGU Enrollees who Graduate 2 Years After Entry vs. Matched Controls",
    fig("slide1_BaEd_bin2_grad_both"),
  );

  deck.addFigureSlide(
    "Impact of Bachelor of Education on Earnings",
    "WGU Enrollees who Graduate 2 Years After Entry vs. Matched Controls",
    fig("slide1_BaEd_bin2_grad_delta"),
  );

  // ── 2-FIGURE: B.Ed grad + withdrawer ──────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Education on Earnings",
    "WGU Enrollees who Graduates or Withdraw 2 Years After Entry",
    [fig("slide2_BaEd_bin2_grad_delta"), fig("slide2_BaEd_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // ── 4-FIGURE: B.Ed bins 3 & 4 ─────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Education on Earnings",
    "WGU Enrollees who Graduates or Withdraw 3 or 4 Years After Entry",
    [
      fig("slide3_BaEd_grad_bin3_delta"),
      fig("slide3_BaEd_wd_bin3_delta"),
      fig("slide3_BaEd_grad_bin4_delta"),
      fig("slide3_BaEd_wd_bin4_delta"),
    ],
    2, 2,
    { panelTitles: ["Graduates", "Withdrawers", "", ""] }
  );

  // ── 2-FIGURE: B.Ed baseline vs. 1098-T ────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Education on Earnings",
    "Baseline Model vs. Comparison to People who Enroll in Other Higher Education Institutions",
    [fig("slide4_BaEd_bin3_baseline_delta"), fig("slide4_BaEd_bin3_1098t_delta")],
    2, 1,
    {
      panelTitles: [
        "Comparison to All Matched Individuals",
        "Comparison to Other Higher Education Enrollees",
      ],
    }
  );

  // ── 2-FIGURE: Bachelor Business ────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Business on Earnings",
    "WGU Enrollees who Graduate or Withdraw 3 Years After Entry",
    [fig("slide5_BaBu_bin3_grad_delta"), fig("slide5_BaBu_bin3_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // ── 3-FIGURE: Bachelor Technology ──────────────────────────────────────
  deck.add3FigureSlide(
    "Impact of Bachelor of Technology on Earnings",
    "WGU Enrollees who Graduate 3 Years After Entry, Withdraw w/Certificate, or Withdraw w/o Certificate",
    [fig("slide6_BaTe_grad_delta"), fig("slide6_BaTe_wd_somecert_delta"), fig("slide6_BaTe_wd_nocert_delta")],
    ["Graduates", "Withdrawers w/ Certificate", "Withdrawers w/o Certificate"]
  );

  // ── 2-FIGURE: Bachelor Health ──────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Health on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide7_BaHe_bin2_grad_delta"), fig("slide7_BaHe_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // ── 2-FIGURE: Master Education ─────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Master of Education on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide8_MaEd_bin2_grad_delta"), fig("slide8_MaEd_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // ── 2-FIGURE: Master Business ──────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Master of Business on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide9_MaBu_bin2_grad_delta"), fig("slide9_MaBu_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // ── 2-FIGURE: Master Technology ────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Master of Technology on Earnings",
    "WGU Enrollees who Graduate 2 Years After Entry or Withdraw",
    [fig("slide10_MaTe_grad_delta"), fig("slide10_MaTe_wd_nocert_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // ── 2-FIGURE: Master Health ────────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Impact of Master of Health on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide11_MaHe_bin2_grad_delta"), fig("slide11_MaHe_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // ── 1-FIGURE: Bar charts ──────────────────────────────────────────────
  deck.addFigureSlide(
    "Impact of WGU Programs on Earnings",
    "Treatment Effects on W-2 Wages 5 Years After Enrollment",
    fig("slide12a_barplot_grads"),
  );

  deck.addFigureSlide(
    "Impact of WGU Programs on Earnings",
    "Treatment Effects on W-2 Wages 5 Years After Enrollment",
    fig("slide12b_barplot_grads_wd"),
  );

  // ── 2-FIGURE: Placebo Test ────────────────────────────────────────────
  deck.addMultiFigureSlide(
    "Placebo Test: Matching on Wages 3-5 Years Prior to Enrollment",
    "Bachelor of Education & Bachelor of Health vs. Matched Controls",
    [fig("slide_BaEd_bin3_26_delta"), fig("slide_BaHe_bin2_26_delta")],
    2, 1,
    { panelTitles: ["Bachelor of Education", "Bachelor of Health"] }
  );

  // ── 1-FIGURE: Bar chart all ───────────────────────────────────────────
  deck.addFigureSlide(
    "Impact of WGU Programs on Earnings",
    "Treatment Effects on W-2 Wages 5 Years After Enrollment",
    fig("slide12c_barplot_all"),
  );

  // ── 1-FIGURE: Scatter ─────────────────────────────────────────────────
  deck.addFigureSlide(
    "Withdrawal Effects vs. Placebo Tests",
    "Treatment Effects on 5-Year Wages by Program",
    fig("slide14_scatter_wd_vs_placebo"),
  );

  // ── TEXT: Next Steps and Discussion ────────────────────────────────────
  deck.addRichTextSlide("Next Steps and Discussion", [
    { text: "Find matched control vector that eliminates selection problem in certain programs (e.g., healthcare)", options: { bullet: { type: "number" } } },
    { text: "Validate alternative estimators against quasi-experimental designs where variation in WGU enrollment is not driven by individual selection", options: { bullet: { type: "number" } } },
    ["Rollout of WGU programs in certain states/firms (small)", 1],
    ["Eligibility cutoffs, targeting, or ads to certain subgroups/areas (small)", 1],
  ]);

  // ── SAVE ────────────────────────────────────────────────────────────────
  await deck.save();
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
