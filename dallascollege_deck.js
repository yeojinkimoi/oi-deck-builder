#!/usr/bin/env node
"use strict";

const path = require("path");
const { OIDeckBuilder, parseArgs } = require("./oi_deck_builder");

const BASE = __dirname;
const cliOpts = parseArgs();
const FIG_DIR = cliOpts.figDir ?? path.join(BASE, "figures");
const OUTPUT = cliOpts.output ?? path.join(BASE, "DallasCollege_April2026.pptx");
const CACHE_DIR = cliOpts.cacheDir ?? path.join(BASE, ".pptx_cache");

const deck = new OIDeckBuilder({
  figDir: FIG_DIR,
  output: OUTPUT,
  cacheDir: CACHE_DIR,
});

const fig = (name) => deck.fig(name);

async function main() {
  // Slide 1: Title Slide
  deck.addTitleSlide(
    "The Impacts of DallasCollege Programs on Students' Earnings",
    "Preliminary Estimates Using Matched Comparison Groups",
    "April 2026",
    "PRELIMINARY DATA -- DO NOT CITE"
  );

  // Slide 1: Dallas College Credit Programs (Table)
  deck.addTableSlide("Dallas College Credit Programs", [
    ["School", "Program Group", "Example Program", "Resulting Credential", "Number of Students", "Approx. Cost"],
    ["Business, Hospitality, and Global Trade", "Management Careers", "Human Resources Assistant", "Certificate 1", "2,495", "$1,782"],
    ["Health Sciences", "Nursing", "Associate Degree Nursing", "Associate Degree", "2,080", "$5,940"],
    ["Law and Public Service", "Criminal Justice", "Basic Criminal Justice", "Certificate 1", "1,001", "$1,782"],
    ["Engineering, Technology, Math & Science", "Computer Information Systems", "Technology Support", "Certificate 1", "1,376", "$1,782"],
    ["Manufacturing and Industrial Technology", "Automotive Technology", "Automotive Repair", "Certificate 1", "1,156", "$1,782"],
    ["Education", "Early Childhood Education", "Early Childhood Education", "Certificate 1", "90", "$1,782"],
    ["Creative Arts, Entertainment & Design", "Digital Art and Design", "Digital Media", "Certificate 1", "234", "$2,970"],
  ], {
    colW: [2.8, 1.9, 2.4, 1.7, 1.5, 1.2],
  }, {
    subtitle: "Largest Credit Program Group Within Each School",
    footnote: "Program groups are defined as the largest credit-program division within each Dallas College school, restricting to students with enrollment year \u2264 2019. Approximate cost is calculated as modal program credit hours \u00D7 Dallas College\u2019s current Dallas County resident tuition rate of $99 per credit hour.",
  });

  // Slide 2: Dallas College Continuing Education Programs (Table)
  deck.addTableSlide("Dallas College Continuing Education Programs", [
    ["School", "Program Group", "Example Program", "Resulting Credential", "Number of Students", "Approx. Cost"],
    ["Business, Hospitality, and Global Trade", "Management Careers", "Organizational Culture Change/Adaptation", "ICLC/CESA", "154", "$553"],
    ["Health Sciences", "Nursing Support", "Certified Nurse Aide", "ICLC/CESA", "675", "$1,500"],
    ["Law and Public Service", "Criminal Justice", "Basic Police Recruit Training", "Continuing Ed Certificate", "1,671", "$5,031"],
    ["Engineering, Technology, Math & Science", "Computer Information Systems", "CISCO Networking Technician", "Skills Award", "341", "$3,360"],
    ["Manufacturing and Industrial Technology", "Construction Technology", "Commercial Plumbing", "Continuing Ed Certificate", "400", "$4,320"],
    ["Education", "Child Development", "Teaching Assistant Preparation", "ICLC/CESA", "288", "$711"],
  ], {
    colW: [2.8, 1.9, 2.4, 1.7, 1.5, 1.2],
  }, {
    subtitle: "Largest Continuing Education Program Group Within Each School",
    footnote: "Program groups are defined as the largest continuing-education division within each Dallas College school, restricting to students with enrollment year \u2264 2019. Approximate cost is calculated as modal program contact hours \u00D7 the relevant Dallas College CE contact-hour rate.",
  });

  await deck.save();
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
