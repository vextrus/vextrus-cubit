# The revised M0 plan (session 02), attacked: the QS critic

28 Sep 2026. Read as a senior Dhaka QS, checked against the Edison set's conventions (counts and
conventions only; the evidence stays in `.private/work/session-02/`). Written by the orchestrator from the
agent's report.

**Q1 · wrong number (lands in M1's storey binding) · The storey vocabulary misses Edison's own words, and
one fitting was a literal the plan forbids.** Code alone read Edison's 32 storey-bearing structural titles
14 right, 3 wrong, 18 missed (edison-check-session-02.md:41); the wrong ones were a "below ground floor"
band, "ground & mezzanine" and "1st to top", and the fitting made "top" a fixed floor, a literal plan:652
bans; the vocabulary (spec:438-440; amendment 3, 914-916) has no "top"; Edison's plinth-level beams are
"tie beams" (the vocabulary knows "grade beam"); "below ground floor" on a set without a basement means the
stubs from pile cap to ground; "typical" appears on many detail titles; spec:552-554 still has Jev choose
the first and last storey. Fix: "top" a symbolic end resolved in Step 3; "below ground floor" = foundation
to ground unless a basement is confirmed, else a Question; tie, grade and plinth beam as synonyms (data);
"typical" a storey word only on plan views beside floor or plan words; tanks and the UGWR structures for
Step 10, not storeys; correct spec:552-554; walk target Edison's 32 titles with 0 wrong.

**Q2 · wrong number (latent, M1) · Views are proposed to Takeoff Steps regardless of Discipline.** The
architect's set carries column and beam layout plans (coordination copies); the structural drawings govern
structure; fixture layouts and toilet details are where sanitary fixtures are drawn (ADR 0040:31-32), but
M0 proposes nothing from an architectural view to the Plumbing Part. Fix: steps 5–10 proposed for
Structural views only; structural-looking architectural plans proposed as excluded, "the structural set
governs"; architectural fixture plans and toilet details proposed to the Plumbing and sanitary Part as well
as steps 11–12.

**Q3 · blocks signing · The conflict Questions flood on any real Dhaka set.** "Two sheets with one title"
and "two plan views of one Discipline and kind titled for the same storey" (plan:686-689; spec:510-514)
fire on normal practice: on Edison, identical titles in 7 groups over 23 of 57 structural sheets
(continuation sheets); a beam layout plus bottom- and top-layer slab sheets per floor; seven architectural
plan kinds per floor; five electrical sheet kinds per storey band; only 2 conflicts are true. Fix: a
same-storey conflict only when Discipline, subject (what the plan draws, from title words held as data)
and layer (top or bottom) all match; identical titles on consecutive numbers grouped as one continuation
with no Question; walk target on Edison 2 raised, 0 false.

**Q4 · blocks signing · On Edison every source of N and every second source for a pre-pick fails.** No
drawing list or index in either PDF; title blocks stroked with 0 SHX annotations on 141 pages; bare `NN`
numbers; no PDF for the notes; ticket 18 matches pages by title-block text (plan:729-730), and the risk
table's "page text includes SHX comments" (plan:928) is false for Edison (session 01 registered by body
text, vector-pdf-evidence.md:101); the bulk act's "why" needs a drawing list (m0-screens:942). Fix: match
pages by body text when the title block is strokes; define "agrees" without a list (number and title from
the title block, numbering continuous with no gap, Plot matched); let the QS type a range ("01–57") as the
drawing list; show "no drawing list; numbering runs 01–57 without a gap" instead of "—".

**Q5 · blocks signing · Edison's General Note DWG is outside M0's scope.** The spec's four files in scope
(719-722) and walk step 2 (684-687) omit it; its 8 frames have no numbers, no PDF and a Layout1, and it is
Step 2's source. Fix: add it to the walk and the Measured items (five Edison files): the hardest "no number,
no list" case.

**Q6 · blocks signing · Step 1 is one step across all Disciplines, but MEP mostly arrives later.**
StepProgress is keyed (project, building, step) with Step 1's Building empty (plan:735-736); Step 1 is
confirmed only when every sheet is (m0-screens:1143-1145); a reopened step re-runs dependants' Checks
(M1.md:708-711); ADR 0040 gives each Part its own Confirmations; nothing says whether a late file of a new
Discipline is a Revision. Fix: Step 1's progress and N per Discipline Part ("Structural confirmed ·
Electrical 38 to confirm"); a file of a new Discipline opens only that Part's Step 1, is not a Revision and
never reopens Structural; show "Disciplines not yet received" (Fire from 7 storeys, bd-defaults:225-228);
walk: confirm Edison's structural and architectural, then add ELECTRICAL and PLUMBING, Structural staying
confirmed.

**Q7 · blocks signing (for M3) · MEP sheet lists confirmed but never measured, and M0 excludes the MEP
legend.** MEP files "are not measured in M0" (spec:719-722) yet confirmed for M3 (story 104); Edison has 38
electrical and 26 plumbing sheets; both MEP files carry a stale Layout1 showing an empty region, which
ticket 13 (plan:643-644) would turn into phantom sheets; three AC-pipe sheets are base plan and title only;
M3 builds each MEP office's Drafting Profile from its legend, yet legends are excluded by default as
reference only (plan:723; m0-screens:828). Fix: ELECTRICAL and PLUMBING in the Measured items (sheets,
numbers, titles, storeys, 0 phantoms); a layout whose viewports show nothing dropped or proposed out;
legends assigned to their Discipline's Part (or Step 2 for structural and architectural), not excluded; a
reason "blank: base plan only".

**Q8 · friction (wrong number in M3) · Six Disciplines hard-coded; "Other MEP" is not a QS's word.** The
Disciplines are fixed in `engine/recognise/types.py` (plan:244-246); the MEP template's lift, generator,
substation, pumps/intercom/CCTV and gas lines (bd-defaults:141-150) have no Part; Edison's plumbing file
holds the gas riser, its electrical file AC pipework, low-voltage, solar and lightning protection; nothing
says which allowance lines stop once the Electrical Part is read; "Plumbing" vs "Plumbing and sanitary"
(m0-screens:897). Fix: Disciplines as Library rows per Market, adding Mechanical (HVAC), Lift and Gas; each
MEP template line names the Part whose reading replaces it; one name per Discipline everywhere.

**Q9 · friction · The exclusion reasons miss those a Dhaka QS uses.** Missing: by others / outside this
Estimate (lift supplier, DESCO substation, interior, landscape); presentation / for information (8
presentation-plan titles on Edison); another Discipline's copy (Q2). "Reference only" is not a QS's word;
whether excluding the cover or index drops its drawing list is undefined. Fix: superseded · duplicate or
another Discipline's copy · cover or index (its drawing list kept) · presentation, 3D or for information ·
by others (not in this Estimate) · blank · other.

**Q10 · friction / polish · The revision mark only from the title block; a tool no QS uses in M0.** Dhaka
sets mark the issue in the file name ("_R0", "_Final"); Edison's title-block read yielded number and title
only; the duplicate-number pre-pick rests on revision and date (m0-screens:1054). The "Assign steps" dialog
(18 checkboxes marked "M1/M3 onwards", m0-screens:1098-1106) does nothing in M0. Fix: read the revision
from the file name as a named source ("R0, from the file name"; "Final" is not a mark); keep Exclude in M0
and hide Assign until M1.

**Not verified.** Edison's architectural DWG was never split into sheets (its count against the 84 PDF
pages is unknown); the General Note file scanned for model-space text only; stale layouts seen only in the
MEP files; whether the Sample Project carries a drawing list; ezdxf reported non-unique handles in the
General Note DXF (whether the two-decoder comparison quarantines it is unverified).

**Verdict.** Would not sign M0's sheet list on a real set as it stands: the plan tunes Step 1 to a picture
Edison contradicts (continuation sheets and several plans per storey are normal; a set can come with no
drawing list and a stroked Plot; notes come as their own file; the architect draws beam layouts; MEP comes
later as another office's set with its own legend). With Q1–Q3 and Q5 in tickets 13, 17 and 19b and the
walk's scope, a Discipline key on Step 1's progress (Q6), and the General Note and MEP files measured, M0's
Step 1 is one a Dhaka QS would work and sign.
