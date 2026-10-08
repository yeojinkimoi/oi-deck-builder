set scheme opp_insights_contrast

clear all 

global disclosure "${dropbox}/outside/workforce_training/Disclosures"
global curr_disclosure "${disclosure}/june2026"
global figures "${dropbox}/outside/workforce_training/Slides/SOO-2026/figures"

graph set svg fontface "Lucida Sans"
**# Import and merge estimates from june 2026 disclosure of wf programs
* =================================================================

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("event_study_rct") firstrow clear

reshape wide mean se_mean, i(program site outcome) j(treat_group) string 

tempfile esrct
save `esrct', replace

import excel using "${curr_disclosure}/june2026_for_release_T13_T26.xlsx", sheet("event_study_aipw") firstrow clear
drop treat_group

tempfile esaipw
save `esaipw', replace

use `esrct', clear
merge 1:1 program site outcome using `esaipw'

gen year_relative = substr(outcome,6,3)
replace year_relative = subinstr(year_relative, "L", "-", 1)
destring year_relative, replace
sort year_relative

gen ci_u_meantreated = meantreated + 1.96*se_meantreated
gen ci_l_meantreated = meantreated - 1.96*se_meantreated

gen ci_u_meancontrol = meancontrol + 1.96*se_meancontrol
gen ci_l_meancontrol = meancontrol - 1.96*se_meancontrol

set seed 42
gen jitter = runiform(-2,2)
replace aipw_mean = meantreated + jitter if mi(aipw_mean)


gen rct_te = meantreated - meancontrol
gen se_rct_te = sqrt(se_meantreated^2 + se_meancontrol^2)
gen aipw_te = meantreated - aipw_mean
gen ci_l_te = rct_te - 1.96 * se_rct_te
gen ci_u_te = rct_te + 1.96 * se_rct_te


**# Define labels for plots 
* fix axes across programs


local labs ""
forvalues val = 10000(10000)50000 {
	

if `val' < 1000 {
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


local te_labs ""
forvalues val = -5000(5000)15000 {
	
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


**# Plot

levelsof program, local(programs)
foreach p of local programs {

preserve
	keep if program == "`p'"
	levelsof site, local(sites)
	
	sum year_relative
	local xmin = r(min)
	local xmax = r(max)
	
restore


foreach s of local sites {

	preserve
		keep if program == "`p'"
		keep if site == "`s'"
		keep if year_relative > -5

		local inprogtextpos = 29000
		local inprogarea = 28000
		
		if "`p'" == "YU_PACE" {
			local prog_year = 2014
			local prog_text = "Year Up"
		}
		
		if "`p'" == "WA" {
			local prog_year = 2012
			local prog_text = "PerScholas"
		}
		
		if "`p'" == "SEIS" {
			local prog_year = 2005
			local prog_text = "PerScholas"
		}
		
		if "`p'" == "STED" {
			local prog_year = 2013
			local prog_text = "STED"
		}

		gen year = year_relative + `prog_year'
		sum year
		local xmin = r(min)
		local xmax = r(max)
		
		local in_prog_min = `prog_year' - 0.5
		local in_prog_max = `prog_year' + 0.5
		
		local common_opts xlabel(`xmin'(2)`xmax', labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
						  xscale(lcolor(gs10) lwidth(vthin)) /// 
						  xtitle("Year", color(black) margin(t+1)) ///
						  ytitle("Mean W-2 Wage Earnings", color(black) margin(r+1)) ///
						  plotregion(margin(b=0 r+2)) xsize(17) ysize(9)
						  
		local plotopts_mean `common_opts' ///
							ylabel(0 "0" `labs', nogrid labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
							yscale(lcolor(gs10) lwidth(vthin) range(-2500 50000)) 
							
							
		local plotopts_te   `common_opts' ///
							ylabel(`te_labs', nogrid labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
							yscale(lcolor(gs10) lwidth(vthin) range(-10000 15000)) 
							
		
		local base_val -2500
		
		local legend_opts position(11) ring(0) cols(1) color(black) size(22pt) bmargin(t-3) rowgap(small)
		
		if "`p'" == "YU_PACE" {
			
			
			# delimit;
			twoway 
			(scatter rct_te year if year==., color("scheme p9") msize(large)) 
			(scatter aipw_te year if year==., color(none)) 
			(function y = 4000, range(`in_prog_min' `in_prog_max') recast(area) base(-10000) color(gs12%40) lwidth(none)) 
			(connected rct_te year, color("scheme p9")) 
			(rcap ci_l_te ci_u_te year, color("scheme p9")) 
			(connected aipw_te year, color(none))  
			,
			text(4150 `prog_year' "{it:Participants}" "{it:enrolled}" "{it:in `prog_text'}", color(black) size(small) justification(left) placement(12))
			
			`plotopts_te'
			legend(order(1 "Estimates from Randomized Trial") `legend_opts')
			name("`p'_`s'_te_rct", replace)
			;
			# delimit cr
			graph export "${figures}/`p'_`s'_rct_dml_event_study_te_rct.svg", replace
			
			
			
	
			# delimit;
			twoway 
			(scatter meantreated year if year==., color("scheme p1") msize(large))
			(scatter meancontrol year if year==., color("scheme p2") msize(large))
			(scatter aipw_mean year, color(none)) 
			(function y = `inprogarea', range(`in_prog_min' `in_prog_max') recast(area) base(`base_val') color(none) lwidth(none)) 
			(connected meantreated year if year < 2014, color("scheme p1")) 
			(rcap ci_l_meantreated ci_u_meantreated year if year < 2014, color("scheme p1")) 
			(connected meancontrol year if year < 2014, color("scheme p2")) 
			(rcap ci_l_meancontrol ci_u_meancontrol year if year < 2014, color("scheme p2")) 
			(connected aipw_mean year, color(none))  
			(connected meantreated year, color(none)) 
			(connected meancontrol year, color(none)) 
			,
			text(`inprogtextpos' `prog_year' "{it:Participants}" "{it:enrolled}" "{it:in `prog_text'}", color(none) size(small) justification(left) placement(12))
			`plotopts_mean'
			legend(order(1 "Treatment" 2 "Control") `legend_opts')
			name("`p'_`s'_a0", replace)
			;
			# delimit cr
			graph export "${figures}/`p'_`s'_rct_dml_event_study_mean_a0.svg", replace
			
			# delimit;
			twoway 
			(scatter meantreated year if year==., color("scheme p1") msize(large))
			(scatter meancontrol year if year==., color("scheme p2") msize(large))
			(scatter aipw_mean year, color(none)) 
			(function y = `inprogarea', range(`in_prog_min' `in_prog_max') recast(area) base(`base_val') color(gs12%40) lwidth(none)) 
			(connected meantreated year if year < 2015, color("scheme p1")) 
			(rcap ci_l_meantreated ci_u_meantreated year if year < 2015, color("scheme p1")) 
			(connected meancontrol year if year < 2015, color("scheme p2")) 
			(rcap ci_l_meancontrol ci_u_meancontrol year if year < 2015, color("scheme p2")) 
			(connected aipw_mean year, color(none))  
			(connected meantreated year, color(none)) 
			(connected meancontrol year, color(none)) 
			,
			text(`inprogtextpos' `prog_year' "{it:Participants}" "{it:enrolled}" "{it:in `prog_text'}", color(black) size(small) justification(left) placement(12))
			`plotopts_mean'
			legend(order(1 "Treatment" 2 "Control") `legend_opts')
			name("`p'_`s'_a1", replace)
			;
			# delimit cr
			graph export "${figures}/`p'_`s'_rct_dml_event_study_mean_a1.svg", replace
			
		}
		
		
		
		# delimit;
		twoway 
		(scatter meantreated year if year==., color("scheme p1") msize(large))
		(scatter meancontrol year if year==., color("scheme p2") msize(large))
		(scatter aipw_mean year, color(none)) 
		(function y = `inprogarea', range(`in_prog_min' `in_prog_max') recast(area) base(`base_val') color(gs12%40) lwidth(none)) 
		(connected meantreated year, color("scheme p1")) 
		(rcap ci_l_meantreated ci_u_meantreated year, color("scheme p1")) 
		(connected meancontrol year, color("scheme p2")) 
		(rcap ci_l_meancontrol ci_u_meancontrol year, color("scheme p2")) 
		(connected aipw_mean year, color(none))  
		,
		text(`inprogtextpos' `prog_year' "{it:Participants}" "{it:enrolled}" "{it:in `prog_text'}", color(black) size(small) justification(left) placement(12))
		`plotopts_mean'
		legend(order(1 "Treatment" 2 "Control") `legend_opts')
		name("`p'_`s'_a", replace)
		;
		# delimit cr
		graph export "${figures}/`p'_`s'_rct_dml_event_study_mean_a.svg", replace
		
		
		# delimit;
		twoway 
		(scatter meantreated year if year==., color("scheme p1") msize(large))
		(scatter meancontrol year if year==., color("scheme p2") msize(large))
		(scatter aipw_mean year if year==., color("scheme p3") msize(large)) 
		(function y = `inprogarea', range(`in_prog_min' `in_prog_max') recast(area) base(`base_val') color(gs12%40) lwidth(none)) 
		(connected meantreated year, color("scheme p1")) 
		(rcap ci_l_meantreated ci_u_meantreated year, color("scheme p1")) 
		(connected meancontrol year, color("scheme p2")) 
		(rcap ci_l_meancontrol ci_u_meancontrol year, color("scheme p2")) 
		(connected aipw_mean year, color("scheme p3"))  
		,
		text(`inprogtextpos' `prog_year' "{it:Participants}" "{it:enrolled}" "{it:in `prog_text'}", color(black) size(small) justification(left) placement(12))
		`plotopts_mean'
		legend(order(1 "Treatment" 2 "Control" 3 "ML Counterfactual (Synthetic Digital Twins)") `legend_opts')
		name("`p'_`s'_b", replace)
		;
		# delimit cr
		graph export "${figures}/`p'_`s'_rct_dml_event_study_mean_b.svg", replace
	
		# delimit;
		twoway 
		(scatter rct_te year if year == ., color("scheme p9") msize(large)) 
		(scatter aipw_te year if year == ., color("scheme p4") msize(large)) 
		(function y = 6000, range(`in_prog_min' `in_prog_max') recast(area) base(-10000) color(gs12%40) lwidth(none)) 
		(connected rct_te year, color("scheme p9")) 
		(rcap ci_l_te ci_u_te year, color("scheme p9")) 
		(connected aipw_te year, color("scheme p4"))  
		,
		text(6150 `prog_year' "{it:Participants}" "{it:enrolled}" "{it:in `prog_text'}", color(black) size(small) justification(left) placement(12))
		`plotopts_te'
		legend(order(1 "Estimates from Randomized Trial"  2 "Estimates from Synthetic Digital Twins" ) `legend_opts')
		name("`p'_`s'_te", replace)
		;
		# delimit cr
		graph export "${figures}/`p'_`s'_rct_dml_event_study_te.svg", replace
		
	restore
		
	}
}


**# Import and stack estimates from WGU / Dallas College
* =================================================================
* WGU BS + RN grads
* WGU BS + RN withdrawers
* WGU Bach Ed
* DC Nursing
* DC Vet tech


import excel "${disclosure}/wgu_april2026/wgu_dallascollege_for_release_T13_T26.xlsx", sheet("WGU") firstrow clear

gen program = "WGU_BSRN"

replace program = "WGU_BSRN_wd" if status == "withdrawn"
replace program = "WGU_BSRN_grad3" if status == "graduated"

tempfile results
save `results', replace


import excel "${disclosure}/wgu_april2026/wgu_dallascollege_for_release_T13_T26.xlsx", sheet("DallasCollege_es") firstrow clear

gen program = "DC"
replace program = program + "_" + division

append using `results'
save `results', replace

import delimited "${disclosure}/wgu_february2026/derived/WGU_Bachelor_Education_model0_site2_grad.csv", clear

replace program = "WGU_BachEd_grad2"
rename site completion_bin
drop v1

append using `results'

drop year_relative
gen year_relative = substr(outcome,6,3)
replace year_relative = subinstr(year_relative, "L", "-", 1)
destring year_relative, replace
sort year_relative

save `results', replace




**# Define labels for plots 
* =================================================================
* fix axes across programs


local labs ""
forvalues val = 20000(20000)80000 {
	

if `val' < 1000 {
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


**# Plot
* =================================================================

use `results', clear

levelsof program, local(progs)
foreach p of local progs {


	local vlines (pci -2500 0 75000 0, lcolor(black) lpattern(shortdash) lwidth(vthin))
	local vtext text(77000 0 "Entry", color(black) size(22pt))
	
	if "`p'" == "WGU_BSRN_grad3" {
		local vlines `vlines' (pci -2500 3 75000 3, lcolor(black) lpattern(shortdash) lwidth(vthin) )
		local vtext `vtext' text(77000 3 "Graduation", color(black) size(22pt))
		local legtext "Graduates"
	}
	
	if "`p'" == "WGU_BSRN_wd" {
		local legtext "Withdrawers"
	}
	
	if "`p'" == "DC_NURS" {
		local vlines `vlines' (pci -2500 3 75000 3, lcolor(black) lpattern(shortdash) lwidth(vthin) )
		local vtext `vtext' text(77000 3 "Graduation", color(black) size(22pt))
		local legtext "Graduates"
	}
	
	if "`p'" == "DC_VTECH" {
		local vlines `vlines' (pci -2500 3 75000 3, lcolor(black) lpattern(shortdash) lwidth(vthin) )
		local vtext `vtext' text(77000 3 "Graduation", color(black) size(22pt))
		local legtext "Graduates"
	}
	
	if "`p'" == "WGU_BachEd_grad2" {
		local vlines `vlines' (pci -2500 2 75000 2, lcolor(black) lpattern(shortdash) lwidth(vthin) )
		local vtext `vtext' text(77000 2 "Graduation", color(black) size(22pt))
		local vtext `vtext' text(77000 2 "Graduation", color(black) size(22pt))
		local legtext "Graduates"
	}
	
	
	local common_opts xlabel(-5(1)5, labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
							  xscale(lcolor(gs10) lwidth(vthin)) /// 
							  xtitle("Year relative to enrollment", color(black) margin(t+1)) ///
							  ytitle("Mean W-2 Wage Earnings", color(black) margin(r+1)) ///
							  plotregion(margin(b=0 r+2)) xsize(17) ysize(9)
							  
	local plotopts_mean `common_opts' ///
						ylabel(0 "0" `labs', nogrid labcolor(black) tlcolor(gs10) tlwidth(vthin)) ///
						yscale(lcolor(gs10) lwidth(vthin) range(-2500 80000)) 
						

	local base_val -2500

	local legend_opts position(11) ring(0) cols(1) color(black) size(22pt) bmargin(t-3) rowgap(small)

	
	preserve
	keep if program == "`p'"
	sort year_relative
	# delimit;
	twoway 
	
	(scatter mean_treat_match year_relative if year_relative==., color("scheme p1") msize(large))
	(scatter mean_matched year_relative if year_relative==., color("scheme p2") msize(large))
	`vlines'
	(connected mean_treat_match year_relative, color("scheme p1")) 
	(connected mean_matched year_relative, color("scheme p2")) 
	
	,
	`plotopts_mean' `vtext'
	legend(order(1 "`legtext'" 2 "Digital Twins") `legend_opts')
	name("`p'", replace)
	;
	# delimit cr
	*graph export "${figures}/`p'_event_study.svg", replace
	restore

}



