clear all 
set scheme opp_insights_contrast

global disclosure "${dropbox}/outside/workforce_training/Disclosures"
global curr_disclosure "${disclosure}/june2026"
global figures "${dropbox}/outside/workforce_training/Slides/SOO-2026/figures"
global data "${dropbox}/outside/workforce_training/Data"

**# Bring in data
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

**# 2. Avg SE of RCT
gen var_rct = (se_rct)^2

sum var_rct
local unwtd_avg_var = r(mean)
local unwtd_avg_rct_se = sqrt(`unwtd_avg_var')
di "Avg RCT SE = `unwtd_avg_rct_se'"

/*
sum se_rct
local avg_se_rct = r(mean)
di "Avg RCT SE = `avg_se_rct'"
*/
