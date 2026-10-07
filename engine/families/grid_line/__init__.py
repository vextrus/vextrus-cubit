"""The grid_line family (docs/plans/M1.md C4; session 16's contract): the structural grid read from a
plan's bubbles and lines, and the frame that registers it across plans.

- `recognise(views, confirmed, setup, profile)`: one `ElementCandidate` per grid line per view (its
  `mark` the bubble's label verbatim, `values["axis"]` the direction it is drawn, `values["offset"]`
  where it lies across that direction, in drawing units); a view with no grid raises a Question.
- `frame.register(candidates_by_view) -> Frame`: the grid registered across plans; `Frame.point("B/2")`.

No layer, block or label is named in code (ADR 0039): a grid line is found by what it is drawn as, a
labelled bubble at the end of a long straight line. A confirmed Drafting Profile's `grid` part narrows
the search to its layers and bubble blocks.
"""
