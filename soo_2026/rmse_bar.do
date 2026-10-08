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

program define scatter_calc_wtd, rclass
    preserve

    tempvar bias avg_bias dev varcomp fullvar mse rmse

    gen `bias' = `1' - te_rct

    sum `bias' [fw = teobs]
    gen `avg_bias' = r(mean)

    gen `dev' = `bias' - `avg_bias'
    gen `varcomp' = `dev'^2

    sum `varcomp' [fw = teobs]
    gen `fullvar' = r(mean)

    gen `mse' = `avg_bias'^2 + `fullvar'
    gen `rmse' = sqrt(`mse')

    sum `rmse'
    local RMSE = round(r(mean), 0.01)

    reg te_rct `1' [fw = teobs]
    local r2_1 = round(e(r2), 0.01)
    local b_1 = round(_b[`1'], 0.01)

    reg te_rct `1' [fw = teobs] if site != "SV" & site != "SF"
    local r2_2 = round(e(r2), 0.01)
    local b_2 = round(_b[`1'], 0.01)

    restore

    return scalar RMSE = `RMSE'
    return scalar r2_1 = `r2_1'
    return scalar b_1 = `b_1'
    return scalar r2_2 = `r2_2'
    return scalar b_2 = `b_2'
end

**# Calculate SE for RCT control
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

**# 1. Avg SE of RCT control group means
gen var_control = (se_rct/sqrt(2))^2

sum var_control
local unwtd_avg_var = r(mean)
local unwtd_noise = sqrt(`unwtd_avg_var')
di "Unweighted noise = `unwtd_noise'"

sum var_control [fw=teobs]
local wtd_avg_var = r(mean)
local wtd_noise = sqrt(`wtd_avg_var')
di "Weighted noise =`wtd_noise'"


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
local RMSE_aipw_unwt = `r(RMSE)'
di "`RMSE_aipw_unwt'"

scatter_calc_wtd "te_aipw_worace"
local RMSE_aipw_wtd = `r(RMSE)'
di "`RMSE_aipw_wtd'"

**# RMSE Barplot #3
* =================================================================

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("rmse_match") firstrow clear
gen control_group = "matching"
tempfile rmse
save `rmse', replace


import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("rmse_cps") firstrow clear
append using `rmse'
save `rmse', replace

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("rmse_5pct") firstrow clear
append using `rmse'
save `rmse', replace

* XX change to AIPW
import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("rmse_5pct") firstrow clear
replace control_group = "AIPW"
replace rmse = `RMSE_aipw_unwt'
append using `rmse'
save `rmse', replace

use `rmse', clear

gen adj_rmse = sqrt(rmse^2 - `unwtd_noise'^2)
drop program site
drop if control_group == "matching"

gen description = ""
replace description = "Lalonde CPS-sized sample" if control_group == "CPS"
replace description = "Lalonde 5% sample"        if control_group == "5_pct_subsample"
replace description = "Coarsened Exact Matching" if control_group == "matching"
replace description = "Digital Twins"                      if control_group == "AIPW"
lab var rmse "Root Mean Squared Error Estimate"

gen description2 = .
replace description2 = 3 if description == "Lalonde 5% sample"
replace description2 = 2 if description == "Lalonde CPS-sized sample"
//replace description2 = 3 if description == "Coarsened Exact Matching"
replace description2 = 1 if description == "Digital Twins"

gen order_var = 1
replace order_var = 2 if description == "Lalonde CPS-sized sample"
replace order_var = 3 if description == "Lalonde 5% sample"
//replace order_var = 2 if description == "Coarsened Exact Matching"

* Vertical position: negate so the smallest order_var sits at the TOP
gen ypos = -order_var
gen zero = 0

* Split rmse into one variable per group so each bar can get its own color
separate rmse, by(description2)  
separate adj_rmse, by(description2)  

* Round RMSE to nearest $1K for the on-bar labels
gen rmse_k = "$" + string(round(rmse, 1), "%9.0fc") 
gen rmse_k_bold = "{bf:" + rmse_k + "}"

gen adj_rmse_k = "$" + string(round(adj_rmse, 1), "%9.0fc") 
gen adj_rmse_k_bold = "{bf:" + adj_rmse_k + "}"

* Unified x-range, padded so the rightmost data label isn't clipped
sum rmse
local xmax_bar = ceil(`r(max)' / 500) * 500 + 500

* --- x-axis tick labels ($500, $1K, $1.5K, ...) ---
local dollar = char(36)
local labs ""

forvalues val = 1000(1000)`xmax_bar' {
    if `val' < 1000 {
        local labs `"`labs' `val' "`dollar'`val'""'
    }
    else {
        local val_k = `val'/1000
        if mod(`val', 1000) == 0 {
            local val_disp = string(`val_k', "%10.0f")
        }
        else {
            local val_disp = string(`val_k', "%10.1f")
        }

        local val_disp = strtrim("`val_disp'")
        local labs `"`labs' `val' "`dollar'`val_disp'K""'
    }
}

# delimit ;
twoway
(rbar zero rmse1 ypos, horizontal barwidth(0.5) color("scheme p2"))
(rbar zero rmse2 ypos, horizontal barwidth(0.5) color("scheme p2"))
(rbar zero rmse3 ypos, horizontal barwidth(0.5) color("scheme p1"))
(scatter ypos rmse,
    msymbol(none) mlabel(rmse_k_bold) mlabposition(3)
    mlabcolor("black") mlabsize(medsmall) mlabstyle(bold))
,
legend(off)
ylabel(
    -0.75 `"Synthetic Digital Twins (170M controls)"'
    -1.75 `"Parametric Reweighting (9M obs., 5% sample)"'
    -2.75 `"Parametric Reweighting (16K obs., CPS-sized)"'
    , angle(0) nogrid noticks labcolor(black)
)
ytitle("")
xlabel(0 "0" `labs', nogrid labcolor(black) tlcolor(gs10) tlwidth(thin))
xtitle("Root Mean-Squared Error of Observational Estimates", color(black))
xscale(range(0 `xmax_bar') noextend lcolor(gs10) lwidth(thin))
yscale(range(-3.6 -0.4) lcolor(gs10) lwidth(thin))
xsize(10)
plotregion(margin(l=0 r+12))
;
# delimit cr

graph export "${figures}/RMSE.svg", replace

* Unified x-range, padded so the rightmost data label isn't clipped
sum adj_rmse
local xmax_bar = ceil(`r(max)' / 500) * 500 + 500

* --- x-axis tick labels ($500, $1K, $1.5K, ...) ---
local dollar = char(36)
local labs ""

forvalues val = 1000(1000)`xmax_bar' {
    if `val' < 1000 {
        local labs `"`labs' `val' "`dollar'`val'""'
    }
    else {
        local val_k = `val'/1000
        if mod(`val', 1000) == 0 {
            local val_disp = string(`val_k', "%10.0f")
        }
        else {
            local val_disp = string(`val_k', "%10.1f")
        }

        local val_disp = strtrim("`val_disp'")
        local labs `"`labs' `val' "`dollar'`val_disp'K""'
    }
}

gen adj_rmse1_step0 = .
gen adj_rmse2_step0 = .
gen adj_rmse3_step0 = .
/*
gen adj_rmse1_step1 = .
gen adj_rmse2_step1 = .
gen adj_rmse3_step1 = adj_rmse3

gen adj_rmse1_step2 = .
gen adj_rmse2_step2 = adj_rmse2
gen adj_rmse3_step2 = adj_rmse3

gen adj_rmse1_step3 = adj_rmse1
gen adj_rmse2_step3 = adj_rmse2
gen adj_rmse3_step3 = adj_rmse3
*/

gen adj_rmse1_step1 = adj_rmse1
gen adj_rmse2_step1 = .
gen adj_rmse3_step1 = .

gen adj_rmse1_step2 = adj_rmse1
gen adj_rmse2_step2 = adj_rmse2
gen adj_rmse3_step2 = .

gen adj_rmse1_step3 = adj_rmse1
gen adj_rmse2_step3 = adj_rmse2
gen adj_rmse3_step3 = adj_rmse3


gen adj_rmse_step0 = .

forvalues step = 1/3 {

    gen adj_rmse_step`step' = adj_rmse if ///
        !missing(adj_rmse1_step`step') | ///
        !missing(adj_rmse2_step`step') | ///
        !missing(adj_rmse3_step`step')

}



forvalues step = 0/3 {

    # delimit ;
    twoway
    (rbar zero adj_rmse3_step`step' ypos, horizontal barwidth(0.5) color("scheme p2"))
    (rbar zero adj_rmse2_step`step' ypos, horizontal barwidth(0.5) color("scheme p2"))
    (rbar zero adj_rmse1_step`step' ypos, horizontal barwidth(0.5) color("scheme p1"))
    (scatter ypos  adj_rmse_step`step', 
        msymbol(none) mlabel(adj_rmse_k_bold) mlabposition(3)
        mlabcolor("black") mlabsize(medsmall) mlabstyle(bold))
    ,
    legend(off)
    ylabel(
	
		-0.75  `"Synthetic Digital Twins (270M controls)"'
        -1.75 `"Parametric Reweighting (16K obs., CPS-sized)"'
        -2.75 `"Parametric Reweighting (9M obs.)"'
        , angle(0) nogrid noticks labcolor(black)
    )
    ytitle("")
    xlabel(0 "0" `labs', nogrid labcolor(black) tlcolor(gs10) tlwidth(thin))
    xtitle("Noise-Adjusted Root Mean Squared Error" "of Observational Estimates", color(black) margin(t+1))
    xscale(range(0 `xmax_bar') noextend lcolor(gs10) lwidth(thin))
    yscale(range(-3.6 -0.4) lcolor(gs10) lwidth(thin))
    xsize(10)
    plotregion(margin(l=0))
    name(rmse_step`step', replace)
    ;
    # delimit cr

    graph export "${figures}/rmse_noise_adj_`step'.svg", replace 
}
