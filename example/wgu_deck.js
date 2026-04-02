#!/usr/bin/env node
/**
 * wgu_deck.js
 *
 * WGU President deck — project-specific slide content.
 * Uses oi_deck_builder for all styling, layout, and figure placement.
 *
 * Run:
 *   node wgu_deck.js
 *   node wgu_deck.js --fig-dir ./my_figures --output MyDeck.pptx
 */

"use strict";

const path = require("path");
const fs = require("fs");

const {
  OIDeckBuilder,
  theme,
  containInBox,
  getPngSize,
  parseArgs,
} = require("../oi_deck_builder");

const C = theme.colors;
const F = theme.fonts;

// ── CLI / paths ────────────────────────────────────────────────────────────
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
  // Logos default to oi-slide/ directory (oi_logo_logo.png, oi_logo_full.png)
});

const fig = (name) => deck.fig(name);

// ══════════════════════════════════════════════════════════════════════════════
// BUILD THE DECK
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("Building WGU President deck...");
  console.log(`  Figures: ${FIG_DIR}`);
  console.log(`  Output:  ${OUTPUT}`);
  console.log(`  Cache:   ${CACHE_DIR}`);

  // ── TITLE SLIDE ─────────────────────────────────────────────────────────
  deck.addTitleSlide({
    textItems: [
      { text: "The Impacts of WGU Programs on Students\u2019 Earnings",
        options: { fontFace: F.TITLE, fontSize: 32, bold: true, color: C.DARK_TEXT, breakLine: true } },
      { text: "Preliminary Estimates Using Matched Comparison Groups",
        options: { fontFace: F.TITLE, fontSize: 24, bold: false, color: C.DARK_TEXT, breakLine: true } },
      { text: "", options: { fontSize: 12, breakLine: true } },
      { text: "", options: { fontSize: 12, breakLine: true } },
      { text: "February 2026",
        options: { fontFace: F.LABEL, fontSize: 12, bold: true, color: C.DARK_TEXT, breakLine: true } },
      { text: "PRELIMINARY DATA -- DO NOT CITE",
        options: { fontFace: F.LABEL, fontSize: 12, bold: true, color: C.DARK_TEXT } },
    ],
  });

  // ── TEXT SLIDE 1: Data Sources ──────────────────────────────────────────
  deck.addRichTextSlide("Data Sources", [
    { text: "Data: WGU enrollment records linked to Census+tax data covering full U.S. population (including tax filers and non-filers)", options: { bullet: { color: C.OI_GREEN }, indentLevel: 0, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "99% of WGU enrollees successfully linked", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "Includes WGU graduates, withdrawers, and certificates", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "", options: { fontSize: 22, breakLine: true } },
    { text: "Analysis sample: 262,000 WGU enrollees from 2013-18", options: { bullet: { color: C.OI_GREEN }, indentLevel: 0, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "Earnings observed from 2008-2023 in tax records", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "", options: { fontSize: 22, indentLevel: 1, breakLine: true } },
    { text: "Primary outcome: earnings reported on W-2 forms, measured in real 2021 dollars", options: { bullet: { color: C.OI_GREEN }, indentLevel: 0, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "Includes those not working as 0s", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "Excludes self-employment income (can be incorporated later)", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 22, color: C.DARK_TEXT } },
  ]);

  // ── TEXT SLIDE 2: Identifying Matched Controls ─────────────────────────
  deck.addRichTextSlide("Identifying Matched Controls", [
    { text: "For each WGU enrollee, identify matched controls based on:", options: { bullet: { color: C.OI_GREEN }, indentLevel: 0, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "", options: { fontSize: 18, indentLevel: 1, breakLine: true } },
    { text: "Pre-enrollment earnings trajectory: W-2 earnings in the three years prior to enrollment", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 18, color: C.DARK_TEXT, breakLine: true } },
    { text: "", options: { fontSize: 18, indentLevel: 1, breakLine: true } },
    { text: "Age, sex, and county of residence in year of enrollment", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 18, color: C.DARK_TEXT, breakLine: true } },
    { text: "", options: { fontSize: 18, indentLevel: 1, breakLine: true } },
    { text: "", options: { fontSize: 18, indentLevel: 1, breakLine: true } },
    { text: "Then compare average earnings of WGU enrollees to those of matched controls pre vs. post enrollment", options: { bullet: { color: C.OI_GREEN }, indentLevel: 0, fontSize: 22, color: C.DARK_TEXT, breakLine: true } },
    { text: "", options: { fontSize: 18, indentLevel: 1, breakLine: true } },
    { text: "Average WGU enrollee has 350 matched controls", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 18, color: C.DARK_TEXT, breakLine: true } },
    { text: "", options: { fontSize: 18, indentLevel: 1, breakLine: true } },
    { text: "11% of matched control group enrolls in other non-WGU degree programs at the same time", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 18, color: C.DARK_TEXT } },
  ]);

  // ── TEXT SLIDE 3: WGU Program Categories (table) ───────────────────────
  {
    const headerOpts = { fontFace: F.LABEL, fontSize: 16, bold: true, color: "FFFFFF", fill: { color: C.OI_GREEN }, align: "center", valign: "middle" };
    const degreeLabelOpts = { fontFace: F.LABEL, fontSize: 20, bold: true, color: C.DARK_TEXT, align: "center", valign: "middle" };
    const cellOpts = { fontFace: F.LABEL, fontSize: 16, color: C.DARK_TEXT, align: "center", valign: "middle" };
    const altRow = { fill: { color: "F2F2F2" } };

    const rows = [
      [
        { text: "Degree Level", options: headerOpts },
        { text: "Program", options: headerOpts },
        { text: "Example Program", options: headerOpts },
        { text: "Number of Students", options: headerOpts },
        { text: "Graduation Rate", options: headerOpts },
      ],
      [
        { text: "Bachelor", options: { ...degreeLabelOpts, rowspan: 4 } },
        { text: "Education", options: cellOpts },
        { text: "BA, Interdisciplinary Studies (K-8)", options: cellOpts },
        { text: "31,000", options: cellOpts },
        { text: "53%", options: cellOpts },
      ],
      [
        { text: "Health", options: { ...cellOpts, ...altRow } },
        { text: "BS, Nursing", options: { ...cellOpts, ...altRow } },
        { text: "54,000", options: { ...cellOpts, ...altRow } },
        { text: "75%", options: { ...cellOpts, ...altRow } },
      ],
      [
        { text: "Business", options: cellOpts },
        { text: "BS, Business Management", options: cellOpts },
        { text: "65,000", options: cellOpts },
        { text: "46%", options: cellOpts },
      ],
      [
        { text: "Technology", options: { ...cellOpts, ...altRow } },
        { text: "BS, Information Technology", options: { ...cellOpts, ...altRow } },
        { text: "29,000", options: { ...cellOpts, ...altRow } },
        { text: "46%", options: { ...cellOpts, ...altRow } },
      ],
      [
        { text: "Master", options: { ...degreeLabelOpts, rowspan: 4 } },
        { text: "Education", options: cellOpts },
        { text: "MS, Curriculum and Instruction", options: cellOpts },
        { text: "22,000", options: cellOpts },
        { text: "81%", options: cellOpts },
      ],
      [
        { text: "Health", options: { ...cellOpts, ...altRow } },
        { text: "MS, Nursing Education (BSN-MSN)", options: { ...cellOpts, ...altRow } },
        { text: "25,000", options: { ...cellOpts, ...altRow } },
        { text: "67%", options: { ...cellOpts, ...altRow } },
      ],
      [
        { text: "Business", options: cellOpts },
        { text: "MBA", options: cellOpts },
        { text: "32,000", options: cellOpts },
        { text: "67%", options: cellOpts },
      ],
      [
        { text: "Technology", options: { ...cellOpts, ...altRow } },
        { text: "MS, Cybersecurity and Information Assurance", options: { ...cellOpts, ...altRow } },
        { text: "5,000", options: { ...cellOpts, ...altRow } },
        { text: "59%", options: { ...cellOpts, ...altRow } },
      ],
    ];

    deck.addTableSlide("WGU Program Categories", rows, {
      x: 0.6713, y: 1.50, w: 12.2687,
      colW: [2.0254, 2.2869, 3.8115, 2.0724, 2.0724],
      rowH: 0.55,
      border: { type: "solid", pt: 0.5, color: "D9D9D9" },
      autoPage: false,
    }, {
      subtitle: "Programs Grouped into Eight Degree-Sectors",
      footnote: "Programs aggregated from individual WGU degree programs into 8 groups by degree level and field of study.",
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FIGURE SLIDES
  // ══════════════════════════════════════════════════════════════════════════

  // Slide 1a-c: B.Ed bin=2 animation sequence (single)
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

  // Slide 2: B.Ed bin=2 — 2 panels (grad + withdrawer)
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Education on Earnings",
    "WGU Enrollees who Graduates or Withdraw 2 Years After Entry",
    [fig("slide2_BaEd_bin2_grad_delta"), fig("slide2_BaEd_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // Slide 3: B.Ed 4-panel (bins 3 & 4)
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

  // Slide 4: B.Ed baseline vs. 1098-T
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

  // Slide 5: Bachelor Business
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Business on Earnings",
    "WGU Enrollees who Graduate or Withdraw 3 Years After Entry",
    [fig("slide5_BaBu_bin3_grad_delta"), fig("slide5_BaBu_bin3_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // Slide 6: Bachelor Technology — custom 3-panel (1 centered top, 2 bottom)
  {
    const slide = deck.addSlide();
    deck.addTitleBar(slide,
      "Impact of Bachelor of Technology on Earnings",
      "WGU Enrollees who Graduate 3 Years After Entry, Withdraw w/Certificate, or Withdraw w/o Certificate"
    );

    const fb = theme.figBox.FOUR_PANEL;
    const box = { x: fb.x, y: fb.y, w: fb.w, h: fb.h };
    const gap = 0.00;
    const vgap = 0.00;
    const PANEL_TITLE_H = 0.22;
    const cols = 2, rows = 2;

    const availH = box.h - 2 * PANEL_TITLE_H;
    const cellW = (box.w - gap * (cols - 1)) / cols;
    const cellH = (availH - vgap * (rows - 1)) / rows;

    const figPaths = [
      fig("slide6_BaTe_grad_delta"),
      fig("slide6_BaTe_wd_somecert_delta"),
      fig("slide6_BaTe_wd_nocert_delta"),
    ];
    const titles = ["Graduates", "Withdrawers w/ Certificate", "Withdrawers w/o Certificate"];

    const imgs = figPaths.map((fp) => {
      const resolved = deck.resolveFigure(fp);
      if (resolved && fs.existsSync(resolved)) {
        const { width, height } = getPngSize(resolved);
        const imgAspect = width / height;
        const cellAspect = cellW / cellH;
        const renderedH = imgAspect >= cellAspect ? cellW / imgAspect : cellH;
        return { path: resolved, aspect: imgAspect, renderedH };
      }
      return null;
    });

    const row0H = imgs[0] ? imgs[0].renderedH : cellH;
    const row1H = Math.max(imgs[1] ? imgs[1].renderedH : cellH, imgs[2] ? imgs[2].renderedH : cellH);

    const gridH = PANEL_TITLE_H + row0H + vgap + PANEL_TITLE_H + row1H;
    const gridW = cols * cellW + gap * (cols - 1);
    const gridX0 = box.x + (box.w - gridW) / 2;
    const gridY0 = box.y;

    // Top row: 1 centered panel (Graduates)
    {
      const cx = gridX0 + (gridW - cellW) / 2;
      const titleY = gridY0;
      const imgY = gridY0 + PANEL_TITLE_H;

      slide.addText(titles[0], {
        x: cx, y: titleY, w: cellW, h: PANEL_TITLE_H,
        fontFace: F.LABEL, fontSize: 14, bold: true, color: C.DARK_TEXT,
        align: "center", valign: "bottom",
      });

      if (imgs[0]) {
        const cellBox = { x: cx, y: imgY, w: cellW, h: row0H };
        const p = containInBox(cellBox, imgs[0].aspect, "top");
        slide.addImage({ path: imgs[0].path, x: p.x, y: p.y, w: p.w, h: p.h });
      }
    }

    // Bottom row: 2 panels (Withdrawers)
    const botTitleY = gridY0 + PANEL_TITLE_H + row0H + vgap;
    const botImgY = botTitleY + PANEL_TITLE_H;

    for (let c = 0; c < 2; c++) {
      const cx = gridX0 + c * (cellW + gap);
      const img = imgs[c + 1];

      slide.addText(titles[c + 1], {
        x: cx, y: botTitleY, w: cellW, h: PANEL_TITLE_H,
        fontFace: F.LABEL, fontSize: 14, bold: true, color: C.DARK_TEXT,
        align: "center", valign: "bottom",
      });

      if (img) {
        const cellBox = { x: cx, y: botImgY, w: cellW, h: row1H };
        const p = containInBox(cellBox, img.aspect, "top");
        slide.addImage({ path: img.path, x: p.x, y: p.y, w: p.w, h: p.h });
      }
    }

    deck.addLogo(slide);
  }

  // Slide 7: Bachelor Health
  deck.addMultiFigureSlide(
    "Impact of Bachelor of Health on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide7_BaHe_bin2_grad_delta"), fig("slide7_BaHe_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // Slide 8: Master Education
  deck.addMultiFigureSlide(
    "Impact of Master of Education on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide8_MaEd_bin2_grad_delta"), fig("slide8_MaEd_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // Slide 9: Master Business
  deck.addMultiFigureSlide(
    "Impact of Master of Business on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide9_MaBu_bin2_grad_delta"), fig("slide9_MaBu_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // Slide 10: Master Technology
  deck.addMultiFigureSlide(
    "Impact of Master of Technology on Earnings",
    "WGU Enrollees who Graduate 2 Years After Entry or Withdraw",
    [fig("slide10_MaTe_grad_delta"), fig("slide10_MaTe_wd_nocert_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // Slide 11: Master Health
  deck.addMultiFigureSlide(
    "Impact of Master of Health on Earnings",
    "WGU Enrollees who Graduate or Withdraw 2 Years After Entry",
    [fig("slide11_MaHe_bin2_grad_delta"), fig("slide11_MaHe_bin2_wd_delta")],
    2, 1,
    { panelTitles: ["Graduates", "Withdrawers"] }
  );

  // Slide 12a-b: Horizontal bar chart animation (single)
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

  // Placebo Test slide
  deck.addMultiFigureSlide(
    "Placebo Test: Matching on Wages 3-5 Years Prior to Enrollment",
    "Bachelor of Education & Bachelor of Health vs. Matched Controls",
    [fig("slide_BaEd_bin3_26_delta"), fig("slide_BaHe_bin2_26_delta")],
    2, 1,
    { panelTitles: ["Bachelor of Education", "Bachelor of Health"] }
  );

  // Slide 12c: Bar chart with all
  deck.addFigureSlide(
    "Impact of WGU Programs on Earnings",
    "Treatment Effects on W-2 Wages 5 Years After Enrollment",
    fig("slide12c_barplot_all"),
  );

  // Slide 14: Scatter — withdrawal TEs vs. placebo TEs
  deck.addFigureSlide(
    "Withdrawal Effects vs. Placebo Tests",
    "Treatment Effects on 5-Year Wages by Program",
    fig("slide14_scatter_wd_vs_placebo"),
  );

  // ── CLOSING: Next Steps ────────────────────────────────────────────────
  deck.addRichTextSlide("Next Steps and Discussion", [
    { text: "Find matched control vector that eliminates selection problem in certain programs (e.g., healthcare)", options: { bullet: { type: "number", color: C.OI_GREEN }, fontSize: 22, color: C.DARK_TEXT, breakLine: true, paraSpaceAfter: 14 } },
    { text: "Validate alternative estimators against quasi-experimental designs where variation in WGU enrollment is not driven by individual selection", options: { bullet: { type: "number", color: C.OI_GREEN }, fontSize: 22, color: C.DARK_TEXT, breakLine: true, paraSpaceAfter: 4 } },
    { text: "Rollout of WGU programs in certain states/firms", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 18, color: C.DARK_TEXT, breakLine: true, paraSpaceAfter: 4 } },
    { text: "Eligibility cutoffs, targeting, or ads to certain subgroups/areas", options: { bullet: { color: C.OI_GREEN }, indentLevel: 1, fontSize: 18, color: C.DARK_TEXT, breakLine: true } },
  ], {
    textBox: { x: 1.15, y: 1.46, w: 11.62, h: 4.75 },
  });

  // ── SAVE ────────────────────────────────────────────────────────────────
  await deck.save();
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
