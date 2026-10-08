# TSTC October 2026

Numbers in `{{...}}` are read from `facts*.json` in the figure directory,
written by the Stata that drew the figures. Never type a number here.

## Deck Settings

- **Title**: The Impacts of TSTC Programs on Earnings
- **Subtitle**: Preliminary Estimates Using Digital Twins
- **Date**: October 2026
- **Notice**: PRELIMINARY DATA -- DO NOT CITE
- **Figure directory**: ./figures
- **Output**: ./TSTC_deck.pptx

## Slides

### Slide 1 — TITLE SLIDE: The Impacts of TSTC Programs on Earnings

### Slide 2 — TABLE: TSTC Programs
- **Subtitle**: Largest Credit Division Within Each School
- **Columns**: School, Division, Example Program
- **Rows**:
  - Business, Hospitality, and Global Trade | Management Careers | Human Resources Assistant
  - Health Sciences | Nursing | Associate Degree Nursing
  - Law and Public Service | Criminal Justice | Basic Criminal Justice Studies
  - Engineering, Technology, Math & Science | Computer Information Systems | Technology Support
  - Manufacturing and Industrial Technology | Automotive Technology | Automotive Repair
  - Creative Arts, Entertainment & Design | Digital Art and Design | Digital Media
- **Notes**: Program groups are the largest credit-program division within each school.

### Slide 3 — 1-FIGURE: Impact of TSTC on Earnings: Construction Certificate
- **Subtitle**: TSTC Enrollees who Graduate vs. Digital Twins -- {{te_yr5.cert_construction_graduate}} Increase
- **Figure**: cert_construction_graduate_event_study
- **Notes**: Strongest result in the deck. ROI {{roi.construction_cert}}x, payback {{payback.construction_cert}} years.

### Slide 4 — 1-FIGURE: Impact of TSTC on Earnings: Engineering Associate's Degree
- **Subtitle**: TSTC Enrollees who Graduate vs. Digital Twins -- {{te_yr5.aas_engineering_graduate}} Increase
- **Figure**: aas_engineering_graduate_event_study
- **Notes**: ROI {{roi.engineering_aas}}x on a cost of {{cost.engineering_aas}}.

### Slide 5 — 1-FIGURE: Impact of TSTC on Earnings: Engineering Associate's Degree
- **Subtitle**: TSTC Enrollees who Leave vs. Digital Twins -- {{te_yr5.aas_engineering_leaver}} Increase
- **Figure**: aas_engineering_leaver_event_study
- **Notes**: Leavers gain far less than graduates. The second dashed line marks expected completion, not an observed exit date.

### Slide 6 — 1-FIGURE: Impact of TSTC on Earnings: Automotive Associate's Degree
- **Subtitle**: TSTC Enrollees who Graduate vs. Digital Twins -- {{te_yr5.aas_automotive_graduate}} Increase
- **Figure**: aas_automotive_graduate_event_study
- **Notes**: CIP 47 is Mechanic and Repair Technologies and includes aviation and diesel, so the cost shown is above the automotive programs themselves.

### Slide 7 — 1-FIGURE: Impact of TSTC on Earnings: Automotive Certificate
- **Subtitle**: TSTC Enrollees who Graduate vs. Digital Twins -- {{te_yr5.cert_automotive_graduate}} Increase
- **Figure**: cert_automotive_graduate_event_study
- **Notes**: Certificates complete in 12 months, so the second dashed line sits at year 1.

### Slide 8 — 1-FIGURE: Impact of TSTC on Earnings: IT Associate's Degree
- **Subtitle**: TSTC Enrollees who Graduate vs. Digital Twins -- {{te_yr5.aas_it_graduate}} Increase
- **Figure**: aas_it_graduate_event_study
- **Notes**: Weakest result. {{te_yr5.aas_it_graduate}} does not break even -- ROI {{roi.it_aas}}x, payback {{payback.it_aas}} years.

### Slide 9 — TEXT: Appendix
- Estimates use the September 2026 disclosure, statistic `mean`.
- The digital twins counterfactual is released for years 0-5 only; the pre-period is filled with the treated series plus uniform jitter.
  - Flagged in the data as `imputed_control_aipw` (small)
- ROI assumes a {{assumption.completion_rate.value}} graduation rate over {{assumption.horizon.value}} years.

### Slide 10 — 1-FIGURE: Impact of TSTC on Earnings: Engineering Associate's Degree
- **Subtitle**: TSTC Enrollees who Graduate vs. Leave vs. Digital Twins
- **Figure**: aas_engineering_combined_event_study
- **Notes**: Graduates and leavers on one axis. Replaces the hand-built slide whose subtitle said "Enrollees who Leave" under a chart showing both.
