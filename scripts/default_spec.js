"use strict";

/**
 * The implied pipeline.
 *
 * A standard deck is `code/figures.do` then `outline.md`, in that order —
 * which the folder layout already states. So pipeline.yaml is OPTIONAL. It is
 * only needed when a deck deviates: an extra cleaning step, a second do-file,
 * a ROI calculation, a figure directory somewhere else.
 *
 * The disclosure is discovered from the `local release "..."` line the
 * template establishes in figures.do, resolved against the nearest
 * `Disclosures/` directory above the deck. Found or not, figures.do itself is
 * always an input, so editing it always rebuilds.
 */

const fs = require("fs");
const path = require("path");

function defaultSpec(deckDir, die) {
  const figuresDo = path.join(deckDir, "code", "figures.do");
  if (!fs.existsSync(figuresDo)) {
    die(
      `no pipeline.yaml and no code/figures.do in ${deckDir}\n` +
        "  A deck is code/figures.do + outline.md. Run `oi-deck new <Name>` to\n" +
        "  scaffold one, or add a pipeline.yaml if this deck has a different shape."
    );
  }
  if (!fs.existsSync(path.join(deckDir, "outline.md"))) {
    die(`no pipeline.yaml and no outline.md in ${deckDir}`);
  }

  // Output name from outline.md, else the folder name.
  let output = path.basename(deckDir).replace(/[^A-Za-z0-9_-]+/g, "") + ".pptx";
  const om = fs
    .readFileSync(path.join(deckDir, "outline.md"), "utf8")
    .match(/^-\s+\*\*Output\*\*\s*:\s*(.+)$/m);
  if (om) output = om[1].trim().replace(/^\.\//, "");

  // Disclosure, from `local release "..."`, against a Disclosures/ above us.
  const ins = ["code/figures.do"];
  const rm = fs
    .readFileSync(figuresDo, "utf8")
    .match(/^\s*local\s+release\s+"([^"]+)"/m);
  if (rm && !/CHANGE_ME/i.test(rm[1])) {
    let dir = deckDir;
    for (let i = 0; i < 6; i++) {
      const cand = path.join(dir, "Disclosures");
      if (fs.existsSync(cand)) {
        ins.push(
          path.relative(deckDir, path.join(cand, rm[1])).split(path.sep).join("/")
        );
        break;
      }
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }

  return {
    deck: path.basename(deckDir),
    _implied: true,
    steps: [
      {
        id: "figures",
        run: "stata code/figures.do",
        in: ins,
        out: ["figures/*.svg", "figures/facts.json"],
      },
      {
        id: "deck",
        run: `oi-outline outline.md --fig-dir figures --output ${output}`,
        in: ["outline.md", "figures/*.svg", "figures/facts.json"],
        out: [output],
      },
    ],
  };
}

module.exports = { defaultSpec };
