# Deck Outline: _probe (generate → compose proof)

Proves the new loop: pptxgenjs builds the text/figure slides; the figure-maker generates a
diagram slide with **python-pptx**; the compose step inserts it at its outline position.

## Deck Settings
- **Title**: Tree-Based ML — Probe
- **Subtitle**: generate → compose proof
- **Output**: ./_probe.pptx

## Slides

### TEXT: Why Tree-Based Models?
- **Subtitle**: Motivation
- Flexible prediction without assuming a functional form
  - Splits are learned from the data, not specified by the researcher
- Two workhorses: regression trees and gradient boosting

### DIAGRAM: How a Regression Tree Works
- **Subtitle**: Illustrative — predicting a child's adult income
- **Generate**: diagram — a 3-level decision tree splitting on parental income and
  neighborhood upward mobility, with predicted adult income at each leaf
- **Save as**: regression_tree

### TEXT: Practical Notes
- Depth controls flexibility: shallow underfits, deep overfits
- The diagram slide above is native python-pptx shapes — open and drag the nodes
