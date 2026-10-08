#!/usr/bin/env python
"""
figure-maker output (python-pptx): "How a Regression Tree Works".

Generates ONE native-shape diagram slide (OI-styled decision tree) and INSERTS it into an
existing OI deck at a given position, using the deck's own OI template layout. Native shapes
=> the reviewer can open the deck and drag/edit every node.

Usage:  python regression_tree.py <deck.pptx> <insert_index>
The script is the source of truth; re-running reproduces the slide deterministically.
"""
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor

# ── OI house style ─────────────────────────────────────────────────────────
OI_GREEN  = RGBColor(0x29, 0xB6, 0xA4)
NAVY      = RGBColor(0x00, 0x3A, 0x4F)
LINE_GRAY = RGBColor(0x80, 0x80, 0x80)
DARK_TEXT = RGBColor(0x26, 0x26, 0x26)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
LABEL_FONT = "Lucida Sans"

LAYOUT = "1_OI-Theme: Title and Subtitle, no Source Footer"
TITLE    = "How a Regression Tree Works"
SUBTITLE = "Illustrative — predicting a child's adult income"


def _style_text(shape, text, size, color, bold=False):
    tf = shape.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Pt(2)
    tf.margin_top = tf.margin_bottom = Pt(1)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.text = text
    for p in tf.paragraphs:
        p.alignment = PP_ALIGN.CENTER
        for r in (p.runs or [p.add_run()]):
            r.font.name = LABEL_FONT
            r.font.size = Pt(size)
            r.font.color.rgb = color
            r.font.bold = bold


def _node(slide, kind, cx, top, w, h, text, fill, line, txt_color, size, bold=False):
    left = Inches(cx - w / 2.0)
    shp = slide.shapes.add_shape(kind, left, Inches(top), Inches(w), Inches(h))
    shp.shadow.inherit = False
    shp.fill.solid(); shp.fill.fore_color.rgb = fill
    shp.line.color.rgb = line; shp.line.width = Pt(1.25)
    _style_text(shp, text, size, txt_color, bold)
    return shp


def _branch(slide, x1, y1, x2, y2, label, lx, ly):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = LINE_GRAY; c.line.width = Pt(1.5)
    tb = slide.shapes.add_textbox(Inches(lx - 0.3), Inches(ly - 0.14), Inches(0.6), Inches(0.28))
    _style_text(tb, label, 10, DARK_TEXT, bold=True)


def build_tree(slide):
    # Level geometry (inches on a 13.333 x 7.5 slide)
    DEC = dict(w=2.5, h=1.0)
    LEAF = dict(w=1.9, h=0.8)
    y0, y1, y2 = 1.65, 3.35, 5.05
    root_cx = 6.675
    l1 = [3.625, 9.725]
    leaves = [2.1, 5.15, 8.2, 11.25]
    leaf_vals = ["$22k", "$31k", "$38k", "$47k"]

    # Branches first (so nodes sit on top)
    _branch(slide, root_cx, y0 + DEC["h"], l1[0], y1, "Yes", (root_cx + l1[0]) / 2 - 0.15, (y0 + DEC["h"] + y1) / 2)
    _branch(slide, root_cx, y0 + DEC["h"], l1[1], y1, "No",  (root_cx + l1[1]) / 2 + 0.15, (y0 + DEC["h"] + y1) / 2)
    for parent, (a, b) in zip(l1, [(0, 1), (2, 3)]):
        _branch(slide, parent, y1 + DEC["h"], leaves[a], y2, "Yes", (parent + leaves[a]) / 2 - 0.15, (y1 + DEC["h"] + y2) / 2)
        _branch(slide, parent, y1 + DEC["h"], leaves[b], y2, "No",  (parent + leaves[b]) / 2 + 0.15, (y1 + DEC["h"] + y2) / 2)

    # Decision nodes (diamonds) — white fill, navy outline
    _node(slide, MSO_SHAPE.DIAMOND, root_cx, y0, DEC["w"], DEC["h"], "Parental income\nbelow median?", WHITE, NAVY, DARK_TEXT, 11, bold=True)
    _node(slide, MSO_SHAPE.DIAMOND, l1[0], y1, DEC["w"], DEC["h"], "Neighborhood\nmobility low?", WHITE, NAVY, DARK_TEXT, 11)
    _node(slide, MSO_SHAPE.DIAMOND, l1[1], y1, DEC["w"], DEC["h"], "Parental income\nbelow 25th pctile?", WHITE, NAVY, DARK_TEXT, 11)

    # Leaf nodes (rounded rects) — OI green fill, white value
    for cx, val in zip(leaves, leaf_vals):
        _node(slide, MSO_SHAPE.ROUNDED_RECTANGLE, cx, y2, LEAF["w"], LEAF["h"], val, OI_GREEN, OI_GREEN, WHITE, 16, bold=True)


def main():
    if len(sys.argv) < 3:
        sys.exit("usage: python regression_tree.py <deck.pptx> <insert_index>")
    deck_path, insert_index = sys.argv[1], int(sys.argv[2])

    prs = Presentation(deck_path)
    layout = next((lo for m in prs.slide_masters for lo in m.slide_layouts if lo.name == LAYOUT), None)
    if layout is None:
        sys.exit(f"layout not found: {LAYOUT}")

    slide = prs.slides.add_slide(layout)

    # Fill title/subtitle placeholders (inherit OI fonts); drop the empty content placeholder.
    to_remove = []
    for ph in slide.placeholders:
        idx = ph.placeholder_format.idx
        if idx == 0:
            ph.text = TITLE
        elif idx == 10:
            ph.text = SUBTITLE
        else:
            to_remove.append(ph)
    for ph in to_remove:
        ph._element.getparent().remove(ph._element)

    build_tree(slide)

    # Move the appended slide to its outline position.
    sld_lst = prs.slides._sldIdLst
    ids = list(sld_lst)
    new = ids[-1]
    sld_lst.remove(new)
    sld_lst.insert(insert_index, new)

    prs.save(deck_path)
    print(f"inserted 'How a Regression Tree Works' at index {insert_index} of {deck_path}")


if __name__ == "__main__":
    main()
