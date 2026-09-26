# M0 plan review: the QS critic

26 Sep 2026. The `qs-critic` agent reviewed docs/plans/M0.md and docs/specs/M0.md (Takeoff Step 1,
"Sheets") as a senior Dhaka QS. "Practice" marks findings resting on Dhaka consultant practice alone.
Resolved in the plan or put to the owner.

1. **Wrong number (M1): storey range per sheet as first–last.** Sheets carry several plans for
   different floors, and titles list non-runs ("3rd, 5th & 7th floor plan"); expanding first–last
   adds floors that differ. Fix: propose storeys per plan view as an explicit list; derive the
   sheet's range from its views; the scorer matches the list.
2. **Wrong number (M1): storeys vs floor levels.** "1st floor beam/slab layout" means members at the
   1st-floor level (the ground storey's ceiling); column schedules run between levels (practice).
   Binding a slab range to storeys shifts every slab up a floor. Fix: each view records whether its
   range means "members at floor level" or "storey (floor to floor)"; store the canonical level;
   boundary storeys are a Question.
3. **Blocks signing: storey words missing:** mezzanine, podium, semi-basement / lower ground, plinth /
   grade-beam level, lift machine room and its roof, overhead tank / tank roof, "Level n" / EL titles,
   and "typical floor" with no range. Fix: add them, and "typical (range from Step 3)" as a value.
4. **Blocks signing: no revision mark or date in the sheet list;** identity is (set, number) alone.
   Sets arrive at R1/R2 with superseded copies beside current ones; structural and architectural files
   both number 01, 02 (practice). Fix: revision mark, date and source file as columns and in the
   duplicate Question; key sheets by (set, Discipline, number); allow a sheet with no number.
5. **Blocks signing: Coverage assigns a view to one step.** A section feeds steps 3, 7, 8, 11; notes
   feed step 2 and the rebar rules; a column schedule feeds step 6 and M3. Fix: many-to-many (view to
   steps), each marked used separately.
6. **Blocks demo: no "elevation" view kind;** spec and data model disagree (no legend in the data
   model). Fix: add elevation, key plan, 3D/perspective (excluded by default); one list.
7. **Blocks demo: the walk never measures "confirm in minutes".** Fix: record Step 1 active time; one
   QS who did not build it does Step 1 on one set; the walk tries a multi-plan sheet, a non-run floor
   list, a superseded duplicate, an untitled typical floor, the count against the transmittal, and a
   view excluded now and needed later.
8. **Friction: N only from a register in the drawings or the PDF.** Most DWGs have none; QSs check the
   transmittal or an emailed list (practice). Fix: the QS may paste or type the drawing list as the
   register, its source marked.
9. **Friction: Discipline from the number's prefix only.** One DWG per discipline is the norm. Fix:
   default Discipline from the file; the prefix second.
10. **Friction: storey ranges confirmed in Step 1 before storeys exist.** Fix (M1): a Check tests
    each confirmed range against the confirmed storeys.
11. **Polish:** exclusion reasons as a fixed list (MEP, superseded, duplicate, cover/index,
    3D/perspective, reference only, other with text); natural sort of sheet numbers; parse imperial
    stated scales and N.T.S.

Not verified: which of these occur in the Edison or Sample Project sheets (no drawings opened).
