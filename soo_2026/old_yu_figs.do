/* creates impacts of year up on earnings plot + comparison of two cities */


global disclosure "${dropbox}/outside/workforce_training/Disclosures"
global curr_disclosure "${disclosure}/june2026"

global data_dir "${disclosure}/YearUp_old/"
global plot_dir "${dropbox}/outside/workforce_training/Slides/SOO-2026/figures"

graph set svg fontface "Lucida Sans"

local common_opts xlabel(2008(1)2018, labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
				  xscale(lcolor(gs10) lwidth(vthin)) /// 
				  xtitle("Year", color(black) margin(t+1)) ///
				  ylabel(0 "0" 5000 "$5K" 10000 "$10K" 15000 "$15K", angle(0) nogrid labcolor(black) tlcolor(gs10) tlwidth(vthin)) /// 
				  yscale(range(0 15000) lcolor(gs10) lwidth(vthin)) ///
				  ytitle("Mean W-2 Wage Earnings", color(black) margin(r+1)) ///
				  plotregion(margin(r+1)) xsize(17) ysize(9)

local legend_opts position(11) ring(0) cols(1) size(22pt) bmargin(t-3) rowgap(small)

/* yearup TE over time (diff cohorts) */
import delimited "${data_dir}APPROVED_yu_site_cohort_tes_sept_2023_disclosure.csv", clear

collapse (mean) terminaleffect, by(cohort)


twoway (scatter terminaleffect cohort, color(none)) ///
	   (scatter terminaleffect cohort if cohort == 2014, color("scheme p4")) ///
       (lfit terminaleffect cohort, color(none)), ///
		`common_opts' ///
		legend(order(1 "City A") `legend_opts' color(none)) ///
		name("yearup_over_time_a", replace)
graph export "${plot_dir}/yearup_over_time_a.svg", replace

twoway  (scatter terminaleffect cohort, color(none)) ///
		(scatter terminaleffect cohort, color("scheme p1")) ///
        (lfit terminaleffect cohort, color(black)), ///
		`common_opts' ///
		legend(order(1 "City A") `legend_opts' color(none)) ///
		name("yearup_over_time", replace)
graph export "${plot_dir}/yearup_over_time_b.svg", replace
*graph export "${plot_dir}/yearup_over_time.pdf", replace



/* yearup comparison of two cities over time */

* City A: NCR
* City B: MA
import delimited "${data_dir}APPROVED_yu_site_cohort_tes_sept_2023_disclosure.csv", clear

twoway  (scatter terminaleffect cohort if site == "NCR") ///
		(scatter terminaleffect cohort if site == "MA") ///
        (lfit terminaleffect cohort if site == "NCR", color(black)) ///
		(lfit terminaleffect cohort if site == "MA", lcolor("scheme p2")), ///
		`common_opts' ///
		legend(order(1 "City A" 2 "City B") `legend_opts' color(black)) name("yearup_city_comp", replace)
graph export "${plot_dir}/yearup_city_comparison.svg", replace
*graph export "${plot_dir}/yearup_city_comparison.pdf", replace


/* earnings vs placement comparison */

** first need to run yearup_earnings_placement.R **


** import output of r script **
import delimited "${dropbox}/outside/workforce_training/Slides/soo_2025_figs/yu_earnings_placement.csv", clear

gen success_rescale = 100 * success_outcomes

sum r_val_col
local r_val = string(round(r(mean), 0.01), "%5.2f")

sum se_r_col
local se_r = string(round(r(mean), 0.01), "%5.2f")


twoway  (scatter terminaleffect success_rescale, mcolor(black%45) mlwidth(vthin) mlcolor(none)) ///
		(lfit terminaleffect success_rescale, color("scheme p1")), ///
		xtitle("Percent Placed in Full Time Target Sector Job at Program Completion", color(black) margin(b+1)) ///
		ytitle("1-Year Matching Earnings Impact", color(black) margin(r+1)) ///
		yscale(range(0 20000) lcolor(gs10) lwidth(vthin)) xscale(range(0 80) lcolor(gs10) lwidth(vthin)) ///
		ylabel(0 "0" 5000 "$5K" 10000 "$10K" 15000 "$15K" 20000 "$20K", nogrid labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
		xlabel(20(20)80, labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
		text(-1500 72 "Correlation = `r_val' (`se_r')", size(small) color(black)) ///
		plotregion(margin(r+1)) xsize(17) ysize(9) ///
		legend(off) name("yearup_earnings_placement", replace)
graph export "${plot_dir}/yearup_earnings_vs_placement_rates.svg", replace
*graph export "${plot_dir}/yearup_earnings_vs_placement_rates.pdf", replace

