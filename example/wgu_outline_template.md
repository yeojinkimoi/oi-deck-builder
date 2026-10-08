# Deck Outline Template

Use this template to define your slide deck. Give this outline + your figure directory path to Claude, and it will generate a `my_deck.js` script using `oi_deck_builder`.

---

## Deck Settings

- **Title**: The Impacts of WGU Programs on Students' Earnings
- **Subtitle**: Preliminary Estimates Using Matched Comparison Groups
- **Date**: February 2026
- **Notice**: PRELIMINARY DATA -- DO NOT CITE
- **Figure directory**: ./figures
- **Output**: ./WGU_President.pptx

---

## Slides

### Slide 1: TITLE SLIDE
(See Deck Settings above)

### Slide 2 — TEXT: Data Sources
- Data: WGU enrollment records linked to Census+tax data covering full U.S. population (including tax filers and non-filers)
  - 99% of WGU enrollees successfully linked
  - Includes WGU graduates, withdrawers, and certificates

- Analysis sample: 262,000 WGU enrollees from 2013-18
  - Earnings observed from 2008-2023 in tax records

- Primary outcome: earnings reported on W-2 forms, measured in real 2021 dollars
  - Includes those not working as 0s
  - Excludes self-employment income (can be incorporated later)

### Slide 3 — TEXT: Identifying Matched Controls
- For each WGU enrollee, identify matched controls based on:
  - Pre-enrollment earnings trajectory: W-2 earnings in the three years prior to enrollment (small)
  - Age, sex, and county of residence in year of enrollment (small)
  
- Then compare average earnings of WGU enrollees to those of matched controls pre vs. post enrollment
  - Average WGU enrollee has 350 matched controls (small)
  - 11% of matched control group enrolls in other non-WGU degree programs at the same time (small)

### Slide 4 — TABLE: WGU Program Categories
- **Subtitle**: Programs Grouped into Eight Degree-Sectors
- **Columns**: Degree Level, Program, Example Program, Number of Students, Graduation Rate
- **Rows**:
  - Bachelor | Education | BA, Interdisciplinary Studies (K-8) | 31,000 | 53%
  - Bachelor | Health | BS, Nursing | 54,000 | 75%
  - Bachelor | Business | BS, Business Management | 65,000 | 46%
  - Bachelor | Technology | BS, Information Technology | 29,000 | 46%
  - Master | Education | MS, Curriculum and Instruction | 22,000 | 81%
  - Master | Health | MS, Nursing Education (BSN-MSN) | 25,000 | 67%
  - Master | Business | MBA | 32,000 | 67%
  - Master | Technology | MS, Cybersecurity and Information Assurance | 5,000 | 59%
- **Footnote**: Programs aggregated from individual WGU degree programs into 8 groups by degree level and field of study.

### Slide 5 — 1-FIGURE: Impact of Bachelor of Education on Earnings
- **Subtitle**: WGU Enrollees who Graduate 2 Years After Entry vs. Matched Controls
- **Figure**: slide1_BaEd_bin2_grad_treat_only

### Slide 6 — 1-FIGURE: Impact of Bachelor of Education on Earnings
- **Subtitle**: WGU Enrollees who Graduate 2 Years After Entry vs. Matched Controls
- **Figure**: slide1_BaEd_bin2_grad_both

### Slide 7 — 1-FIGURE: Impact of Bachelor of Education on Earnings
- **Subtitle**: WGU Enrollees who Graduate 2 Years After Entry vs. Matched Controls
- **Figure**: slide1_BaEd_bin2_grad_delta

### Slide 8 — 2-FIGURE: Impact of Bachelor of Education on Earnings
- **Subtitle**: WGU Enrollees who Graduates or Withdraw 2 Years After Entry
- **Left**: slide2_BaEd_bin2_grad_delta | Graduates
- **Right**: slide2_BaEd_bin2_wd_delta | Withdrawers

### Slide 9 — 4-FIGURE: Impact of Bachelor of Education on Earnings
- **Subtitle**: WGU Enrollees who Graduates or Withdraw 3 or 4 Years After Entry
- **Top left**: slide3_BaEd_grad_bin3_delta | Graduates
- **Top right**: slide3_BaEd_wd_bin3_delta | Withdrawers
- **Bottom left**: slide3_BaEd_grad_bin4_delta
- **Bottom right**: slide3_BaEd_wd_bin4_delta

### Slide 10 — 2-FIGURE: Impact of Bachelor of Education on Earnings
- **Subtitle**: Baseline Model vs. Comparison to People who Enroll in Other Higher Education Institutions
- **Left**: slide4_BaEd_bin3_baseline_delta | Comparison to All Matched Individuals
- **Right**: slide4_BaEd_bin3_1098t_delta | Comparison to Other Higher Education Enrollees

### Slide 11 — 2-FIGURE: Impact of Bachelor of Business on Earnings
- **Subtitle**: WGU Enrollees who Graduate or Withdraw 3 Years After Entry
- **Left**: slide5_BaBu_bin3_grad_delta | Graduates
- **Right**: slide5_BaBu_bin3_wd_delta | Withdrawers

### Slide 12 — 3-FIGURE: Impact of Bachelor of Technology on Earnings
- **Subtitle**: WGU Enrollees who Graduate 3 Years After Entry, Withdraw w/Certificate, or Withdraw w/o Certificate
- **Top center**: slide6_BaTe_grad_delta | Graduates
- **Bottom left**: slide6_BaTe_wd_somecert_delta | Withdrawers w/ Certificate
- **Bottom right**: slide6_BaTe_wd_nocert_delta | Withdrawers w/o Certificate

### Slide 13 — 2-FIGURE: Impact of Bachelor of Health on Earnings
- **Subtitle**: WGU Enrollees who Graduate or Withdraw 2 Years After Entry
- **Left**: slide7_BaHe_bin2_grad_delta | Graduates
- **Right**: slide7_BaHe_bin2_wd_delta | Withdrawers

### Slide 14 — 2-FIGURE: Impact of Master of Education on Earnings
- **Subtitle**: WGU Enrollees who Graduate or Withdraw 2 Years After Entry
- **Left**: slide8_MaEd_bin2_grad_delta | Graduates
- **Right**: slide8_MaEd_bin2_wd_delta | Withdrawers

### Slide 15 — 2-FIGURE: Impact of Master of Business on Earnings
- **Subtitle**: WGU Enrollees who Graduate or Withdraw 2 Years After Entry
- **Left**: slide9_MaBu_bin2_grad_delta | Graduates
- **Right**: slide9_MaBu_bin2_wd_delta | Withdrawers

### Slide 16 — 2-FIGURE: Impact of Master of Technology on Earnings
- **Subtitle**: WGU Enrollees who Graduate 2 Years After Entry or Withdraw
- **Left**: slide10_MaTe_grad_delta | Graduates
- **Right**: slide10_MaTe_wd_nocert_delta | Withdrawers

### Slide 17 — 2-FIGURE: Impact of Master of Health on Earnings
- **Subtitle**: WGU Enrollees who Graduate or Withdraw 2 Years After Entry
- **Left**: slide11_MaHe_bin2_grad_delta | Graduates
- **Right**: slide11_MaHe_bin2_wd_delta | Withdrawers

### Slide 18 — 1-FIGURE: Impact of WGU Programs on Earnings
- **Subtitle**: Treatment Effects on W-2 Wages 5 Years After Enrollment
- **Figure**: slide12a_barplot_grads

### Slide 19 — 1-FIGURE: Impact of WGU Programs on Earnings
- **Subtitle**: Treatment Effects on W-2 Wages 5 Years After Enrollment
- **Figure**: slide12b_barplot_grads_wd

### Slide 20 — 2-FIGURE: Placebo Test: Matching on Wages 3-5 Years Prior to Enrollment
- **Subtitle**: Bachelor of Education & Bachelor of Health vs. Matched Controls
- **Left**: slide_BaEd_bin3_26_delta | Bachelor of Education
- **Right**: slide_BaHe_bin2_26_delta | Bachelor of Health

### Slide 21 — 1-FIGURE: Impact of WGU Programs on Earnings
- **Subtitle**: Treatment Effects on W-2 Wages 5 Years After Enrollment
- **Figure**: slide12c_barplot_all

### Slide 22 — 1-FIGURE: Withdrawal Effects vs. Placebo Tests
- **Subtitle**: Treatment Effects on 5-Year Wages by Program
- **Figure**: slide14_scatter_wd_vs_placebo

### Slide 23 — TEXT: Next Steps and Discussion
1. Find matched control vector that eliminates selection problem in certain programs (e.g., healthcare)

2. Validate alternative estimators against quasi-experimental designs where variation in WGU enrollment is not driven by individual selection
  - Rollout of WGU programs in certain states/firms (small)
  - Eligibility cutoffs, targeting, or ads to certain subgroups/areas (small)

