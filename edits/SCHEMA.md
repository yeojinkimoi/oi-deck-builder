# Edit-request YAML schema

Every round of feedback (email/Slack text, marked-up PPTX/PDF, typed meeting notes) is
normalized into one YAML file: `edits/<YYYY-MM-DD>_<source>.yaml` (e.g. `2026-07-09_raj_email.yaml`).
The file is the audit trail — the requester's verbatim words are always preserved — and the
work queue: the deck-generator agent applies every `pending` entry and flips its status.

```yaml
meta:
  date: 2026-07-09
  source: email            # email | slack | pptx_comments | pdf_annotations | meeting_notes
  requester: Raj
  deck: decks/demo_ml/deck.js

edits:
  - id: e1
    slide: 4               # slide number, a title substring ("Gradient Boosting"), or "all"
    target: subtitle       # title | subtitle | figure | panel_title | bullet | table |
                           # source | diagram | layout | theme
    action: move           # move | resize | restyle | reword | replace_figure | add |
                           # delete | recolor | reorder
    detail: "move the subtitle up about a tenth of an inch"
    proposed:              # concrete change, when inferable — exactly what to put in code
      theme: { subtitleBar: { y: 0.68 } }        # constructor theme override
      # or: opts: { fig_box: { y: 1.4 } }        # per-slide opts change
      # or: text: "New wording for the bullet"   # content change
    scope: deck            # deck (theme override) | slide (per-slide opts) | content
    status: pending        # pending | applied | needs_clarification | rejected
    question: null         # set when status = needs_clarification — one specific question
    verbatim: "the subtitle is floating too low on the boosting slide"

  - id: e2
    slide: all
    target: theme
    action: restyle
    detail: "panel titles should follow the official style guide"
    proposed: { stylePreset: "guide2025" }
    scope: deck
    status: pending
    verbatim: "can we use the new style guide fonts for the panel headers"
```

Rules:
- One entry per distinct request, even if several arrive in one sentence.
- `verbatim` is mandatory. Never paraphrase away the original words.
- If the request is ambiguous (which slide? how much?), set `status: needs_clarification`
  and write ONE specific question in `question`. Do not guess silently.
- `proposed` must be concrete and mechanically applicable whenever possible; style changes
  prefer `theme` overrides (deck scope) over per-slide hacks.
- After applying, the deck-generator sets `status: applied` and appends
  `applied_in: <commit/build note>`.
