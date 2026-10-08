clear all 
set scheme opp_insights_contrast

global disclosure "${dropbox}/outside/workforce_training/Disclosures"
global curr_disclosure "${disclosure}/june2026"
global figures "${dropbox}/outside/workforce_training/Slides/SOO-2026/figures"
global data "${dropbox}/outside/workforce_training/Data"

graph set svg fontface "Lucida Sans"
**# Globals
* =================================================================
program define scatter_calc_unwt, rclass
    preserve

    tempvar bias avg_bias dev varcomp fullvar mse rmse

    gen `bias' = `1' - te_rct

    sum `bias' 
    gen `avg_bias' = r(mean)

    gen `dev' = `bias' - `avg_bias'
    gen `varcomp' = `dev'^2

    sum `varcomp'
    gen `fullvar' = r(mean)

    gen `mse' = `avg_bias'^2 + `fullvar'
    gen `rmse' = sqrt(`mse')

    sum `rmse'
    local RMSE = round(r(mean), 0.01)

    reg te_rct `1' 
    local r2_1 = round(e(r2), 0.01)
    local b_1 = round(_b[`1'], 0.01)

    reg te_rct `1' if site != "SV" & site != "SF"
    local r2_2 = round(e(r2), 0.01)
    local b_2 = round(_b[`1'], 0.01)

    restore

    return scalar RMSE = `RMSE'
    return scalar r2_1 = `r2_1'
    return scalar b_1 = `b_1'
    return scalar r2_2 = `r2_2'
    return scalar b_2 = `b_2'
end

**# RMSE for Matching vs AIPW Calc #0
* =================================================================
import delimited "${data}/derived/general/wf_rct_samplesize.csv", clear

tempfile n
save `n', replace 

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("te_rct") firstrow clear
drop if program == "YU_PACE" & site == "all"

tempfile terct
save `terct', replace

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("te_aipw") firstrow clear
drop if program == "YU_PACE" & site == "all"

merge 1:1 program site using `n', nogen
merge 1:1 program site using `terct', nogen
rename n teobs

scatter_calc_unwt "te_aipw_worace"
local RMSE_aipw = `r(RMSE)'
di "`RMSE_aipw'"

**# SCATTERPLOT #1
* =================================================================

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("te_rct") firstrow clear

tempfile terct
save `terct', replace

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("te_aipw") firstrow clear

tempfile teaipw
save `teaipw', replace

use `terct', clear
merge 1:1 program site using `teaipw', nogen 
drop if (program == "YU_PACE" & site == "all")

gen ci_u_rct = te_rct + 1.96*se_rct
gen ci_l_rct = te_rct - 1.96*se_rct

gen y_45 = te_aipw_worace
gen y_low = min(te_rct, y_45)
gen y_high = max(te_rct, y_45)
gen prg_highlight = 0
replace prg_highlight = 1 if program == "YU_PACE" | site == "PS" | site == "LAP"

gen seis_ps = 0
replace seis_ps = 1 if program == "SEIS" & site == "PS"

local labs ""
forvalues val = -5000(5000)25000 {
	
if `val' <= -1000 {
	local val_k = -1 * `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local labs `labs' `val' "-$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local labs `labs' `val' "-$`val_disp'K" 
	}	
}

if `val' > -1000 & `val' < 0 {
	local `val_disp' = -1 * `val'
	local labs `labs' `val' "-$`val_disp'"
}
if `val' < 1000 & `val' >= 0{
	local labs `labs' `val' "$`val'"
}
if `val' >= 1000 {
	local val_k = `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local labs `labs' `val' "$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local labs `labs' `val' "$`val_disp'K" 
	}	
}
}

local common_opts 	legend(off) ///
					yscale(range(-5000 25000) lcolor(gs10) lwidth(vthin)) ///
					ylabel(`labs', nogrid labcolor(black) tlcolor(gs10) tlwidth(vthin)) /// 
					xscale(range(-5000 25000) lcolor(gs10) lwidth(vthin)) /// 
					xlabel(`labs', labcolor(black) tlcolor(gs10) tlwidth(vthin)) /// 
					xtitle("Digital twins estimate of effect on" "mean earnings in years 2-5", size(mediumsmall) color(black) margin(t+3)) /// 
					ytitle("RCT estimate of effect on" "mean earnings in years 2-5", size(mediumsmall) color(black) margin(r+1)) ///
					plotregion(margin(r+5))

# delimit;

twoway 
(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
`common_opts'
;
# delimit cr

graph export "${figures}/rct_dml_wages2_5_scatter_blank.svg", replace

# delimit;

twoway 
(scatter te_rct te_aipw_worace , color("scheme p1")  msize(small)) 
(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
`common_opts'
;
# delimit cr

graph export "${figures}/rct_dml_wages2_5_scatter_fmted.svg", replace


# delimit;

twoway 
(rspike y_low y_high te_aipw_worace, lcolor("scheme p2"))
(scatter te_rct te_aipw_worace, color("scheme p1")  msize(small)) 

(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
`common_opts'
;
# delimit cr
graph export "${figures}/rct_dml_wages2_5_scatter_lined.svg", replace

# delimit;

twoway 

(scatter te_rct te_aipw_worace if prg_highlight == 0, color("scheme p1")  msize(small)) 
(scatter te_rct te_aipw_worace if prg_highlight == 1, color("scheme p2")  msize(small)) 

(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
`common_opts'
;
# delimit cr
graph export "${figures}/rct_dml_wages2_5_scatter_highlighted.svg", replace

# delimit;

twoway 

(scatter te_rct te_aipw_worace if seis_ps == 1, color("scheme p2")  msize(small)) 

(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
`common_opts'
;
# delimit cr
graph export "${figures}/rct_dml_wages2_5_scatter_highlighted_seis_ps0.svg", replace


# delimit;

twoway 

(scatter te_rct te_aipw_worace if seis_ps == 1, color("scheme p2")  msize(small)) 
(scatter te_rct te_aipw_worace if seis_ps == 0, color("scheme p1")  msize(small)) 

(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
`common_opts'
;
# delimit cr
graph export "${figures}/rct_dml_wages2_5_scatter_highlighted_seis_ps1.svg", replace


* without ERA

preserve

drop if program == "ERA"
count
scatter_calc_unwt "te_aipw_worace"
di "`r(RMSE)'"
	# delimit;

	twoway 
	(scatter te_rct te_aipw_worace , color("scheme p1")  msize(small)) 
	(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
	`common_opts'
	;
	# delimit cr

	graph export "${figures}/rct_dml_wages2_5_scatter_fmted_woera.svg", replace
	
	
	# delimit;

	twoway 
	(rspike y_low y_high te_aipw_worace, lcolor("scheme p2"))
	(scatter te_rct te_aipw_worace, color("scheme p1")  msize(small)) 

	(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
	`common_opts'
	;
	# delimit cr
	graph export "${figures}/rct_dml_wages2_5_scatter_lined_woera.svg", replace


restore

* without ERA without sted

preserve

drop if program == "ERA"
drop if program == "STED"
count
scatter_calc_unwt "te_aipw_worace"
di "`r(RMSE)'"

	# delimit;

	twoway 
	(scatter te_rct te_aipw_worace , color("scheme p1")  msize(small)) 
	(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
	`common_opts'
	;
	# delimit cr

	graph export "${figures}/rct_dml_wages2_5_scatter_fmted_woera.svg", replace
	
	
	# delimit;

	twoway 
	(rspike y_low y_high te_aipw_worace, lcolor("scheme p2"))
	(scatter te_rct te_aipw_worace, color("scheme p1")  msize(small)) 

	(function y = x, range(-5000 25000) lcolor(black) lw(medium)), 
	`common_opts'
	;
	# delimit cr
	graph export "${figures}/rct_dml_wages2_5_scatter_lined_woera.svg", replace


restore
