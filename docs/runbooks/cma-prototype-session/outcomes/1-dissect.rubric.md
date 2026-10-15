# Outcome 1 rubric: the Edison set dissected and reconciled

Grade each criterion on its own. Paths are under /mnt/session/outputs/.

1. `private/01-dissect/` holds one report per Discipline present in the Edison set (at least structural
   and architectural, and every MEP Discipline whose drawings exist), each listing the files it read and
   the files or sheets it could not read, with the reason.
2. Each Discipline report states the office's conventions (layers, blocks, text and dimension styles,
   schedules, grid and level marks, tag formats) with entity counts as evidence: together, a Drafting
   Profile the QS could confirm.
3. `private/01-dissect/inventory.json` lists Elements per Discipline and storey with Discipline, Category,
   Family, Type, Tag, geometry in metres and a Trace (file, layer, handles, sheet), and each Element's
   state is `read`, `inferred` or `placeholder`; the report gives counts per state.
4. Storeys, levels and the structural grid are established once and every Discipline is placed on them;
   mismatches between Disciplines (a grid offset, a level that disagrees) are listed, not hidden.
5. Cross-discipline Element Relations are found and listed by kind (hosted in, passes through, located in,
   same as), with counts and examples.
6. `public/01-dissect/engine-gaps.md` runs the repository's own engine readers on the set and lists, per
   Takeoff Step, what they read correctly, what they miss and why, stated generically (no drawing text).
7. `public/01-dissect/claude-design-review.md` says what the Claude Design G+9 model does well (its
   classification of 25 Categories across 5 Disciplines, its interaction), what a real set like Edison has
   that it lacks, and what it has that real drawings never give; it is based on screenshots the agent took.
8. `public/01-dissect/conventions.md` holds only generic conventions with counts, and no text, name,
   dimension or geometry from the Edison drawings.
9. The QS critic has reviewed the inventory's structural quantities path, and the Adversary has checked a
   sample of at least 20 `read` Elements against their Traces; both reviews and the fixes are recorded.
10. CHECKPOINT.md and outputs.tar.gz are current.
