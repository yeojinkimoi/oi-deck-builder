#!/usr/bin/env node
/**
 * Extract reviewer comments from a .pptx into JSON (stdout).
 * Usage: node scripts/extract_pptx_comments.js Deck.pptx
 *
 * Covers modern comments (ppt/comments/*.xml) and classic comments
 * (ppt/comments/comment*.xml / commentAuthors). Output: one object per comment
 * with slide number, author, date, and text — ready for the edit-request-parser
 * agent to turn into edits/*.yaml entries.
 */
"use strict";
const fs = require("fs");
const JSZip = require("jszip");

async function main() {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node extract_pptx_comments.js Deck.pptx"); process.exit(1); }
  const zip = await JSZip.loadAsync(fs.readFileSync(file));

  // author id -> name (classic)
  const authors = {};
  const authFile = zip.file("ppt/commentAuthors.xml");
  if (authFile) {
    const xml = await authFile.async("string");
    for (const m of xml.matchAll(/<p:cmAuthor\b[^>]*\bid="(\d+)"[^>]*\bname="([^"]*)"/g)) authors[m[1]] = m[2];
  }
  // modern authors part
  const modAuth = zip.file("ppt/authors.xml");
  if (modAuth) {
    const xml = await modAuth.async("string");
    for (const m of xml.matchAll(/<a188:author\b[^>]*\bid="\{([^}]+)\}"[^>]*\bname="([^"]*)"/g)) authors[m[1]] = m[2];
  }

  // map comment part -> slide number via slide rels
  const partToSlide = {};
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/^ppt\/slides\/_rels\/slide(\d+)\.xml\.rels$/);
    if (!m) continue;
    const rels = await zip.file(name).async("string");
    for (const r of rels.matchAll(/Target="\.\.\/(comments\/[^"]+)"/g)) partToSlide["ppt/" + r[1]] = Number(m[1]);
  }

  const out = [];
  for (const name of Object.keys(zip.files)) {
    if (!/^ppt\/comments\/.*\.xml$/.test(name)) continue;
    const xml = await zip.file(name).async("string");
    const slide = partToSlide[name] ?? null;
    // classic: <p:cm authorId="0" dt="..."><p:text>...</p:text>
    for (const m of xml.matchAll(/<p:cm\b([^>]*)>([\s\S]*?)<\/p:cm>/g)) {
      const attrs = m[1];
      const text = ((m[2].match(/<p:text>([\s\S]*?)<\/p:text>/) || [])[1] || "").trim();
      const authorId = (attrs.match(/authorId="(\d+)"/) || [])[1];
      const dt = (attrs.match(/dt="([^"]+)"/) || [])[1] || null;
      if (text) out.push({ slide, author: authors[authorId] || authorId || "unknown", date: dt, text: decode(text) });
    }
    // modern: <cm:cm ...><cm:txBody>..<a:t>text</a:t>
    for (const m of xml.matchAll(/<cm:cm\b([^>]*)>([\s\S]*?)<\/cm:cm>/g)) {
      const attrs = m[1];
      const runs = [...m[2].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((r) => r[1]).join("");
      const aid = (attrs.match(/authorId="\{([^}]+)\}"/) || [])[1];
      const dt = (attrs.match(/created="([^"]+)"/) || [])[1] || null;
      if (runs.trim()) out.push({ slide, author: authors[aid] || "unknown", date: dt, text: decode(runs.trim()) });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
}
main().catch((e) => { console.error(e); process.exit(1); });
