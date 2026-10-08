*! decks/_template/figures.do
*!
*! Canonical OI event-study figures. Copy into your deck's code directory and
*! adapt it; do not import it.
*!
*! The twoway options are written out in full on purpose. They were NOT turned
*! into shared ado programs: measuring the real duplication showed each block
*! appears once or twice per deck and is already collapsed into a local, so an
*! ado would save about five lines while adding an interface and the c_local
*! nested-quote hazard that bites on strings like ylabel(-5000 "-$5K" ...).
*! What caused the historical drift was deck code being untracked and
*! copy-pasted between folders. That is fixed by version control, not by
*! abstraction.
*!
*! What IS shared (all in workforce-training/ado):
*!     oi_setup.do          adopath, scheme, SVG fontface, path globals
*!     oi_use_disclosure    tidy disclosure sheet -> wide panel, schema inferred
*!     generate_clean_axis  clean tick increments and padded ranges
*!     dollar_labs          $K axis tick-label specs
*!     dollar_str           $K per-observation label strings
*!     oi_export            graph export fan-out
*!     oi_fact / _save / _clear   slide numbers -> facts.json

clear all

* ---- setup. Two machine-specific globals live in your profile.do:
*          global workforce_github "C:/path/to/workforce-training"
*          global dropbox          "C:/path/to/Dropbox/Research files"
do "${workforce_github}/ado/oi_setup.do"

* Paths are relative to the deck folder, which is where oi-deck runs Stata
* from. Keeping them relative is what lets the whole deck live in one folder.
global figures "figures"
global data    "data"

* While iterating on a shared ado, -discard- forces Stata to reload it.
* Without this you will edit an .ado, rerun, and keep getting the old
* behaviour for about an hour before working out why.
discard

oi_facts_clear


**# Data
* =================================================================

* EDIT THESE TWO. The reader infers keys/series/index from the sheet and
* prints what it found -- read that output on the first run.
local release "sep2026/CHANGE_ME.xlsx"
local sheet   "CHANGE_ME"

oi_use_disclosure using "${disclosure}/`release'", sheet(`sheet')

* Deck-specific fixups go here, never in the shared reader. For example:
*     replace degree = "AAS" if degree == "ALL"
*     replace panel  = ustrregexra(lower(degree + "_" + sector), "[^a-z0-9]+", "_")


**# Shared options
* =================================================================
* ONE global y range across every panel, computed BEFORE any plotting, so
* consecutive slides do not shift. This is the Type 2 anti-jitter rule.

egen max_mean = rowmax(value_*)
generate_clean_axis max_mean year_relative, ystep(10000) yzero

local ymin     = r(ymin)
local ymax     = r(ymax)
local ystep    = r(ystep)
local base_val = r(ymin_range)
local vtop     = 0.94 * `ymax'
local ttop     = 0.97 * `ymax'

dollar_labs ylabs `ymin' `ymax' `ystep'

local common_opts xlabel(-5(1)5, labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
                  xscale(lcolor(gs10) lwidth(vthin))                          ///
                  xtitle("Year Relative to Enrollment", color(black) margin(t+1)) ///
                  ytitle("Mean W-2 Wage Earnings", color(black) margin(r+1))   ///
                  plotregion(margin(b=0 r+2)) xsize(17) ysize(9)

local plotopts  `common_opts'                                                 ///
                ylabel(`ylabs', nogrid labcolor(black)                        ///
                       tlcolor(gs10) tlwidth(vthin))                          ///
                yscale(lcolor(gs10) lwidth(vthin) range(`base_val' `ymax'))

* Base/cols split so a 4-series figure can ask for 2 columns without
* respecifying the rest.
local legend_base position(11) ring(0) color(black) size(22pt) ///
                  bmargin(t-3) rowgap(small)
local legend_opts `legend_base' cols(1)


**# One panel per group
* =================================================================

levelsof panel, local(panels)

foreach pn of local panels {

    * Event markers. The labels are per-deck vocabulary -- entry/completion,
    * enrollment/graduation, entry/exit -- so they live here rather than being
    * baked into a shared program.
    local vlines (pci `base_val' 0 `vtop' 0,                                  ///
                      lcolor(black) lpattern(shortdash) lwidth(vthin))        ///
                 (pci `base_val' 2 `vtop' 2,                                  ///
                      lcolor(black) lpattern(shortdash) lwidth(vthin))

    * If your two markers sit only one x-unit apart (a one-year program), the
    * centred labels collide -- add placement(w)/justification(right) to the
    * first and placement(e)/justification(left) to the second.
    local vtext  text(`ttop' 0 "Enrollment", color(black) size(small))        ///
                 text(`ttop' 2 "Graduation", color(black) size(small))

    preserve
        keep if panel == "`pn'"
        sort year_relative

        * The first two plots match NO observations. They exist only to own
        * the legend keys, which keeps the legend identical across build steps
        * so the plot region never shifts (Type 1 anti-jitter).
        *
        * Use -connected- rather than -scatter- for any series distinguished
        * by a line pattern: a marker-only key cannot show lpattern().
        # delimit ;
        twoway
        (scatter value_treated year_relative if year_relative == .,
            color("scheme p1") msize(large))
        (scatter value_control_aipw year_relative if year_relative == .,
            color("scheme p2") msize(large))
        `vlines'
        (connected value_treated year_relative, color("scheme p1"))
        (connected value_control_aipw year_relative, color("scheme p2"))
        ,
        `plotopts' `vtext'
        legend(order(1 "Program Graduates" 2 "Digital Twins") `legend_opts')
        name("`pn'", replace)
        ;
        # delimit cr

        oi_export "${figures}/`pn'_event_study"

        * Record every number a slide will quote. outline.md reads these as
        * {{te_yr5.<panel>}}, so no number is typed into the deck by hand.
        qui summarize value_treated      if year_relative == 5
        local tr = r(mean)
        qui summarize value_control_aipw if year_relative == 5
        local tw = r(mean)
        oi_fact te_yr5.`pn' = `tr' - `tw', fmt(k)
    restore

    graph drop _all
}

oi_facts_save using "${figures}/facts.json", replace
