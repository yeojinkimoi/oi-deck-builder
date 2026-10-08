clear all 

global disclosure "${dropbox}/outside/workforce_training/Disclosures"
global disclosure_april "${disclosure}/wgu_april2026"
global figures "${dropbox}/outside/workforce_training/Slides/SOO-2026/figures"
global results "${dropbox}/outside/workforce_training/Disclosures/wgu_february2026"
graph set svg fontface "Lucida Sans"

**# ========== Dallas Collge Bar plots (CE and CR)


import excel using "${disclosure_april}/wgu_dallascollege_for_release_T13_T26.xlsx", sheet("DallasCollege_te") firstrow clear

keep if division == "all"
sort school academic_level


gen long_school = ""
replace long_school = "Business, Hospitality, Global Trade" if school == "BHGT"
replace long_school = "Creative Arts, Entmt., Design" if school == "CAED"
replace long_school = "Education" if school == "EDU"
replace long_school = "Engineering, Tech., Math, Science" if school == "ETMS"
replace long_school = "Health Sciences" if school == "HS"
replace long_school = "Law & Public Service" if school == "LPS"
replace long_school = "Manufacturing & Industrial Tech" if school == "MIT"



local te_labs ""
forvalues val = -5000(5000)20000 {
	
if `val' <= -1000 {
	local val_k = -1 * `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local te_labs `te_labs' `val' "-$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local te_labs `te_labs' `val' "-$`val_disp'K" 
	}	
}

if `val' > -1000 & `val' < 0 {
	local `val_disp' = -1 * `val'
	local te_labs `te_labs' `val' "-$`val_disp'"
}
if `val' < 1000 & `val' >= 0{
	local te_labs `te_labs' `val' "$`val'"
}
if `val' >= 1000 {
	local val_k = `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local te_labs `te_labs' `val' "$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local te_labs `te_labs' `val' "$`val_disp'K" 
	}	
}
}


levelsof academic_level, local(levs)

foreach level of local levs {
preserve
keep if academic_level == "`level'"

encode long_school, gen(long_school_id)


#delimit ;

twoway
(bar te_matched long_school_id, horizontal barwidth(0.5) color("scheme p1"))
,
xline(0, lcolor(black) lpattern(shortdash) lwidth(vthin))
ylab(1(1)6, valuelabel angle(0) noticks nogrid labcolor(black) labgap(2))
xtitle("Impact on Wages", color(black))
ytitle("") 
xscale(lcolor(gs10) lwidth(vthin))
xlab(`te_labs', labcolor(black) tlcolor(gs10) tlwidth(vthin))
yscale(lcolor(gs10) lwidth(vthin))
plotregion(margin(r+15 l+2))
xsize(10)
name("DC_school_te_`level'", replace)
;
#delimit cr

graph export "${figures}/DallasCollege_school_`level'_te_barplot.svg", replace	
restore
}


**# ========== Dallas Collge Bar plot (HSCR)

import excel using "${disclosure_april}/wgu_dallascollege_for_release_T13_T26.xlsx", sheet("DallasCollege_te") firstrow clear


keep if school == "HS"
keep if academic_level == "CR"

gen y_pos= _n

gen name = school
replace name = division if division != "all"

replace y_pos = 7 if name == "HS"

gen long_name = "   Overall Health Sciences Average"
replace long_name = "Veterinary Tech" if name == "VTECH"
replace long_name = "Radiologic Sciences" if name == "RADS"
replace long_name = "Nursing" if name == "NURS"
replace long_name = "Health Occupational Core" if name == "HOCC"
replace long_name = "Emergency Medical Services" if name == "EMS"

local ylbl
forvalues i=1/6 {
	local ylbl `"`ylbl' `=y_pos[`i']' "`=long_name[`i']'""'
}
di `"`ylbl'"'



local te_labs ""
forvalues val = 10000(10000)30000 {
	
if `val' <= -1000 {
	local val_k = -1 * `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local te_labs `te_labs' `val' "-$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local te_labs `te_labs' `val' "-$`val_disp'K" 
	}	
}

if `val' > -1000 & `val' < 0 {
	local `val_disp' = -1 * `val'
	local te_labs `te_labs' `val' "-$`val_disp'"
}
if `val' < 1000 & `val' >= 0{
	local te_labs `te_labs' `val' "$`val'"
}
if `val' >= 1000 {
	local val_k = `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local te_labs `te_labs' `val' "$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local te_labs `te_labs' `val' "$`val_disp'K" 
	}	
}
}


#delimit ;

twoway
(bar te_matched y_pos, horizontal barwidth(0.5) color("scheme p1"))
,
ylabel(`ylbl', angle(0) noticks nogrid labcolor(black) labgap(2))
xlabel(0 "$0" `te_labs', labcolor(black) tlcolor(gs10) tlwidth(vthin))
xtitle("Impact on Wages", color(black))
ytitle("")
xscale(lcolor(gs10) lwidth(vthin))
yscale(lcolor(gs10) lwidth(vthin))
plotregion(margin(r+15))
xsize(10)
legend(off)
;
#delimit cr
graph export "${figures}/DallasCollege_HSCR_te_barplot.svg", replace	


**# WGU pref vs prepost bar

* Set dimension globally (we're going to use this when we're exporting)
global fig_w 2400
global fig_h 1350  

/* Process data for bar plot of preferred vs pre post estimates */

tempfile model0
import delimited "${results}/WGU_poolSitesFalse_grad_T13_T26.csv", clear
gen te_matched = mean_treat_match - mean_matched
drop v1
keep if model_id == 0
* keep only exit bin 2 + pooled estimates for bachelor of ed
drop if program == "WGU_Bachelor_Education" & !inlist(site, ., 2)
save `model0', replace

import delimited "${results}/WGU_poolSitesTrue_grad_T13_T26.csv", clear
drop se_matched v1
append using `model0'
order program site outcome model_id te_matched


** gen "preferred estimate": baseline model wages5 TE - placebo estimate (model 26 wages0 TE)

* create a pooled and unpooled version using pooled and unpooled baseline model wages5 TEs
tempfile pref_est
preserve
keep if model_id == 0 & mi(site)
keep if outcome == "wages5"
rename te_matched te5base_pooled
drop outcome model_id site mean_treat_match mean_matched
save `pref_est', replace
restore

preserve
keep if model_id == 0 & !mi(site)
keep if outcome == "wages5"
rename te_matched te5base_unpooled
drop outcome model_id site mean_treat_match mean_matched
merge 1:1 program using `pref_est'
drop _merge
save `pref_est', replace
restore

* pull placebo TEs
keep if model_id == 26
rename te_matched te0placebo
drop outcome model_id site mean_treat_match mean_matched
merge 1:1 program using `pref_est'
drop _merge

gen te_pref_pooled = te5base_pooled - te0placebo
gen te_pref_unpooled = te5base_unpooled - te0placebo

drop te5base_pooled te5base_unpooled te0placebo

save `pref_est', replace

** gen simple pre- post- estimates: mean earnings in the year after graduation minus earnings in year -1 
use `model0', replace

tempfile prepost_est

preserve
drop if site==3 & outcome != "wages4"
drop if site ==2 & outcome != "wages3"
rename mean_treat_match earnings_post
drop site outcome model_id mean_matched te_matched
save `prepost_est', replace
restore

keep if outcome == "wagesL1"
rename mean_treat_match earnings_pre
drop site outcome model_id mean_matched te_matched
merge 1:1 program using `prepost_est'
drop _merge

gen te_prepost = earnings_post - earnings_pre
keep te_prepost program
save `prepost_est', replace

merge 1:1 program using `pref_est'
drop _merge

* save wide version
tempfile wide_est
save `wide_est', replace

* stack into long on te spec
tempfile pref_prepost_est

preserve
keep program te_prepost
rename te_prepost te
gen spec = "prepost"
save `pref_prepost_est', replace
restore

preserve
keep program te_pref_pooled
rename te_pref_pooled te
gen spec = "pref_pooled"
append using `pref_prepost_est'
save `pref_prepost_est', replace
restore

preserve
keep program te_pref_unpooled
rename te_pref_unpooled te
gen spec = "pref_unpooled"
append using `pref_prepost_est'
save `pref_prepost_est', replace
restore

use `pref_prepost_est', clear

* Assign x positions for vertical bar chart
gen x_pos = .
replace x_pos = 1 if program == "WGU_Bachelor_Education"
replace x_pos = 2 if program == "WGU_Bachelor_Business" 
replace x_pos = 3 if program == "WGU_Bachelor_Technology"
replace x_pos = 4 if program == "WGU_Bachelor_Health"
replace x_pos = 5 if program == "WGU_Master_Education"
replace x_pos = 6 if program == "WGU_Master_Business" 
replace x_pos = 7 if program == "WGU_Master_Technology"
replace x_pos = 8 if program == "WGU_Master_Health"

replace x_pos = x_pos + 0.2 if spec == "prepost"
replace x_pos = x_pos - 0.2 if spec != "prepost"

* Round TEs to nearest $1K for labels
gen te_k = string(round(te/1000, 1), "%9.0f")
replace te_k = "$" + te_k + "K" if te >= 0
replace te_k = "-$" + string(round(abs(te)/1000, 1), "%9.0f") + "K" if te < 0

* Gen x-value for labels
gen te_y_label = te
replace te_y_label = 0 if te <0

tempfile pref_prepost_est
save `pref_prepost_est', replace

* Compute unified x-axis range across ALL bar chart data 
* Pad by extra 5000 to accommodate mlabel text extending past rightmost label
sum te
local ymin_bar = floor(`r(min)' / 5000) * 5000
local ymax_bar = ceil(`r(max)' / 5000) * 5000 + 5000


* te yaxis labels


local te_labs ""
forvalues val = -5000(10000)35000 {
	
if `val' <= -1000 {
	local val_k = -1 * `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local te_labs `te_labs' `val' "-$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local te_labs `te_labs' `val' "-$`val_disp'K" 
	}	
}

if `val' > -1000 & `val' < 0 {
	local `val_disp' = -1 * `val'
	local te_labs `te_labs' `val' "-$`val_disp'"
}
if `val' < 1000 & `val' >= 0{
	local te_labs `te_labs' `val' "$`val'"
}
if `val' >= 1000 {
	local val_k = `val'/1000
	if mod(`val', 1000) == 0 {
		local val_disp = string(`val_k', "%10.0f")
		local te_labs `te_labs' `val' "$`val_disp'K" 
	}
	else {
		local val_disp = string(`val_k', "%10.1f")
		local te_labs `te_labs' `val' "$`val_disp'K" 
	}	
}
}

* Locals for dimensions of exported figure
#delimit ;
local xsize 10 ;
local ysize 5 ;

local bar_shared_opts
    xlabel(1 "B. Education" 2 "B. Business" 3 "B. Technology" 4 "B. Health"
             5 "M. Education" 6 "M. Business" 7 "M. Technology" 8 "M. Health",
              labcolor(black) labsize(small) tlcolor(gs10) tlwidth(vthin))
    xscale(r(0.5 8.5) lcolor(gs10) lwidth(vthin))
    yscale(r(-3000 `ymax_bar') lcolor(gs10) lwidth(vthin))
	ylabel(`te_labs', nogrid labcolor(black) labsize(small) tlcolor(gs10) tlwidth(vthin))
	xsize(`xsize') ysize(`ysize')
    ytitle("Impact on Wages", color(black) size(small))
    xtitle("")
	yline(0, lcolor(black) lpattern(shortdash) lwidth(vthin))
    legend(order(1 "Preferred TE Estimate" 2 "Pre-Post Diff")
        position(11) cols(1) ring(0) color(black) size(small))
    plotregion(margin(r+3))
;

* bar series definitions
;
local bar_pref_pooled
	(bar te x_pos if spec == "pref_pooled", vertical barwidth(0.33) color("scheme p1"))
;

local bar_prepost 
	(bar te x_pos if spec == "prepost",vertical barwidth(0.33) color("scheme p2"))
;

local pref_pooled_labels 
	(scatter te_y_label x_pos if spec == "pref_pooled", 
		mcolor(none) mlabel(te_k) mlabposition(12) mlabcolor(gs4) mlabsize(small))
;


local prepost_labels 
	(scatter te_y_label x_pos  if spec == "prepost", 
		mcolor(none) mlabel(te_k) mlabposition(12) mlabcolor(gs4) mlabsize(small))
;

#delimit cr



* Plot just pref estimates- pooled

use `pref_prepost_est', clear
replace te = . if spec == "prepost"
replace te_k = "" if spec == "prepost"


#delimit ;
twoway  
	`bar_pref_pooled'
	`bar_prepost'
	`pref_pooled_labels'
	`prepost_labels'
	, `bar_shared_opts'
	name(pref_pooled, replace) 
;
#delimit cr
graph export "${figures}/hbarplot_pref_pooled.svg", replace


* Plot pref (pooled) and prepost estimates
use `pref_prepost_est', clear

#delimit ;
twoway 
	`bar_pref_pooled'
	`bar_prepost'
	`pref_pooled_labels'
	`prepost_labels'
	, `bar_shared_opts'
	name(pref_pooled_prepost, replace)
;
#delimit cr
graph export "${figures}/hbarplot_all_pooled.svg", replace



