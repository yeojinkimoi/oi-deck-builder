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

* Created here, not left to the runner: running this do-file directly (rather
* than through `oi-deck run`) must still work.
cap mkdir "${figures}"
cap mkdir "${data}"

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
* Everything here is independent of the y range. The y range is computed
* PER PANEL inside the loop below -- see the note there.

local common_opts xlabel(-5(1)5, labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
                  xscale(lcolor(gs10) lwidth(vthin))                          ///
                  xtitle("Year Relative to Enrollment", color(black) margin(t+1)) ///
                  ytitle("Mean W-2 Wage Earnings", color(black) margin(r+1))   ///
                  plotregion(margin(b=0 r+2)) xsize(17) ysize(9)

* Base/cols split so a 4-series figure can ask for 2 columns without
* respecifying the rest.
local legend_base position(11) ring(0) color(black) size(22pt) ///
                  bmargin(t-3) rowgap(small)
local legend_opts `legend_base' cols(1)


**# One y axis per panel, or one shared across all of them?
* =================================================================
* DEFAULT (0) -- each panel gets its OWN y range, floored at zero. A panel
* whose earnings top out at $30K then fills its own axis rather than being
* flattened by whichever panel in the deck happens to be biggest. Because
* generate_clean_axis floors at zero, every panel still shares a baseline,
* so the bar heights stay honest even though the tops differ.
*
* Set to 1 for ONE range shared by every panel. Consecutive slides then never
* shift their axis at all, which is what you want when the audience is being
* asked to compare panels against each other directly. The cost is that a
* panel a third the size of the largest reads as flat. Ask for this
* deliberately; it is not the default.

local shared_yaxis 0

egen max_mean = rowmax(value_*)

if `shared_yaxis' {
    generate_clean_axis max_mean year_relative, ystep(10000)
    local sh_ymin  = r(ymin)
    local sh_ymax  = r(ymax)
    local sh_ystep = r(ystep)
    local sh_base  = r(ymin_range)
}


**# One panel per group
* =================================================================

levelsof panel, local(panels)

foreach pn of local panels {

    preserve
        keep if panel == "`pn'"
        sort year_relative

        * ---- this panel's y range ---------------------------------------
        * Computed from this panel's rows only, unless shared_yaxis asked for
        * the deck-wide one above. No -yzero- needed: inclusion of zero is
        * now generate_clean_axis's default (pass -noyzero- to opt out, for a
        * y that is an effect or a difference rather than a level).
        if `shared_yaxis' {
            local ymin     = `sh_ymin'
            local ymax     = `sh_ymax'
            local ystep    = `sh_ystep'
            local base_val = `sh_base'
        }
        else {
            generate_clean_axis max_mean year_relative, ystep(10000)
            local ymin     = r(ymin)
            local ymax     = r(ymax)
            local ystep    = r(ystep)
            local base_val = r(ymin_range)
        }
        local vtop = 0.94 * `ymax'
        local ttop = 0.97 * `ymax'

        dollar_labs ylabs `ymin' `ymax' `ystep'

        local plotopts `common_opts'                                          ///
                       ylabel(`ylabs', nogrid labcolor(black)                 ///
                              tlcolor(gs10) tlwidth(vthin))                   ///
                       yscale(lcolor(gs10) lwidth(vthin)                      ///
                              range(`base_val' `ymax'))

        * ---- event markers ----------------------------------------------
        * The labels are per-deck vocabulary -- entry/completion,
        * enrollment/graduation, entry/exit -- so they live here rather than
        * being baked into a shared program.
        *
        * Keep them SHORT. On a one-year program the two markers sit a single
        * x-unit apart and long centred labels run together: "Enrollment" and
        * "Completion" read as one phrase, while "Entry" and "Completion" do
        * not. Shortening the word beats nudging the label off its own line.
        local vlines (pci `base_val' 0 `vtop' 0,                              ///
                          lcolor(black) lpattern(shortdash) lwidth(vthin))    ///
                     (pci `base_val' 2 `vtop' 2,                              ///
                          lcolor(black) lpattern(shortdash) lwidth(vthin))

        local vtext  text(`ttop' 0 "Enrollment", color(black) size(small))    ///
                     text(`ttop' 2 "Graduation", color(black) size(small))


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
