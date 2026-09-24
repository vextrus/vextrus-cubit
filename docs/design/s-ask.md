# Design Decision — S-Ask (ask the drawings)

Route `/t/{tenant}/p/{project}/takeoff/ask`, with an optional `?q=` carrying a question to ask on
arrival — the **seventh** tab of the takeoff lane, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/ask/**`, inside the shell frame and behind
`authorizePage({ tenant, project })`. Law: R-AI-003, S-Ask, X-7, J-043, AM-17 (the M4 segment "a
question asked of the drawings"), L-AI-01, L-AI-02, L-AI-03, R-AI-005, R-SPINE-052 and R-TO-016 (the
text a question may find), L-QTY-02, L-FMT-01, L-FMT-02, B-07, B-17, R-UI-002/003/004/012/020/022/
024/050/060/080/082/083/085, R-SPINE-060, C-05, C-13, ARCH-01. The Bible is read as the default here
and departed from by no clause; where a clause needs a reading, §0 records it.

Cut from the grid workspace template (Direction §3.2) and re-deciding nothing it settled: the tabs
row is the frame's tool track (s-takeoff I-230), the band under it is the screen's one control band,
the one RefusalState, EmptyState, ErrorState and EvidenceLink are the shipped patterns, and the
shell's one inspector slot stays at width 0 — nothing on this screen is selected, only followed
(R-UI-080). The work surface is a **thread of answers** where the template has a grid.

Files. The engine and its door — `src/modules/takeoff/ask/**` (vocabulary, grammar, the query
registry, the facts an answer is), `src/core/errors/ask.ts`, `src/server/routers/ai.ts`'s `ask` —
are ASK-1a's; the screen — `takeoff/ask/{page.tsx,ask-screen.tsx,actions.ts,route-address.ts,
states.ts,ask.css,loading.tsx,demonstration.ts}`, one entry in `takeoff/layout.tsx`, the lane
caller in `takeoff/lane.ts`, copy at `src/ui/strings/ask.ts` — is ASK-1b's; the Jev arm and the
clarify state's machine half are ASK-2's (§0.3); the sheet-text questions, the J-000 leg and the ⌘K row are
ASK-3's. No pattern is invented, so no gallery entry is added.

## 0. Interpretations

This Decision defines I-395 … I-407 (session 8); each is put to the `refuter` before the first
answer ships.

- **I-395 — R-AI-003's "the model composes the answer from tool results" is read as: the model
  CHOOSES the answer's composition — which query answers the question and about which subjects — out
  of closed lists code built, and code writes the answer.** R-AI-003 binds the composition twice
  over: "from tool results (register queries, sheet text search)" and "never invents numbers —
  every number in an answer is a query result rendered by the formatter". What is left for a model to
  compose, once every number and every citation is a tool result, is the choice of tools and their
  arguments; the sentence around them is the product's own template, in the string table, in the
  product's voice. The live model the product holds, TypeSafe Jev, answers closed questions and
  generates no text (`src/core/model/typesafe.ts`), so this reading is also the only one the product
  can walk without a new provider. **The owner ruled it, session 8's Q4 (the question, "a system-two
  model in the product", is `docs/handoff/session-8-prompt.md` §4.4; the answer is
  `docs/handoff/session-8-ledger.md`, "The owner's rulings", item 4): Ask runs on Jev alone, live in the demo — code
  composes the answer and the formatter writes every figure, Jev routes the paraphrases the grammar
  cannot settle (I-396, I-397), and there is no Claude composer.** The reading stands as an
  Interpretation because the owner accepted it; it was put to the owner before it was recorded, never
  taken silently. "Live in the demo" is carried by DEMO-1 (a per-stage "recorded answer, else live
  Jev" transport, so an unrecorded paraphrase on the demo stage is routed live and ledgered at its
  true cost); verify and every journey replay recorded answers only (L-AI-01), and there an
  unrecorded paraphrase refuses `FIXTURE_MISSING` by name (§1.1 refused). Rejected, by the owner's
  ruling: a Claude call that phrases the answer (session 8's Option B) — it would need a new
  provider key, the live transport choosing its provider by model id, and a Deviation from B-04 and
  the scope fence for a recorder that runs Claude, to buy prose whose semantics no check can hold to
  "every number … rendered by the formatter" (an implied total, an implied scoping). Rejected:
  recording the reading as settled before the owner answered (the critic's point — "do not ship A
  under a silent Interpretation"); rejected: a Deviation, because with the owner's acceptance no
  clause is departed from — every number is still a query result rendered by the formatter, and the
  model still chooses the composition.
- **I-396 — the product's grammar reads a question first; Jev routes only what the grammar
  cannot settle, as a closed choice.** AI proposes, code resolves, a human disposes (CLAUDE.md's
  law), and R-AI-003's formatter clause already makes the answer code's: so the reading is code's
  wherever code can make it, and a model is asked only for the part code cannot. The grammar
  (`src/modules/takeoff/ask/grammar.ts`) matches the question against THIS project's own vocabulary
  — its marks, its level labels and their aliases (I-400), the catalogue's classes and kinds and
  the Dhaka words for them, the note kinds, its sheet numbers and titles, its schedule titles — and
  against each intent's cue words (§1's roster). Exactly one intent with every slot resolved to one
  subject the project holds is ANSWERED with no model call and no ledger row. Anything else is one of
  three outcomes: **clarify** (the human disposes between at most two readings), **Jev's closed
  choice** (I-397), or a **refusal by name**. Jev's answer below the confidence floor ASK-2
  measures on the arm's own composed request is clarify, never an answer. Rejected: citing L-AI-03's
  "a deterministic grammar is preferred where text is vector" for this order — that clause governs
  reading schedules and notes on scans, not routing a question (the critic's law correction).
- **I-397 — routing is a Proposal: it goes through `propose`, and it cites the source keys of
  the candidates its request offered; a question whose candidates carry no key is never put to the
  model.** L-AI-02 makes every model path return `Proposal<T>` with resolved `sources`, and
  `.claude/rules/model-seam.md` restates it for `callModel`. The ask-route request carries the
  grammar's candidates for each slot the question names — a mark, a level, a sheet, a schedule, a
  note kind, a phrase of sheet text — each with ONE defining key read by code: the mark entity of
  the first registered member bearing that mark in the register's own order (level, class, mark), a
  level's first stated reading, a sheet's number text, a schedule's caption, a note kind's first
  reading, a phrase's first hit. Every defining key is an entity key of L-CAD-02's closed scheme set,
  because `parseSourceKey` refuses anything else MALFORMED: a member's placement key (a coordinate on
  its view) is first resolved to its mark entity by the Trace's own member resolution (VD-1), and a
  candidate with no entity key carries none. The arm cites
  the keys of every candidate it was offered (the evidence its reading rests on — the BOQ description
  arm's `keys`, the precedent), resolved against a resolver built over exactly those keys, so a
  NONE_OF_THESE answer still resolves and abstaining stays the caller's (clarify or
  `ASK_NOT_UNDERSTOOD`). **One request answers for ONE drawing.** A resolver names one artifact
  (`sourceKeyResolver(artifactDigest, keys)`, as the BOQ arm builds one per drawing from its
  `artifactSha256`), a source key carries no drawing (`parseSourceKey` admits `scheme:key` alone), and
  a `DXF_HANDLE` is unique within a drawing, never across two — and a project holds F-ARCH beside
  F-RCC6-BNBC. So code picks the request's drawing: the one of the pinned revision on which the most
  of the question's keyed candidates stand, ties to the revision's own sheet order; each candidate
  takes its defining key ON that drawing where its subject stands there, and a candidate standing only
  on another drawing is offered by its label with no key. The resolver is
  `sourceKeyResolver(that drawing's artifactSha256, the keys offered)` (the BOQ server's
  `artifactDigestsOf`, lifted to one home rather than copied), so every cited key names one entity on
  one drawing. (The resolver is amended by I-623: named by the pinned revision, over the keys
  offered.) Rejected: one request per drawing (the model would choose among part of the choice, at
  twice the cost, and two answers would need a reconciliation code does not have); rejected: keys
  qualified by drawing (a new key shape `parseSourceKey` refuses, so an amendment of L-CAD-02's scheme
  set). A question naming no such subject — an intent over a class and a kind alone
  ("how much shuttering do the caps take?"), or none at all — has no key to cite: the grammar's own
  reading answers it, or the two readings its cues score highest are offered to the QS (clarify), or
  it refuses `ASK_NOT_UNDERSTOOD`. **No reading of L-AI-02 is taken, so no `harness:` amendment of
  `model-seam.md` is owed.** Rejected: `callModel` with no sources for the keyless case — it needs a
  refuter-checked reading of L-AI-02 ("routing the reader's own words asserts nothing about the
  drawing") and a `harness:` amendment of the rule; it is reopened only if ASK-2's measured corpus
  shows keyless paraphrases the grammar misreads often enough to matter, and then as its own
  Interpretation with the refuter's verdict. The request carries no UUID, no project id and no
  figure — only the normalised question, the candidates (label and key) in reading order, and the
  roster's digest — so its hash is stable from run to run and a roster change forces a re-record.
- **I-398 — the engine answers FACTS; the screen writes the sentence; the formatter writes every
  number, at the register's own precision.** ARCH-01 bars `src/modules` from `src/ui`, so the engine
  returns structured facts — the intent, the reading, figures as exact decimal strings with their
  unit, kind and places, counts, the records and keys they rest on, each record's (drawing, layout) —
  and never a sentence. The screen (app layer) composes each statement from `src/ui/strings/ask.ts`,
  the one home of Ask's copy (rejected: a mirrored `copy.ts` in the module — a second spelling that
  can drift, which the tree carries elsewhere only as a recorded debt). Every figure is
  `formatUserFigure(statedAt(value, places))`, `places` from `placesOf(kind)` / `placesForUnit`
  (`src/core/documents/kinds/boq-draft-law.ts`) — the precision the register's face and the draft
  BOQ write the same kind at (s-takeoff I-reg-2) — so Ask's "93.893 m³" and the register footer's are
  one figure for the same rows, and a unit test holds them equal. The exact sum is taken in core
  (the canon's `exact`, never a float, never rounded before `statedAt`); a count is an integer. A
  storey height is a figure no kind governs: its STANDING value is stated where the levels grid
  states it, to the millimetre (`HEIGHT_PLACES`, s-levels I-352 (b), lifted from `levels-ui` to one
  home rather than copied), so Ask's GF on F-RCC6-BNBC reads `3.353 m` as the grid does, never
  `3.3528`; each of its READINGS is `formatUserFigure(statedAt(value_as_written, the places it was
  written to))` with a `UnitBadge` of the canon unit its `unit_as_written` names (`unitNamed`) —
  B-07: grouping is the seam's, precision is the writer's (I-401 says why a reading is a figure and
  not a quote). The exact decimal stays on the figure's `data-value`. Ask adds within ONE kind only: two kinds are two
  trades a bill states apart, even where their unit agrees (the register's footer adds every m³ of a
  visible set; filtered to one kind it states Ask's figure).
- **I-399 — no total is taken over a PARTIAL line, and a sum across classes is "measured so far",
  never a total.** L-QTY-02 keeps a PARTIAL_DECLARED line with its omissions, and "a partial faulty
  estimate is more harmful than no estimate". A figure is summed over COMPLETE lines only, and never
  over a line the register withholds as repudiated (s-takeoff I-173). Every PARTIAL line under the
  question is COUNTED beside the figure and its omitted codes are said in words (the registry's
  messages, never the codes); a subject whose lines are all PARTIAL states no figure at all and says
  why; registered objects with no line (a deferred or refused sighting) are counted and named by
  their reason. A question over more than one class answers **Measured so far** and states **This is
  not a total for the building**, naming every (class, kind) standing without a figure and every
  class the catalogue measures that kind on which has no line in this campaign. Over-measurement is
  a hard block, never a disclosure; under-measurement is always a disclosure, never silence.
- **I-400 — "level 5" is a clarify case, never a silent alias; a level alias resolves only to a
  label the project's own stack holds.** R-AI-003's own example ("C3 columns on level 5") is
  ambiguous in Bangladeshi usage: floors are counted above the ground floor (`GF`, `1F` … `5F`), and
  a person counting levels from the ground may mean the fifth of them, `4F`. The alias table:
  - the stack's own label, in any case, with or without a space or dot (`5F`, `5 f`, `G.F.`, `fdn`),
    is that level;
  - "ground floor" / "ground" is the label `GF`; "Nth floor" / "floor N" / "Nth storey" (in digits
    or words, `1st` … `fifth`) is `NF` — the British count a Dhaka drawing uses, the ground floor
    below the first; "roof" is `ROOF`; "foundation" / "footing level" is `FDN`, and a foundation
    object filed under the register's lawful-null `FOUNDATION` slot answers to it too;
  - "level N" / "L N" / "lvl N" is the label `LN` or `LEVEL N` where the stack holds one verbatim;
    otherwise it is **clarify** between `NF` ("level N counted above the ground floor") and the
    stack's Nth storey counted with the ground floor as level 1, each offered only where the stack
    holds it, with **None of these** beside them;
  - an alias the stack does not hold is `ASK_SUBJECT_UNKNOWN`, beneath which the answer lists the
    labels the stack does hold.
  Jev is never asked to settle "level 5": the ambiguity is the QS's, and no model knows which count
  they meant.
- **I-401 — a value is quoted only where the drawing wrote those very characters, and a quote is
  always an EvidenceLink to the entity holding them; a storey height is a figure, never a quote.**
  R-AI-003's "every number … rendered by the formatter" meets values the drawing states in its own
  characters — a note's `3500 psi` (F-RCC6-BNBC's `DXF_HANDLE:1F41` reads `f'c = 3500 psi (24 MPa)
  cylinder`), a lap's `50d`, a schedule cell's `8-20 dia`: those are the drawing's words, not the
  product's numbers, and re-rendering them would be the product restating what the drawing wrote. A
  quote therefore covers exactly two records: a NOTE READING, whose `value_as_written` is a span of its
  note's text after `normaliseNotation` (`%%D` read as `°`), and a SCHEDULE CELL, whose text is stored
  as drawn. A quote is those characters verbatim in the figure face, carrying `data-quote`, and it is
  ALWAYS an `EvidenceLink` (basis TRANSCRIBED) to the entity it was read at, so X-7's "every number
  clickable back to a sheet" holds for quotes too. ASK-1a's unit test holds every quoted value to a
  substring of its cited entity's normalised text; a note reading that respells its value (the
  minimum-hook reader writes `{figure} {unit}` with one space, whatever spacing the note used) is
  quoted only where that test finds it, and is otherwise stated as a figure, as a storey height is.
  **A storey-height reading is never a quote.** Its `value_as_written` and `unit_as_written` are a
  height worked out between two level marks — by the stack's proposal from the `EL` marks (I-293) or
  by the person who transcribed it — and never characters the drawing wrote. F-RCC6-BNBC's GF holds
  `132 in` cited at `DXF_HANDLE:1D90`, whose text is `P.L= +0'-0"` (the rise to 1D92's
  `EL +11'-0"`), and `3.353 m` cited at `DXF_HANDLE:1D4C`, whose text is `1F EL +3.353` (the rise from
  1D4A's `GF EL +0.000`): read back from J-000's store (`storey_height_readings`) and checked with
  ezdxf on `fixtures/rcc6-bnbc/rcc6-bnbc.dxf`, as D-001's own evidence states. Quoting them would put a
  product figure past the formatter (R-AI-003; L-FMT-02 renders a unit from the enum) behind a link
  that lands on text that never states it. So each reading is a figure (I-398: at the places it was
  written to, a `UnitBadge` from its written unit), an `EvidenceLink` (basis TRANSCRIBED) to its
  `source_key`, and the entity's own text stands beside it in the Rows' Clause column — the mark the
  height was read from, in the interface face inside quotation marks, never presented as the height.
  Words the drawing states around a value — a clause, a level mark, a schedule's title, a column
  header — are quoted in the interface face
  inside quotation marks and cited by the place they stand, never set in mono (Direction §1: mono is
  for numbers, codes and keys; a mono word is a C11 defect).
- **I-402 — S-Ask's "conversational panel" is a routed screen: the seventh tab of the takeoff
  lane.** A panel sliding over every screen would be a second right column (R-UI-080 forbids it) or
  an overlay over the work surface it was asked about; the frame's one right column is the
  inspector, which is for a selection. A route is a place Back returns to, which X-7's click needs
  (I-403), and it is one URL the ⌘K palette's "Ask the drawings" row (ASK-3) opens with `?q=`.
- **I-403 — the conversation is kept in the tab, so Back re-asks nothing and bills nothing.** The
  thread lives in the tab's `sessionStorage`, keyed by user, tenant and project, newest first, at
  most 20 answers (the oldest leaves when a twenty-first is asked, and the thread's foot says so).
  Each kept answer holds its facts, its reading and the **stamp** it was read at — the pinned
  revision, the project's newest act and the register's newest published line, which the page reads
  once on arrival. A question in the address (`?q=`) is asked ONCE on arrival and the entry is then
  replaced by the bare route (`router.replace`), so Back, Forward and reload never send it again. An
  EvidenceLink is a bare `<a>` and following it is a real navigation (evidence-link I-178); returning
  restores the thread from the store with no request at all, and the answer the link was followed
  from is scrolled into view wearing the origin mark (the register's I-182 idiom). A kept answer
  whose stamp is older than the page's says **The drawings or the register have changed since this
  was answered** and offers **Ask again**, which re-runs its KEPT READING — the grammar's, the QS's
  choice or the machine's — and never asks a model again. Rejected: re-sending `?q=` on every load
  (a second ledger row, with cost when live, for a question nobody asked twice); rejected: a stored
  conversation (a migration, and a record across devices nobody has asked for — §7); rejected:
  showing a kept figure with no word about its age.
- **I-404 — every figure is an EvidenceLink to the MEMBERS it counts or measures, and the
  answer names one place per (drawing, layout) its evidence stands on.** The viewer selects on one
  drawing and one layout (`selectionAddress`). What a figure selects, and on which sheet, is the
  Trace's own resolution and never a second one (VD-1, this wave: the one sheet resolver `sheetOfKey`
  in `src/core/sheets/frames.ts`; a member's placement key resolved to its outline and mark keys; a
  view key or an `edition:` key never flown to). A figure whose members stand on ONE (drawing, layout)
  links there, selecting every one of them, with no `v` so the viewer flies to them — F-RCC6-BNBC's
  column concrete opens S-10 with the columns selected. A figure whose members stand on more than one
  links to its own answer's evidence row (`#ask-evidence-{answer}`) — one click from all of them and
  never from a part. The evidence row names one **Show on the drawing** place per (drawing, layout)
  any cited key stands on: the members' sheets first, then the sheets the figure's variables were read
  on (a schedule's cell, a storey mark, a note), each place selecting the keys that stand there. A
  record the resolver places on no sheet stands in the Rows with its key whole and no link
  (s-takeoff-register I-181's rule), and is never given a sheet the answer guesses. Where the members
  cited for one level are the members cited for others — a typical plan, as F-RCC6-BNBC's `C3` on
  every storey stands on the one view `20B6` — the answer says so, naming the levels, rather than
  imply storey-specific entities.
- **I-405 — the thread reads newest first under the question band, and an answer is content, not
  helper copy.** The band sits where every takeoff surface keeps its one control band, so the answer
  to what was just asked stands directly under the field, inside §3.2's 240 px of main's top, with
  no scroll; each answer carries its own question, so reading order is never lost. Rejected: a chat
  layout with the field at the foot (the answer lands at the bottom of a scrolled region, and the
  lane's control band would move for one screen). The thread is an ARIA feed of articles; an
  answer's statements are rows of its article, one statement each, and they are the work surface's
  content the way a grid's rows are — §7 C7's count of explanatory paragraphs is not their judge; the
  ux-critic's reading is, and the screen spends no helper line of its own in main.
- **I-406 — asking needs a place on the project, and nothing more.** An answer reads nothing the
  register, the levels, the schedules and the sheets do not already show a participant, and asking
  moves no act (L-ACT-03's permissions are cut on what an act moves). The door therefore authorises
  exactly as the register's tRPC readers do — `authorize({ participation: true })` — and the denied
  state is the reader who is not a participant, refused `PERMISSION_NOT_HELD` by name. The page's
  `authorizePage` does not ask participation, so the page asks `participatesIn` itself (§2 Denied). A model-routed ask
  is a model call attributed to the project and counted on its home (R-AI-005); the grammar-routed
  ones are not model calls and cost nothing.

### 0.1 The engine's readings (ASK-1a)

The facts' contract between the engine and the screen is `src/modules/takeoff/ask/law.ts`: an
answer is `ANSWERED` (its reading, who routed it, whether it followed the previous answer, and the
facts — the statement, what it leaves out, one place per (drawing, layout), the records it rests on,
where it was read from), `CLARIFY` (at most two readings, each a level's with its gloss) or `REFUSED`
(one of §3's five codes, the reading where one was made, and what the project holds beneath
`ASK_SUBJECT_UNKNOWN`). Every figure is `{ value, unit, kind, places, at }` — the exact decimal, the
places the screen states it at, and where its evidence stands (I-404). The engine reads these, each
the most defensible reading of a question this Decision leaves open:

- **I-486 — a quantity asked of a class and no kind is read as the one kind that class's lines
  are of; where they are of two or more, the person chooses between the two holding the most lines;
  a kind asked of no class is that kind measured so far across the classes.** "How much for the
  caps?" on F-RCC6-BNBC holds five kinds of cap line, and no one of them is what was asked. Rejected:
  answering every kind of the class in one statement (that is §1.2's measured-so-far shape, and its
  "not a total" framing misreads a one-class question); rejected: the kind with the most lines, chosen
  silently.
- **I-487 — a count counts every registered object of the class, mark and level that no person
  struck, whatever its sighting standing; a typical plan is read off the register itself.** Where the
  counted objects' placements are registered on two or more levels, they are one member drawn once:
  the facts name the view keys they were placed on, the levels that plan stands for (from the ground
  up) and how many members it draws — F-RCC6-BNBC's six C3 on 5F are the six marks of view `20B6`,
  standing for FDN to 6F. Rejected: reading the typical plan off the partition's typical ranges, a
  second resolution of what the register already records (B-17).
- **I-488 — what an answer leaves out is counted in LINES per code, and an object is "registered
  with no line" only of a kind its class bears.** A PARTIAL line omitting two variables under one code
  is one line under it (F-RCC6-BNBC's beam formwork omits `t_left` and `t_right`, both
  `SLAB_THICKNESS_UNSTATED`: 172 lines, not 344); a column holds no blinding because the catalogue
  measures none on it (`BEARS`), not because it was left out.
- **I-489 — a question naming a subject kind and no subject answers every subject of that kind.**
  "What do the general notes state?" answers every note kind the notes state, grouped by kind; a
  storey-height question naming no level answers every level of the stack; a member-type question
  reads every schedule row holding the mark as a whole token in any cell, so a remark row
  (`C2 GF TO 2ND:`) is the schedule's word about C2 too, and a mark no row names is
  `ASK_SUBJECT_UNKNOWN`, listing the marks the schedules' first column states.
- **I-490 — the sheets in the set are the pinned revision's paper sheets as the sheet index names
  them** — the title block's number and title, the confirmed discipline where one is confirmed, else
  the proposed; a drawing with no paper layout lists its model space.
- **I-491 — a storey-height reading names no drawing, so its cited entity is read on the first
  drawing of the pinned revision that holds the key, in the manifest's order.** A `DXF_HANDLE` is
  unique within a drawing and never across two; a note reading and a schedule cell carry their
  drawing and are read there.
- **I-492 — the grammar's own tie-breaks beside §1.2's.** `strength`, `grade`, `psi` or `MPa`
  beside a concrete word is `f'c`, beside a steel word `fy`, and alone a clarify between the two;
  class words are read before a strength, so "grade beams" are tie beams; "which / what / list …
  sheets" is the sheet list whatever words stand between; a kind asked by mark is a quantity broken
  down by mark; with no campaign open every register intent refuses `ASK_NOT_MEASURED` by name.
- **I-493 — the engine's unit tests read F-RCC6-BNBC's figures off a read-back committed as a
  test fixture, never off constants.** `tests/ai/ask/fixtures/bnbc-readback.json` is one J-000
  project's newest campaign taken READ ONLY off `cubit_e2e` by the `.sql` beside it, with the words of
  every entity a reading cites read off the DXF J-000 ingests; each test derives its expectation from
  the document and holds the proof's faces beside it (6, 93.893 m³, 4 / 14 / 5 / 2 / 1, 4.692 m³), so
  a register move reads as a moved figure. The fixture is re-taken in its own `baseline:` commit when
  M3's register moves (FRM-3, FRM-4, R0). Rejected: the db lane for these (every assertion would stage
  a measured campaign the J-000 journey already stages).
- **I-494 — every subject a question names is read, and none is passed over: a second subject in
  one slot is a second question, a label shaped like the stack's that the stack does not hold is
  unknown, and a question leaving more open than one clarify holds is not understood.** I-396's "every
  slot resolved to one subject the project holds" is read slot by slot, and a word the grammar reads
  as a subject is never dropped for the rest of the question to be answered without it:
  - a word in the stack's own notation — `9F`, `10fl`, `9 f`, and `B2` where the stack spells its
    basements so — that the stack does not hold is `ASK_SUBJECT_UNKNOWN` with the held labels, as
    I-400 rules for an alias; `RF` is the roof; `level 0` counted above the ground floor is the ground
    floor, and counted with the ground floor as level 1 the level below it;
  - two marks, two levels, two classes, two kinds, two note kinds or two disciplines in a slot the
    intent's reading keeps are §1.2's compound question: a clarify of the two readings, the first
    taking the first of each doubled slot and the second the second, so "C3 on 5F and C4 on 6F" pairs
    as said; a mark named once goes with the class that bears it ("C3 columns and pile caps"); measured
    so far over two named classes is each class's quantity; a bare number joined by `and` / `or`, or
    listed beside a counted level, is a level of that count ("floors 5 and 6", "floors 1, 2, 3")
    unless it completes a held mark (`c 3`);
    a mark-shaped word the register does not hold is `ASK_SUBJECT_UNKNOWN` beside a mark it holds as
    much as alone;
  - a range of levels (`GF to 6F`), three subjects in one slot, a compound one of whose readings is
    itself a choice (`level 5` counted two ways, a class of several kinds with none named), and two
    choices at once (two marks and a level counted two ways; two intents and a second subject) are
    `ASK_NOT_UNDERSTOOD` — at most two readings are offered, and a question needing more is never
    answered for one part of it;
  - `length`, `area` and `volume` — and `rft`, `sft`, `cft` — name the unit a class's kind is measured
    in where the question names no kind: "pile length" is the boring in metres, never the concrete;
    where one kind of the class is measured in that unit it is the reading (stated in the Understood
    row), where two, the person chooses between them, and where none, `ASK_NOT_MEASURED`.
  F-RCC6-BNBC's "What is the column concrete on 9F?" answered 93.893 m³, the whole building, and "What
  is the concrete for columns and pile caps?" answered 595.523 m³ measured so far, the piles' 372.849
  folded in: both silent widenings, now refused and a clarify. Rejected: a named-classes filter on
  measured so far (a second reading shape where the compound already exists); rejected: answering a
  range as a by-level breakdown (its total would be the building's, not the range's); rejected:
  collapsing a one-option `level N` clarify into a reading (I-400 puts the count to the person with
  **None of these** beside it, and one held count is still a count the person did not state).

### 0.2 The screen's readings (ASK-1b)

The screen is `takeoff/ask/**`: `page.tsx` (the guard, participation, the arrival read), `ask-screen.tsx`
(the band, the thread, every article), `present.ts` (the facts written as the table's sentences —
pure, graded by `tests/ui/ask/present.test.ts` over the read-back), `thread.ts` (the tab's store),
`states.ts`, `demonstration.ts`, `actions.ts`, `route-address.ts`, `ask.css`, `loading.tsx`; the
arrival read is `src/modules/takeoff/ask/arrival.ts`; the tab's store has one home in
`src/ui/tab-store.ts`. It reads these, each the most defensible reading of what this Decision
leaves open:

- **I-577 — the stamp is an opaque digest of the pinned revision, the project's newest act and
  the campaign's newest published line; a kept answer is stale where its stamp is not the page's.**
  I-403 names the three parts; the page reads them once on arrival (`askArrivalOf`) and states them as
  sixteen hex characters on `data-stamp`, so no id a reader could read stands in the DOM (§6). Every
  human change an answer reads — a level, a height, a transcribed note, a repudiation, a pin — is an
  act (L-ACT-01), and every measured figure is a published line, so a change to anything an answer
  read moves the stamp. "Older" is read as "not the same": the parts are ids, not instants, and any
  difference is a change the reader is owed. A project with no campaign has the stamp `none`.
  Rejected: timestamps on the face (a second clock beside `RelativeTime`); rejected: a digest over the
  register's whole reading (it would read every line on every arrival to learn what three rows say).
- **I-578 — what an answer leaves out states each code's registered message with its remedy as
  the row's Tooltip, and names the registered objects with no line by their marks; no row links to
  where it is settled yet.** §1.1 4 asks for a link to where each code is settled, "read from its one
  home and lifted, never copied". That table is `bbs-ui/workspace.tsx`'s private `SETTLED_ON`, and it
  holds only the rebar lane's five codes — none of the codes Ask meets on F-RCC6-BNBC's register
  (`SLAB_THICKNESS_UNSTATED`, `INTERPRETED_UNCORROBORATED`, …). Lifting it for no code Ask can meet
  would be a move with no reader; the remedy on every row still says where to act (R-UI-020). The
  lineless objects are named by mark beside their lead (J-043: "the partial row names C4"): under a
  quantity and a "why not measured" answer the engine records exactly those objects, so the marks are
  read off the facts, never a second reading. §7 carries the settlement link.
- **I-579 — a door that may not be used is the platform's `disabled`, except the one busy door.**
  The shipped Button owns `aria-disabled` for its own `loading` (a busy door swallows its activation),
  so `ask-submit` wears `loading` while a question is out — `aria-busy` and `aria-disabled` both, as
  §2 asks — and every other door the screen cannot use (offline, answering, a blank field) is
  `disabled`. The field is the core Input and wears `aria-disabled` itself, `readOnly` while offline.
  Rejected: re-wrapping the Button to force `aria-disabled` (a second button).
- **I-580 — a figure whose members stand on no placed sheet links to its answer's Rows.** I-404's
  two targets are one sheet or the answer's evidence row, and an answer placing nothing on any sheet
  has no evidence row. §6's absence — "no figure on an `ask-answer` that is not inside an
  EvidenceLink" — then holds by linking the figure to `#ask-rows-{answer}`, the disclosure listing
  every record it rests on with each key whole (s-takeoff-register I-181's rule).
- **I-581 — "Ask again" sends the kept reading as the person's reading.** I-403 re-runs the kept
  reading and never a model; the door's one lawful way to be handed a reading is `reading` (§6), which
  the engine resolves against the project again and routes `PERSON`, so an asked-again answer's
  Understood row says **your choice**. A kept clarify has no reading and asks its question again; a
  failed article re-sends its question once (§1.1).
- **I-582 — the thread is restored after hydration, and the screen stands `loading` until it is.**
  The server cannot read the tab's store, so the page renders the thread's place as bones and the
  client restores the thread in its first effect, with no request; `data-state="loading"` is what
  `settled()` waits through, so no picture is taken of a thread half-restored. The answer a link was
  followed from is kept beside the thread (`…:origin`) and scrolled into view on return.
- **I-583 — the opening class and ARCH-2's three finishes read as words.** The grammar names the
  opening class and `finish.flooring`, `finish.tiling`, `finish.skirting` (61b04549), so every
  enumerated family of §3 carries them: `opening / openings`; **flooring on {classes}**, **tiling on
  {classes}**, **skirting along {classes}**; and the trades **floor finish**, **wall tiling**,
  **skirting** — a Dhaka bill's own words for the three items (I-541).

### 0.3 The machine's routing (ASK-2)

The routing is `src/modules/takeoff/ask/route-question.ts` (the request, the decoder, the floor, what
a routing becomes), the grammar's `openIntentOf` and `readWithIntent`, the arm
`src/core/model/typesafe-arms/ask-route.ts` (question `ask-route`), the door's caller in
`askTheDrawings`, the recorder `scripts/model-corpus/ask-route.ts` over `tests/ai/ask/paraphrases.json`,
and 60 fixtures in `fixtures/model`. It reads these:

- **I-623 — the machine is asked only where the grammar refuses a question because its INTENT is
  open, and it chooses only the intent and, of two subjects of one slot, the one asked about; the
  grammar completes the reading.** "Anything else" in I-396 is read narrowly: the grammar's own
  rulings — an answer, a clarify, a subject unknown, a range, three subjects in one slot, a cost or a
  judgement refused by name, a level counted two ways (I-400) — are never put to a model. What is
  routed is a question whose words carry no cue the roster reads and that is no follow-up, or that
  cues two intents and leaves a choice beside them (`openIntentOf`). The request is one choice over
  the roster, each intent with its meaning in a QS's words, plus `NONE_OF_THESE`, and — where the
  words name two subjects of one slot — one choice per such slot over those subjects plus
  `NOT_STATED` ("tally C3, not C4" names two marks and asks about one; the grammar cannot read the
  negation). Jev's intent is handed back to the grammar (`readWithIntent`), which completes the
  reading exactly as it completes its own, so a compound or a reading missing its subject is still a
  clarify or a refusal by name. The candidates are the subjects the grammar read, in slot order
  (class, kind, mark, level, note kind, discipline), each with its one defining key: a mark's is the
  mark entity (`placements.mark_key`) of the first registered member bearing it in the register's own
  order, on the first drawing of the pinned revision whose record placed it; a level's is its first
  stated storey-height reading; a class, a kind, a note kind and a discipline carry none. The request
  carries the words (`wordsOf`, joined), the candidates and the roster with its sixteen-hex digest —
  no UUID, no project id, no figure. **I-397's resolver is amended here:** it is
  `sourceKeyResolver(the pinned revision, the keys offered)` — the coverage-cause precedent — rather
  than one per drawing's `artifactSha256`, because the routing's citations are the subjects' own
  defining keys, each read on the drawing its subject stands on, and the answer's evidence is then
  resolved by its query, never by the routing; the per-drawing resolver would lift the BOQ server's
  `artifactDigestsOf` into a second home for a digest nothing reads but a refusal's message. Rejected:
  asking Jev for every slot (the grammar reads subjects; a model re-reading them is a second reading
  of what code already holds); rejected: routing the grammar's clarifies (the ambiguity is the QS's).
- **I-624 — the confidence floor is 0.70, measured on the arm's own composed requests; below it
  the machine asks "Did you mean …" and answers nothing on its word.** Over the 60 paraphrases of
  `tests/ai/ask/paraphrases.json`, recorded live through `scripts/model-corpus.ts` on 2026-09-24
  (jev-1.13.0, 0.002237844 USD for the 60 filed): Jev chose the reading written for **56 of 60
  (93 %)**; the four it missed ("C2 but not C1: the casting figure", "C2 takeoff figure", "enumerate
  the C1 columns standing on GF", "which drawing shows C3") stood at 0.21–0.46; **all 44 routings at
  or above 0.70 were right**, and 16 stand below it. So at or above the floor the routing is answered (`data-routed-by
  ="MODEL"`, the ledger's call id on `data-call`); `NONE_OF_THESE` there stands the grammar's
  `ASK_NOT_UNDERSTOOD`. Below it — whatever Jev chose, none of these included — the article is a
  clarify with the lead `MACHINE` (`ask_clarify_machine`) offering at most two readings: the intents
  in the order of Jev's own probabilities whose reading the grammar completes, beside **None of
  these**; where none completes, the refusal stands. A call stating no confidence is below the floor.
  Rejected: 0.80 (39 answered, the same zero wrong — five more questions back to the QS for nothing
  the corpus shows); rejected: 0.50 (51 answered, the margin over the worst miss 0.04). The floor
  moves only by a re-record whose line `route-corpus.test.ts` re-reads.
- **I-625 — the paraphrase corpus is recorded over J-043's staged register, transcribed.** The
  recorder opens no database, and the request carries the subjects' keys, so the project it asks over
  is committed beside the paraphrases: the staged register's four columns, its level and the handles
  its plan draws the marks at (`DXF_HANDLE:22`–`28` for C1–C4, read back off `cubit_e2e`'s
  `placements.mark_key` for the staged projects on 2026-09-24). GF there carries no storey-height
  reading, so it has no defining key, and a paraphrase naming GF and no mark — a height, the marks
  on a floor — is never put to the model on that register (I-397): every paraphrase names a mark.
  J-043 asks one of them in the running product and replays its recording — the walk is what holds
  the transcription to the stage. The BNBC set's own paraphrases, where levels do carry readings, are
  §7's.

### 0.4 The sheet-text questions, the golden leg and the ⌘K row (ASK-3)

The two sheet-text queries are `queries/schedule-sheet.ts` and `queries/find-text.ts`; the grammar's
shape reading is `sheetTextOf` over `vocabulary.ts`'s `SHEET_TEXT_SHAPES`; the finder is
`textFinderOf` in the module's door, over SRCH-1's `textIndexAt` for each record the pinned revision
was measured on. The proofs are `tests/ai/ask/queries-text.test.ts`; the walk is J-000's
`m4-ask-the-drawings`. They read these:

- **I-676 — a sheet-text question is read by its SHAPE, before any subject, and its words are
  free text.** A schedule asked after with a sheet word or a where ("Which sheet has the column
  schedule?") is `SCHEDULE_SHEET`, named by the words before `schedule` back to the first that names
  nothing; a find ("Find TENSION 50d"), a where-question ("Where is the lift core shown?") or "which
  sheets mention X" is `FIND_TEXT`, searching the words after the opening less those that ask nothing
  of the text (double-quoted words exactly, where the question quotes any). The words ride on the
  reading's `text` slot and are never resolved as a subject, so a word shaped like a mark the register
  does not hold (`C99`) is searched, never refused as unknown; a mark the register holds asked after
  with only its class beside it ("where are the C3 columns?") is searched as the mark alone, which is
  what the plan writes. A where-question that speaks of measurement, unquoted ("Where are the columns
  not measured?", "…without a figure?") asks after the measurement and is left to the intents
  (`WHY_NOT_MEASURED`); quoted, the words are searched. A schedule's entry for a mark with no sheet word ("What size is C4 in the
  column schedule?") stays `MEMBER_TYPE`. `SCHEDULE_SHEET` answers each reconstructed schedule whose
  title holds the words asked whole, in order and adjacent (a pile schedule is never the pile cap
  schedule), placed by its CAPTION on the sheet core's one resolver stands it on — the sheet an
  EvidenceLink selecting the caption, or model space with no link; a name no schedule answers to is
  `ASK_SUBJECT_UNKNOWN` with the schedules the sheets hold. `FIND_TEXT` answers the index's own
  matches (whole words, case-insensitive, in order inside one paragraph, one hit per key), the count a
  figure and each (drawing, layout) a place with its own count; nothing found is an ANSWER
  (`ask_find_none`), never a refusal — the sheets were read and do not say it. Walk-2 read "where is
  C7 drawn?" after a rebar answer as that rebar carried over; the shape is read before any follow-up
  now, so it is a find of `C7`. Rejected: resolving the words as subjects first (a find is for what
  the register does not hold as much as for what it does).
- **I-677 — the machine routes to nine intents, not eleven.** `ASK_ROUTED_INTENTS` is the roster
  less the two sheet-text intents: their argument is free text with no key a routing could cite
  (I-397), and the grammar reads them by shape alone, so the machine is never asked to choose them.
  The roster Jev is sent — and its digest — is therefore the one the 60 recordings of I-624 were made
  over, and they stand unchanged. Rejected: adding the two to the routed roster (a re-record, and a
  choice the machine could only make with no subject to hand back).
- **I-678 — a second question the roster cannot read is never dropped in silence.** Walk-2's
  "how much steel goes into the ground floor columns, and what diameters?" answered the steel and
  said nothing of the diameters. Where a question read as ONE intent carries a joining word, then a
  question word opening words that cue no intent, the whole is `ASK_NOT_UNDERSTOOD` by name, and no
  machine is asked; a second question the roster does read stays I-494's compound clarify, and "and
  what about …" stays a follow-up. Rejected: answering the first part with a disclosure (a partial
  answer that looks whole is the harm the Law names).
- **I-680 — the golden leg asks grammar-read questions from one home, and reads its figures off
  the register as a reader does.** `tests/ai/ask/golden-questions.ts` holds the four questions J-000's
  `m4-ask-the-drawings` asks — a count ("How many pile caps are there?", asked from ⌘K), a quantity
  by storey (the column concrete on GF), a sheet question (the column schedule) and a cost refused
  `ASK_ESTIMATE_NOT_BUILT` — and the unit lane proves over the J-000 read-back that the grammar reads
  each with no model asked. The walk reads what the answers must say off the register screen,
  narrowed as a QS narrows it: the storey's figure against the footer's exact total on GF, the cap
  count against the count line of cap concrete lines — one per registered cap, which the unit lane
  proves on the read-back rather than the walk assuming it. The count's figure is then clicked to the
  foundation plan, where every cap it counts is selected. Rejected: a paraphrase routed by Jev on the
  golden path (its recording would be tied to a register M3 keeps moving; J-043 walks the machine).

## 1. Layout and hierarchy (1440 × 900)

```
┌R─┬──────────────────────────────────────────────────────────────────────────────┐
│▲ │ ws › BNBC Tower ▾ › Takeoff › Ask                              ⌘K ⟳ ✉ ◉     │ 40
│  ├──────────────────────────────────────────────────────────────────────────────┤
│▦ │ Register · Coverage · … · Bar schedule · Ask            Pinned revision a3f9c2 ⎘ │ 32
│▤ ├──────────────────────────────────────────────────────────────────────────────┤
│  │ [ Ask how many, how much, what the notes state, or where something … ][Ask] Clear │ 36
│  ├──────────────────────────────────────────────────────────────────────────────┤
│  │ How many C3 columns are on 5F?                            Asked 2 min ago    │ 20
│  │ Understood as  Count · Column · C3 · 5F                                      │ 20
│  │ 6̲ columns marked C3 on 5F.                                                   │ 24
│  │ They are drawn once, on a typical plan that stands for FDN to 6F.            │ 20
│  │ Show on the drawing   S-10                                                   │ 24
│  │ ▸ Rows (6)                                                                   │ 24
│  │ From the register · Pinned revision a3f9c2                                   │ 20
│  │ ───────────────────────────────────────────────────── hairline ───────────── │
│  │ What is the column concrete, floor by floor?              Asked 5 min ago    │
│  │ Understood as  Quantity · Column · Concrete · by level                       │
│  │ Column concrete: 9̲3̲.̲8̲9̲3̲ m³, from 208 complete lines.                         │
│  │ ┌ Level ──┬─ Lines ┬──── Value ┐                                             │
│  │ │ GF      │     … │        … │  (one row per level, from the ground up)      │
│  │ …                                                                            │
│  │ ◀──────────── the answer's measure, 960 ────────────▶                         │
└──┴──────────────────────────────────────────────────────────────────────────────┘
        (no right column: nothing on this screen is selected, only followed — R-UI-080)
```

Underlined figures are EvidenceLinks. Above the fold: the question band's top is 24 px (the frame's
padding) below the top of main and the newest answer's first line is at 24 + 36 + `--space-4` =
**76 px**, at 1440 × 900 and at 1280 × 800 alike — inside §7 C2's 120. The thread region is main's
whole width below the band and scrolls in its own box: 1344 × 704 of main's 1392 × 804 = **85 %**
at 1440 × 900 and 1184 × 604 of 1232 × 704 = **82 %** at 1280 × 800 (R-UI-080's 55 % counts the
region); an answer's lines stand in a 960 px measure, left-aligned, so a
statement reads as one line and a breakdown table is never stretched across the screen. The page
never scrolls sideways (§7 C10).

| Region | What it holds | Width / height rule | Tokens | State when empty |
|---|---|---|---|---|
| tabs row (frame's track) | the six shipped entries then `takeoff-nav-ask` (`aria-current="page"` here); in `useTakeoffTabsAside`: `ask-revision` — `ask_revision_label` over the pinned `setRevisionId` as an `IdChip`, the revision every answer reads. No primary here: the screen's one primary belongs to the field (s-takeoff I-407) | 100 % × `--toolbar-h` 32 | `--surface-app`, `--ink`, `--ink-secondary`, `--line-accent` | the aside is empty with no campaign pinned |
| question band (`ask-form`) | a `<form role="search">`: the core `Input` `ask-field` (flex, `maxlength` 300, labelled `ask_field_label`, placeheld `ask_field_placeholder`); the ONE primary, core Button `ask-submit` **Ask**; then the ghost Button `ask-clear`, present only while an answer is kept, its hint as its Tooltip | 100 % × 36, one row, never wrapping; controls at `--control-h` | `--surface-app`, `--hairline` beneath it, `--accent` through the Button | the band is absent with no campaign pinned (§2 Empty) — a field that could only refuse is theatre |
| status (`ask-status`) | the offline banner, `<p role="status">` `ask_offline`, house notice chrome; nothing else | 100 % × auto; `display: none` while online | `--state-info`, `--state-info-surface`, `--radius-4` | absent |
| thread (primary, `ask-thread`) | `<section role="feed" aria-label={ask_thread_label} aria-busy>` of `ask-answer` articles, newest first; at its foot, only once the cap is reached, `ask_thread_cap` in 12 px `--ink-muted` | flex: the rest of main, scrolling in its own box; articles in a 960 px measure | `--surface-app`, `--hairline` between articles | `ask-empty` stands in its place |
| empty (in the thread's place) | the shipped `EmptyState` `ask-empty`: heading, one sentence, and one secondary Button `ask-example` that asks a question built from this project's own register | max-width 520, at the thread's head (not centred) | `--ink`, `--ink-muted` | this IS the empty state |
| error (in the thread's place) | `error-state`: heading, one sentence, the report id through `error-state-report`, `error-state-retry` re-reading the route in place | max-width 520 | `--ink`, `--ink-muted`, `--hairline`, `--radius-4` | — |
| inspector (frame's one slot) | nothing ever mounts it here | **absent — width 0** | — | absent |

### 1.1 An answer's anatomy

Each answer is `<article data-testid="ask-answer" aria-labelledby={question id}>`, top to bottom,
every row the product's own composition of the engine's facts (I-398):

1. **Question** — `<h2 data-testid="ask-question">`, the QS's words verbatim, `--text-14` /
   `--weight-heading` (Direction §1's section size), one line, ellipsised with the table's Tooltip idiom where it outruns the
   measure; right-aligned beside it, 12 px `--ink-muted`, `ask_asked_label` and the shipped
   `RelativeTime` (`ask-asked`), read off the app's injected clock.
2. **Understood as** — `<div data-testid="ask-understood" data-routed-by>`: `ask_understood_label` in
   12 px `--ink-muted`, then the reading as words separated by ` · `: the intent (§3's intent words),
   the class and the kind in words (the register's `inWords`; a kind read across classes in its trade
   words, `ask_trade_*`), a mark and a level label verbatim in mono (they are the drawing's codes), a
   sheet number verbatim, a phrase of sheet text in the interface face inside quotation marks. Then,
   where it applies, one qualifier: `ask_understood_machine` when Jev chose the reading (with
   `ask_understood_machine_hint` as its Tooltip — a proposal, not a certainty), `ask_understood_chosen`
   when the QS chose it from a clarify, `ask_understood_follow_up` when the question named only a
   subject and was read against the previous answer, and `ask_understood_unit` when the question named
   a unit the register does not measure that kind in (a `cft` asked of concrete is answered in `m³` and
   says so — §7 owes the conversion). `data-routed-by` ∈ `GRAMMAR` · `MODEL` · `PERSON`; a model-routed
   answer also carries `data-call`, the ledger row's call id, and nothing on its face names the model.
3. **Statement** — `<div data-testid="ask-body">`, `aria-live="polite"` on the newest article's
   alone (a kept answer is not news): one to three statement rows, 13 px body, each one line in the 960 measure and wrapping rather than
   truncating (evidence is never ellipsised behind something a reader cannot open, I-26). Every figure
   is an `EvidenceLink` (I-404) carrying `data-figure`, `data-value` (the exact decimal),
   `data-unit` and `data-places`; its unit follows it as a `UnitBadge`, never inside the link
   (L-FMT-02: a unit renders from the enum, separately from its quantity). A quoted value is an
   EvidenceLink too (I-401). Where the question asks by level or by mark, the statement is
   followed by a **breakdown** — the shipped `DataTable` under the I-171 wrapper `ask-breakdown`,
   28 px rows, frozen first column, sticky header, figures right-aligned through `QuantityText` at
   the kind's places with each figure cell an EvidenceLink, levels from the ground up (the stack's
   ordinal, the foundation first — s-bbs I-354(a)'s order), marks in natural order (`markOrder`); its
   height is its rows up to 10, then it scrolls in its own box.
4. **Partial** — `<div data-testid="ask-partial">`, present only where the answer rests on less than
   everything under the question: `ask_partial_lines_*` then one row per omitted code — the count, the
   registry's message verbatim, and where it is settled as a link with the registry's remedy as its
   Tooltip (the code → screen table of s-bbs I-354(b), read from its one home and lifted, never
   copied, if Ask needs it outside `bbs-ui`); `ask_partial_objects_*` for registered objects with no
   line, each reason once. 13 px `--ink-secondary`.
5. **Evidence** — `<div data-testid="ask-evidence" id="ask-evidence-{answer}">`: `ask_show_label`, then
   one `<a data-testid="ask-show" data-drawing data-layout data-keys>` per (drawing, layout) the
   answer cites, labelled with the sheet number the drawing states for that layout (the layout's own
   name where it states none — `Model` for model space), in the interface face with `--ink-link` and
   the viewer glyph, a bare `<a>` to `selectionAddress(...)` with every key the answer cites there.
   Absent where the answer cites nothing (a refusal, a clarify).
6. **Rows** — `<details data-testid="ask-rows">` (the platform's own disclosure, its `<summary>`
   wearing the reticle from its one home), summary `ask_rows` with the record count; closed at rest
   and rendered only when opened. Inside, under the I-171 wrapper `ask-rows-table`, one shipped
   `DataTable` of every record the answer rests on — never capped, virtualised by the primitive,
   height up to 12 rows then scrolling in its own box. Its columns by what the records are:
   - **lines** (`tableId` `ask-rows-lines`): Level · Mark · Kind (words) · Value (at the kind's places,
     exact on `data-value`; a PARTIAL line states `{variables} unstated` exactly as the register does,
     I-reg-1) · Source (the register's Trace idiom: the chips of I-234/I-287 on an EvidenceLink to
     `traceAddress`) · Register (`ask_open_in_register` to `originAddress(lineId)`);
   - **objects** (`ask-rows-objects`): Level · Class · Mark · Source (an EvidenceLink to
     `selectionAddress` of the member's own keys on its own sheet, I-404's resolution);
   - **readings** (`ask-rows-readings`, notes and storey heights): Sheet · What (the note kind or the
     level in words) · Value (for a note, the quoted EvidenceLink; for a storey height, a figure — the
     EvidenceLink over `formatUserFigure(statedAt(value_as_written, its written places))` with its
     `UnitBadge` after it, exact on `data-value`, never `data-quote`, I-401) · Clause (the cited
     entity's own words, interface face inside quotation marks, ellipsised with the Tooltip — for a
     storey height the level mark it was read from, `“P.L= +0'-0"”`, never the height);
   - **cells** (`ask-rows-cells`): Schedule · Row · Column · Value (the quoted EvidenceLink);
   - **hits** (`ask-rows-hits`): Sheet · Text (the drawing's words, interface face) · Source (an
     EvidenceLink to the hit);
   - **sheets** (`ask-rows-sheets`): Sheet (an EvidenceLink to the layout, no selection) · Title ·
     Discipline (words through `EnumLabel`).
7. **Basis** — `<div data-testid="ask-basis">`, 12 px `--ink-muted`: where the answer was read from
   (§3's `ask_basis_*`) and `ask_revision_label` with the revision's `IdChip`.
8. **Stale** — where the kept stamp is older than the page's (I-403): `<div data-testid="ask-stale">`
   `ask_stale` in `--ink-secondary` with the ghost Button `ask-again` **Ask again**.

`ask-answer` carries `data-answer` ∈ `answering` · `answered` · `partial` · `clarify` · `refused` ·
`failed`, `data-intent`, `data-routed-by`, `data-stamp`, and `data-origin="true"` on the one a link
was followed from. The article a link was followed from wears the register's origin mark — a 2 px
inset bar of `--line-accent` on its start edge — until another is followed.

The other shapes an article takes:

- **answering** — the question row, then three Skeleton lines (13 px: 60 %, 80 %, 40 % of the
  measure); `aria-busy="true"` on the feed; the field and every `ask-reading` / `ask-again` are
  `aria-disabled="true"` until it settles — one question at a time, so answers never land out of
  order. Never a spinner (R-UI-004).
- **clarify** — the question row, then `<div data-testid="ask-clarify" role="group"
  aria-label={ask_clarify_lead}>`: `ask_clarify_lead` (or `ask_clarify_two` where the question asks
  two things), then at most TWO secondary Buttons `ask-reading` (`data-reading` the encoded reading),
  each labelled with its reading in words — for the level case the glosses of §3 — and the ghost
  Button `ask-reading-none` **None of these**. `ask-clarify` carries `data-lead` ∈ `AMBIGUOUS` ·
  `COMPOUND` · `MACHINE`; the machine's clarify (I-624) leads with `ask_clarify_machine` and offers
  the readings Jev ranked highest that the grammar completes. Choosing a reading answers it in the same article
  (`data-routed-by="PERSON"`) with no model call; **None of these** stands the article refused
  `ASK_NOT_UNDERSTOOD`.
- **refused** — the question row, the Understood row where a reading was made, then exactly one
  RefusalState from the registered entry with its evidence link, `data-code` on the article; for
  `ASK_SUBJECT_UNKNOWN`, beneath it one `ask-held` row listing what the project does hold of that
  kind of subject (§3's `ask_held_*`), each item in its own face (marks and labels mono, titles in
  words). A model's own refusal (`FIXTURE_MISSING`, `MALFORMED`, `UNSOURCED`, `SOURCE_UNRESOLVED`)
  renders here as registered, never re-worded, followed by a clarify of the grammar's two best
  readings where it has any.
- **failed** — the door threw: the shipped ErrorState inline in the article with `ask_failed_heading`,
  `ask_failed_body`, the report id through `error-state-report` and `error-state-retry` labelled
  **Ask again**, which re-sends the same question once.

### 1.2 The intents, in the QS's words

The roster is closed (`src/modules/takeoff/ask/queries/registry.ts`, one query per intent, a
duplicate-key test). Every intent reads through the register's one reader or its sibling readers —
`registerViewOf`, `schedulesViewOf`, `readingsOnDrawings`, `levelStackOf` / `storeyHeightOf`, the
sheets of the pinned revision and SRCH-1's text index — and never through a SUM of its own (B-17).

| Intent (`data-intent`) | What a QS asks (F-RCC6-BNBC) | What it reads | How it answers |
|---|---|---|---|
| `COUNT` | "How many C3 columns are on 5F?" · "How many piles are there?" | registered objects not repudiated, by class, mark, level | `ask_count` — **6 columns marked C3 on 5F.**; the figure selects the six members on S-10; `ask_count_typical` where they stand on a typical plan; `ask_count_struck` where any were struck |
| `MARKS` | "How many pile caps of each type?" · "What column marks are there?" | the same objects, grouped by mark | `ask_marks` and a Mark · Count breakdown — **PC1 4 · PC2 14 · PC3 5 · PC4 2 · PC5 1**, 26 in all |
| `QUANTITY` | "What is the column concrete?" · "Pile cap formwork, floor by floor?" | COMPLETE lines of one class and one kind (optionally one level) | `ask_quantity` — **Column concrete: 93.893 m³, from 208 complete lines.**; a Level · Lines · Value breakdown when asked by level; the partial rows (I-399); `ask_quantity_none` where no line has a figure |
| `MEASURED_SO_FAR` | "What is the total concrete for the building?" · "How much has been measured?" | COMPLETE lines of one kind across classes, or of every kind | `ask_so_far` then **This is not a total for the building.**, the (class, kind) groups standing without a figure and the classes with no line; a Class · Lines · Value breakdown grouped by kind |
| `WHY_NOT_MEASURED` | "Why do the beams have no quantity?" · "Why isn't column rebar measured?" · "Why is C4 not measured?" | PARTIAL lines (and deferred or refused sightings) of a class, a kind or a mark | `ask_why_*` — **Beam concrete: 172 lines stand without a figure.** — then each code's registered message with its count and where it is settled; a registered object with no line ("C4") is counted and named by its reason |
| `MEMBER_TYPE` | "What size is C4?" · "What are C4's main bars?" | the schedule rows naming that mark (`schedulesViewOf`), cells verbatim | `ask_member_type` then a Schedule · Row · Column · Value breakdown, each value a quoted EvidenceLink to its cell |
| `NOTE` | "What concrete strength do the notes specify?" · "What lap length?" | note readings of that kind, project-wide (N1 has not scoped them by class) | `ask_note` then one row per reading — the value quoted, its sheet, its clause in the drawing's words; `ask_note_disagree` where they state different values, and no value is chosen |
| `LEVEL_HEIGHT` | "What is the ground floor's floor-to-floor height?" | the level stack and the storey height's standing and readings | `ask_level_height` — the standing height at the levels grid's millimetre (**GF: 3.353 m floor to floor.**), then each reading as a figure at the places it was written to, with its unit, linked to the mark it cites (I-401) — F-RCC6-BNBC's GF: `132 in` cited at 1D90, whose text is `P.L= +0'-0"`, the rise to 1D92's `EL +11'-0"`; and `3.353 m` cited at 1D4C, `1F EL +3.353`, the rise from 1D4A's `GF EL +0.000` — one storey in two notations (D-001); `ask_level_height_suspended` / `_none` otherwise |
| `SCHEDULE_SHEET` | "Which sheet has the column schedule?" · "Which sheets carry the door schedule?" | schedule captions, placed on their sheets through the viewport windows (SRCH-1's frames) | `ask_schedule_sheet` — **“COLUMN SCHEDULE” is on S-11.** — the sheet number an EvidenceLink to the caption; `ASK_SUBJECT_UNKNOWN` with the schedules held where none matches (ASK-3) |
| `FIND_TEXT` | "Where is the lift core shown?" · "Find TENSION 50d" | SRCH-1's text index: whole-token, case-insensitive matches over normalised sheet text | `ask_find` — the count, then one place per (drawing, layout) with its count as an EvidenceLink to those hits; `ask_find_none` (an answer, not a refusal) where nothing matches (ASK-3) |
| `SHEET_LIST` | "Which sheets are in the set?" · "List the structural sheets." | the sheets of the pinned revision | `ask_sheets` and a Sheet · Title · Discipline breakdown |

Two further readings are refusals the grammar recognises by their cue words and never routes as
answers: rates, prices, costs, money and time (`ASK_ESTIMATE_NOT_BUILT`), and whether a design is
safe, adequate, sufficient or compliant, or advice about it (`ASK_JUDGEMENT_NOT_OFFERED`, L-AI-03).

**The vocabulary the grammar reads** (ASK-1a's `vocabulary.ts`, one home; each list is data the
unit lane holds to the catalogue's rosters by enumeration, B-19):

- classes: the catalogue's `ELEMENT_TYPES` in words and plurals, with `col`/`cols`, `cap`/`caps` and
  `PC` for pile caps, `footing`, `stair`/`staircase`, `wall` for shear and brick walls where the class
  is not ambiguous;
- kinds: the catalogue's `KINDS` in words, with the words a Dhaka QS uses — `RCC`, `cast concrete`
  (concrete); `shuttering`, `centering`, `form work` (formwork); `rod`, `MS rod`, `steel`,
  `reinforcement`, `bars` (rebar); `earthwork`, `digging` (excavation); `PCC`, `CC`, `lean concrete`
  (blinding); `bored` and `boring`; `brick work`, `masonry`; `plaster`; `paint`;
- units a question may name: the canon's spellings plus `cft`, `sft`, `rft`, `nos`, `nr` — read to
  state `ask_understood_unit`, never converted (§7);
- levels: I-400's table; `storey`, `story` and `floor` are one word;
- marks: every mark the register holds, matched whole and normalised (`C-3`, `c 3` → `C3` only where
  the register holds `C3`), and matched as a token — `C3` never matches inside `PC3`;
- intent cues: `how many`, `number of`, `count`, `nos` (COUNT); `each type`, `by mark`, `what marks`
  (MARKS); `how much`, `volume`, `area`, `length`, `quantity`, `what is the {kind}` (QUANTITY); `total`,
  `altogether`, `overall`, `the building`, `so far` (MEASURED_SO_FAR); `why`, `no quantity`, `not
  measured`, `no figure`, `blank`, `missing` (WHY_NOT_MEASURED); `size`, `section`, `dimension`, `main
  bars`, `ties`, `reinforcement of` (MEMBER_TYPE); `notes`, `specify`, `strength`, `grade`, `f'c`,
  `fy`, `lap`, `hook`, `psi`, `MPa` (NOTE); `height`, `floor to floor`, `storey height` (LEVEL_HEIGHT);
  `which sheet`, `what sheet`, `where is the {schedule}` (SCHEDULE_SHEET); `where is … shown`, `find`,
  `search`, `mention`, `appears` (FIND_TEXT); `which sheets`, `list the sheets`, `drawings in the set`
  (SHEET_LIST); `cost`, `price`, `rate`, `taka`, `Tk`, `৳`, `lakh`, `crore`, `budget`, `estimate`,
  `how long`, `duration` (the estimate refusal); `safe`, `adequate`, `enough`, `sufficient`, `comply`,
  `compliant`, `code check`, `should I`, `recommend` (the judgement refusal).

Where cues overlap, the more specific reading wins, and the rule is code's, never the model's: a
refusal cue outranks every answer (a cost is never answered as a quantity); a MEMBER_TYPE cue beside
a mark outranks a kind word (`C4's main bars` is the schedule's entry, not a rebar quantity); a
MEASURED_SO_FAR cue beside exactly one class reads as QUANTITY (`total column concrete`); and cues
that still name two intents are a compound question, below.

**A word two kinds answer to.** `concrete` alone is read as reinforced concrete (`rcc.concrete`), and
the Understood row says which (across classes, in its trade words, `ask_trade_*`); blinding is PCC and
is its own kind, asked by its own words. Where a QUANTITY or MEASURED_SO_FAR answer over that word
stands on classes that also hold COMPLETE blinding lines in the same unit, it adds `ask_so_far_apart` —
blinding's own figure on its own row, never added to the answer's (I-398). So F-RCC6-BNBC's "total
concrete" states reinforced concrete measured so far at 595.523 m³ with blinding under pile caps stated
apart at 4.692 m³, and a reader who opens the register, whose footer adds every m³ the visible set
holds (600.215 m³, the two together), sees why the two faces differ instead of meeting a contradiction.
These are the session-8 read-back's figures, and both still carry what R0-0's refuter confirmed
(`docs/handoff/session-8-ledger.md`): the pile-cap concrete billed over the pile heads and over the
lift pit inside PC5 (4.67–6.31 m³ over), and the cap blinding billed where the piles pass through it
(0.703 m³ over). They move with the
register's fix; §6's tests read them from the store, so only this sentence goes stale.

**Follow-ups.** A question that names a subject and no intent ("and on 6F?", "what about PC2?") is
read against the previous answer: its reading with that subject replaced, said so in the Understood
row. A question that names neither is read on its own.

**Compound questions.** A question the grammar reads as two intents ("how many C3 columns, and
what is their concrete?") is a clarify offering the two readings; the one not chosen is asked by
asking it.

## 2. States (R-UI-050), ruled cell by cell

`ASK_STATES` in `takeoff/ask/states.ts` = `["loading","denied","offline","error","refused","empty",
"partial","ready"]`; `ask-screen[data-state]` derives through `askStateOf(standing)` in that order,
first holding wins, beside `data-campaign` (absent with none pinned), `data-answers` (the kept count)
and `data-answering="true"` while a question is out. `error`, `refused` and `partial` read the NEWEST
answer; the screen's own read failing is `error` too. The seven R-UI-050 cells are declared in
`src/ui/screen-states/matrix.tsx` under the file route `/t/[tenant]/p/[project]/takeoff/ask`, and
`…/takeoff/ask?__state=<cell>` stands the screen in each — by the screen's own name or by the matrix's
(`refusal` → `refused`, `permission-denied` → `denied`) — through `./demonstration`, which stands a
kept thread of the state named, exactly as `takeoff/boq/demonstration.ts` does.

- **Loading** — `loading.tsx`, frame and tabs row intact: the band as one field bone (flex × 28) and
  one 28 × 64 button bone; the thread as three answer bones (a 14 px bone at 40 %, a 12 px bone at
  25 %, two 13 px bones at 80 % and 60 % of the measure). The aside stays empty until the screen mounts its chip (a route's `loading.tsx` is rendered before the lane's slot has a surface to portal from, I-582). Never a
  spinner.
- **Denied** — not a participant on this project (I-406). The page reads this itself:
  `authorizePage({ tenant, project })` admits any member of the tenant (the register page's own
  call), and its `participation: true` would answer `notFound()`, which is not this cell — so
  `page.tsx` asks `participatesIn(tx, project, userId)` (`@/core/acts`) under `forTenant`,
  as `bbs/page.tsx` asks `permissionsHeld`, and stands the screen denied where it answers false; the
  door's `authorize({ participation: true })` refuses by name regardless. `data-state="denied"`; the band, the
  thread and the aside do not render; the thread's place holds `ask_denied_permission` and
  `ask_denied_holder` over one RefusalState from the registered `PERMISSION_NOT_HELD` entry, evidence
  the project's participants screen — the lane's settled denial (s-bbs I-bbs-1's shape).
- **Offline** — the `ask-status` banner carries `ask_offline`; every kept answer reads on as it stood;
  `ask-field`, `ask-submit`, `ask-example`, every `ask-reading` and `ask-again` are
  `aria-disabled="true"`; the links stay links. Read-only, and honest about it.
- **Error** — the screen's read threw: `page.tsx` reports it once and hands the `faultId` down;
  `error-state` stands in the thread's place with `ask_error_heading`, `ask_error_body`, the id
  through `error-state-report` and `error-state-retry` (`ask_retry`) re-reading the route in place.
  The newest answer `failed` stands the screen `error` with the ErrorState in its own article (§1.1)
  and the rest of the thread intact.
- **Refused** — the newest answer is refused: the one RefusalState in its article (§1.1). Never a
  toast, never a screen-local block (R-UI-020). A question over 300 characters or blank never leaves
  the field (`maxlength`, and the submit is `aria-disabled` on a blank field); a door that is sent one
  anyway answers `REQUEST_MALFORMED`, rendered the same way.
- **Empty** — two truths, each saying why. With a campaign pinned and nothing kept in this tab:
  `ask-empty` with `ask_empty_heading`, `ask_empty_body` and `ask-example` — one question built from
  this project's register (`ask_example_count` over the first object standing on a level of the
  stack, in the register's own order — level, class, mark; `ask_example_sheets` where nothing is
  registered). With no campaign pinned: `ask-empty` with
  `ask_empty_no_campaign_heading` / `_body` and the one action `ask_empty_no_campaign_action` →
  `…/drawings/sets`, the band absent; a `?q=` arriving here is not asked, and the empty state is
  why.
- **Partial** — rendered, never hidden: the newest answer rests on less than everything under the
  question (I-399) and says what it leaves out in its `ask-partial` rows; the figure it states
  stands beside them. A clarify is not partial: it is a question back, and the screen is `ready`.
- **Ready** — `data-state="ready"`.

## 3. Copy, verbatim (`src/ui/strings/ask.ts`, aggregated by `index.ts`)

Placeholders are filled by `fill`; `{count}`, `{figure}` and `{lines}` are figures through the format
seam and each is an EvidenceLink where §1.1 says so; `{class}` is the class's word, singular or plural
by the count it stands beside, and `{classes}` its plural; `{phrase}` is the (class, kind) phrase
below; `{subject}` is that phrase, or the class and the mark (`column C4`) where the question names a
mark and no kind; `{trade}` is a kind in words across classes (`ask_trade_*`, below); `{where}` and
`{marked}` are the fragments below, and a fragment the question did not call for is omitted with the space
before it; a list (`{sheets}`, `{levels}`, `{list}`, `{groups}`) is joined by ` · `. A statement's
first letter is capitalised by the presenter and nothing else is. Plural pairs follow the registry's
`_one` / `_other` form.

**Frame and band.** `takeoff_nav_ask` **Ask** (the seventh tab and `shell-crumb-page`) ·
`ask_revision_label` **Pinned revision** · `ask_field_label` **Ask the drawings** ·
`ask_field_placeholder` **Ask how many, how much, what the notes state, or where something is drawn**
· `ask_submit` **Ask** · `ask_clear` **Clear the conversation** · `ask_clear_hint` **Answers are kept
in this tab until you clear them or close it.** · `ask_thread_label` **Answers, newest first** ·
`ask_thread_cap` **The last 20 answers are kept in this tab.**

**An answer's rows.** `ask_asked_label` **Asked** · `ask_understood_label` **Understood as** ·
`ask_understood_machine` **the machine's reading** · `ask_understood_machine_hint` **A proposal, not a
certainty. If it is not what you asked, ask again in other words.** · `ask_understood_chosen` **your
choice** · `ask_understood_follow_up` **following the previous answer** · `ask_understood_unit`
**answered in {unit}, the unit the register measures this in** · `ask_show_label` **Show on the
drawing** · `ask_rows` **Rows ({count})** · `ask_open_in_register` **Open in the register** ·
`ask_stale` **The drawings or the register have changed since this was answered.** · `ask_again`
**Ask again** · `ask_answering` **Answering** (the feed's busy announcement).

**The intent words** (the Understood row): `ask_intent_count` **Count** · `ask_intent_marks` **Marks**
· `ask_intent_quantity` **Quantity** · `ask_intent_measured_so_far` **Measured so far** ·
`ask_intent_why_not_measured` **Why not measured** · `ask_intent_member_type` **Member type** ·
`ask_intent_note` **General note** · `ask_intent_level_height` **Storey height** ·
`ask_intent_schedule_sheet` **Which sheet** · `ask_intent_find_text` **Find on the sheets** ·
`ask_intent_sheet_list` **Sheets in the set** · and the two slot words `ask_by_level` **by level** ·
`ask_by_mark` **by mark**.

**Classes, in words** — one pair per member of `ELEMENT_TYPES`, enumerated (a test fails a class
with no pair): `ask_class_column_one` **column** / `_other` **columns** · `beam` **beam / beams** ·
`slab` **slab / slabs** · `footing` **footing / footings** · `pile_cap` **pile cap / pile caps** ·
`pile` **pile / piles** · `tie_beam` **tie beam / tie beams** · `shear_wall` **shear wall / shear
walls** · `stair` **stair / stairs** · `lintel` **lintel / lintels** · `brick_wall` **brick wall /
brick walls** · `surface` **surface / surfaces** · `opening` **opening / openings** (I-583).

**A (class, kind), in words** — one phrase per member of `KINDS`, enumerated, the key spelling the
kind with its dot as an underscore (`rcc.concrete` → `ask_kind_rcc_concrete`: no string key carries a
dot, and the enumerating test holds the flattened keys distinct), `{class}` singular and
`{classes}` plural: `ask_kind_rcc_concrete` **{class} concrete** · `ask_kind_rcc_formwork` **{class}
formwork** · `ask_kind_rcc_rebar` **{class} reinforcement** · `ask_kind_piling_bored` **bored
{classes}** · `ask_kind_piling_boring` **{class} boring** · `ask_kind_earthwork_excavation`
**excavation for {classes}** · `ask_kind_pcc_blinding` **blinding under {classes}** ·
`ask_kind_masonry_brickwork` **brickwork in {classes}** · `ask_kind_finish_plaster` **plaster on
{classes}** · `ask_kind_finish_paint` **paint on {classes}** · `ask_kind_finish_flooring` **flooring
on {classes}** · `ask_kind_finish_tiling` **tiling on {classes}** · `ask_kind_finish_skirting`
**skirting along {classes}**.

**A kind across classes, in words** (`{trade}`) — one per member of `KINDS`, enumerated, keyed as
above:
`ask_trade_rcc_concrete` **reinforced concrete (RCC)** · `ask_trade_rcc_formwork` **formwork** ·
`ask_trade_rcc_rebar` **reinforcement** · `ask_trade_piling_bored` **bored piles** ·
`ask_trade_piling_boring` **pile boring** · `ask_trade_earthwork_excavation` **excavation** ·
`ask_trade_pcc_blinding` **blinding (PCC)** · `ask_trade_masonry_brickwork` **brickwork** ·
`ask_trade_finish_plaster` **plaster** · `ask_trade_finish_paint` **paint** ·
`ask_trade_finish_flooring` **floor finish** · `ask_trade_finish_tiling` **wall tiling** ·
`ask_trade_finish_skirting` **skirting**.

**Note kinds, in words** — one per member of `NOTE_KINDS`, enumerated: `ask_note_kind_fc` **concrete
strength** · `ask_note_kind_fy` **reinforcement yield strength** · `ask_note_kind_lap` **lap length** ·
`ask_note_kind_hook` **hook length** · `ask_note_kind_hook_min` **minimum hook length**.

**Statements.** Fragments first: `ask_where_level` **on {level}** · `ask_where_foundation` **in the
foundation** · `ask_marked` **marked {mark}** · `ask_lines_one` **1 complete line** /
`ask_lines_other` **{lines} complete lines**.

- COUNT: `ask_count` **{count} {class} {marked} {where}.** (fragments omitted where the question named
  none) · `ask_count_none` **No {classes} {marked} {where} in the register.** · `ask_count_typical`
  **They are drawn once, on a typical plan that stands for {levels}.** · `ask_levels_range` **{first}
  to {last}** · `ask_count_struck_one` **Not counted: 1 {class} a person struck from the register.** /
  `_other` **Not counted: {count} {classes} a person struck from the register.**
- MARKS: `ask_marks` **{classes} by mark: {count} in all.**
- QUANTITY: `ask_quantity` **{phrase} {where}: {figure} {unit}, from {lines}.** ·
  `ask_quantity_none` **{phrase} {where}: no figure. Every line stands without one.**
- MEASURED_SO_FAR: `ask_so_far` **Measured so far: {trade}, {figure} {unit}, from {lines}.** (one
  kind) · `ask_so_far_all` **Measured so far, by trade:** (every kind) · `ask_so_far_not_total`
  **This is not a total for the building.** · `ask_so_far_without` **Without a figure: {groups}.** ·
  `ask_so_far_absent` **No line in this campaign: {list}.** (the classes, plural) · `ask_group_count`
  **{phrase} ({count})** · `ask_so_far_apart` **Stated apart and not added: {phrase}, {figure} {unit},
  from {lines}.** (also under QUANTITY, §1.2's word two kinds answer to).
- WHY_NOT_MEASURED: `ask_why_one` **{subject} {where}: 1 line stands without a figure.** / `_other`
  **{subject} {where}: {count} lines stand without a figure.** · then each code's row; registered
  objects with no line follow under `ask_partial_objects_*` below · `ask_why_none` **{subject}
  {where}: every line has a figure, and every registered {class} has its lines.** (only where neither
  holds).
- Partial rows: `ask_partial_lines_one` **1 more line stands without a figure:** / `_other` **{count}
  more lines stand without a figure:** · `ask_partial_objects_one` **1 more {class} is registered with
  no line:** / `_other` **{count} more {classes} are registered with no line:**, the objects' marks
  after it (I-578) · each code's row reads `ask_partial_row` **{count} · {message}**, the message
  the registry's own, its remedy as the row's Tooltip; a row whose sighting recorded no reason reads
  `ask_partial_unrecorded` **no reason was recorded** in the message's place.
- MEMBER_TYPE: `ask_member_type` **The schedules state {mark} as:**
- NOTE: `ask_note` **The general notes state the {note}:** · `ask_note_disagree` **They state
  {count} different values, and none is chosen here.**
- LEVEL_HEIGHT: `ask_level_height` **{level}: {figure} {unit} floor to floor.** ·
  `ask_level_height_suspended` **{level}: the drawings state {count} heights, so none stands.** ·
  `ask_level_height_none` **{level}: no storey height is stated.**
- SCHEDULE_SHEET: `ask_schedule_sheet` **“{title}” is on {sheets}.**
- FIND_TEXT: `ask_find_one` **“{text}” appears once on the sheets:** / `_other` **“{text}” appears
  {count} times on the sheets:** · `ask_find_none` **“{text}” does not appear on the sheets of the
  pinned revision.**
- SHEET_LIST: `ask_sheets_one` **The pinned revision holds 1 sheet:** / `_other` **The pinned revision
  holds {count} sheets:**
- Where the answer was read from: `ask_basis_register` **From the register** · `ask_basis_schedules`
  **From the schedules on the sheets** · `ask_basis_notes` **From the general notes** ·
  `ask_basis_levels` **From the level stack** · `ask_basis_text` **From the text on the sheets** ·
  `ask_basis_sheets` **From the sheets of the pinned revision**.
- What the project holds, beneath `ASK_SUBJECT_UNKNOWN`: `ask_held_marks` **{classes} in the
  register: {list}** · `ask_held_levels` **Levels in the stack: {list}** · `ask_held_sheets` **Sheets
  in the set: {list}** · `ask_held_schedules` **Schedules on the sheets: {list}** · `ask_held_notes`
  **The general notes state: {list}** · and, where the unknown mark named no class,
  `ask_held_marks_any` **Marks in the register: {list}**.
- Places and values: a place in model space is named `ask_show_model` **Model space** (§1.1 5's
  "`Model` for model space", in words); a Rows value a PARTIAL line does not state reads
  `ask_value_unstated` **{variables} unstated** (I-reg-1's own words).

**Breakdown and Rows columns.** `ask_col_level` **Level** · `ask_col_class` **Class** ·
`ask_col_mark` **Mark** · `ask_col_count` **Count** · `ask_col_lines` **Lines** · `ask_col_kind`
**Kind** · `ask_col_value` **Value** · `ask_col_source` **Source** · `ask_col_register` **Register** ·
`ask_col_sheet` **Sheet** · `ask_col_what` **What** · `ask_col_clause` **Clause** ·
`ask_col_schedule` **Schedule** · `ask_col_row` **Row** · `ask_col_column` **Column** · `ask_col_text`
**Text** · `ask_col_title` **Title** · `ask_col_discipline` **Discipline**.

**Clarify.** `ask_clarify_lead` **This could mean more than one thing. Choose the one you meant:** ·
`ask_clarify_two` **This asks two things. Choose one to answer first:** · `ask_clarify_machine` **Did you
mean one of these?** · `ask_reading_none` **None of these** · the level glosses, `{label}` the stack's own: `ask_level_reading_floor` **{label} — level
{n} counted above the ground floor** · `ask_level_reading_storey` **{label} — level {n} counted with
the ground floor as level 1**. A reading's button otherwise reads its Understood row's words.

**Screen states.** `ask_empty_heading` **Ask the drawings** · `ask_empty_body` **Ask how many, how
much, what the notes state or where something is drawn. Every figure in an answer links back to what
it was read from on the drawings.** (It promises no more than I-404 gives: a figure whose members
stand on more than one sheet — BNBC's total concrete stands on the views of S-04, S-06 and S-10 —
opens its answer's evidence row, which names each sheet, and never one sheet of them.) ·
`ask_example_count` **How many {classes} marked {mark} are on {level}?** ·
`ask_example_sheets` **Which sheets are in the set?** · `ask_empty_no_campaign_heading` **No campaign
is open on this project** · `ask_empty_no_campaign_body` **Answers are read from the pinned
revision's register and sheets. Pin a drawing set revision, and ask.** ·
`ask_empty_no_campaign_action` **Browse drawing sets** · `ask_error_heading` **The drawings could not
be read** · `ask_error_body` **Nothing was changed. Try again, and quote the report id if it keeps
happening.** · `ask_retry` **Try again** · `ask_failed_heading` **This question could not be
answered** · `ask_failed_body` **Nothing was changed. Ask again, and quote the report id if it keeps
happening.** · `ask_offline` **You are offline. The answers read as they stood, and no question can
be asked until the connection returns.** · `ask_denied_permission` **Asking the drawings needs you
to be a participant on this project.** · `ask_denied_holder` **A project principal can add you on
the participants screen.** · the denial's evidence link, `ask_denied_evidence` **Open the
participants**.

**Registry entries** this door adds, in a new area `src/core/errors/ask.ts` (refusal-state §3's copy
rules bind; the code is never rendered as text; each is `info`, `inline` — refusing a question is not
a fault):

| code | message | remedy | evidence link |
|---|---|---|---|
| `ASK_NOT_UNDERSTOOD` | **This question could not be read as one the register, the schedules, the notes or the sheet text can answer.** | **Ask again naming what you want counted, measured or found — a class, a mark, a level, a note, a schedule or a sheet.** | the register, **Open the register** |
| `ASK_SUBJECT_UNKNOWN` | **This question names a mark, level, sheet, schedule or note these drawings do not hold.** | **Ask again with one they hold — they are listed beneath this answer.** | the register, **Open the register** |
| `ASK_NOT_MEASURED` | **Nothing is measured for what this question asks about: the campaign holds no line for it.** | **Measure the campaign from the register, or see in the coverage grid which classes are not measured yet.** | the coverage grid, **Open the coverage** |
| `ASK_ESTIMATE_NOT_BUILT` | **Rates, prices and costs are not part of this product yet, so there is no figure to give.** | **Ask about quantities, counts and what the drawings state; the draft BOQ lists the measured items unpriced.** | the draft BOQ, **Open the draft BOQ** |
| `ASK_JUDGEMENT_NOT_OFFERED` | **Whether a design is adequate, safe or compliant is the engineer's judgement, and the product does not offer one.** | **Ask what the drawings state — a size, a strength, a lap, a level — and the answer shows where they state it.** | the schedules, **Open the schedules** |

The evidence links' words are keys of this table: `ask_evidence_register` **Open the register** ·
`ask_evidence_coverage` **Open the coverage** · `ask_evidence_boq` **Open the draft BOQ** ·
`ask_evidence_schedules` **Open the schedules**.

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "grammar",
"intent", "slot", "router", "seam", "fixture", "proposal" outside the machine's Tooltip, "Jev" and
every clause id appear nowhere a reader can see; *campaign* is the product's own word for the pinned
run, as the register and the bar schedule already say it. The machine is **the machine**, never a name, never
"AI". Marks, level labels, sheet numbers, figures and quoted values are model data and render
verbatim, figures and codes in mono; the drawing's words (titles, clauses, found text) render in the
interface face inside quotation marks; the revision renders only through `IdChip`; classes, kinds,
note kinds and disciplines render as words.

## 4. Motion (R-UI-004)

Nothing on this screen eases in: an answer that performs before it is read is theatre. The newest
article's bones pulse (the Skeleton's one cycle) while it is answering and are replaced in one frame
when it settles; nothing scrolls by animation — the newest answer is already at the top. The only
transitions are inherited from single homes: the Button and link hover colours and the nav link's
colour over `var(--motion-state)` `var(--ease)`, the `<details>` marker's turn, the Tooltip's own
entrance, the reticle draw from `reticle.css`. The origin mark appears with the page, not after it.
Every duration is a token zeroed at source under reduced motion, so `ask.css` carries no
`prefers-reduced-motion` branch.

## 5. Tokens and themes

Only the semantic alias group and the density/layout tokens (Direction §4.1, §4.2). This screen
spends: `--surface-app` · `--surface-sunken` (the breakdown's and the Rows' sticky headers, through the
primitive) · `--ink` · `--ink-secondary` · `--ink-muted` · `--ink-link` (the Show links) · `--line-accent`
(the current tab, the origin mark) · `--hairline` · `--accent` (only through the Buttons) ·
`--state-info(-surface)` for the offline banner and the RefusalState's own ·
`--space-1/2/3/4` · `--radius-2/4` · `--text-body` · `--text-caption` · `--text-12` ·
`--text-14` · `--font-ui` · `--font-mono` · `--leading-ui` · `--weight-body-medium` /
`--weight-heading` · `--motion-state` / `--ease` / `--motion-reticle`; and, read by the primitives,
`--row-h`, `--cell-px`, `--cell-py`, `--control-h`, `--toolbar-h`; the basis palette only through
EvidenceLink. Px literals, closed set: the band's 36, the answer measure's 960, the empty and error
blocks' 520, the origin mark's and the current tab's 2, and the loading bones (28/64). The hidden
`<h1>` (`takeoff_nav_ask` clipped out of sight, `.cx-ask-name`) states `font-size: var(--text-body)`
(s-bbs I-289). **No copper anywhere**: asking commits nothing.

`ask.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values. Dark is the default and light is complete; both are captured, light by
`emulateTheme(page, "light")` inside the dark lane. Contrast on the founder values in both: `--ink`
and `--ink-secondary` on `--surface-app` clear 4.5:1; `--ink-muted` clears 4.5:1 for the caption rows;
`--ink-link` clears 4.5:1; the EvidenceLink's own facts hold (I-176). Nothing carries meaning by
colour alone: a figure link has its rule and its basis glyph, a stale answer says so in words, the
origin mark is a bar beside a heading the reader just left (R-UI-060).

## 6. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/takeoff/ask` (`askRoute(tenantId, projectId, question?)` in
`takeoff/ask/route-address.ts`, the one spelling — the ⌘K row composes through it; crumbs in
`routes.ts`, `shell-crumb-page` reads **Ask**) and the file route `/t/[tenant]/p/[project]/takeoff/ask`
(the matrix key). Linked: the viewer through `selectionAddress` / `traceAddress`, the register through
`originAddress`, `…/takeoff/coverage`, `…/takeoff/boq`, `…/takeoff/schedules`, `…/takeoff/levels`,
`…/drawings/sets`, `…/settings/participants`. Reads: `registerViewOf`, `schedulesViewOf`,
`readingsOnDrawings`, `levelStackOf`, `storeyHeightOf`, SRCH-1's text index. The door: `ai.ask`
(a mutation — it may write a ledger row) through `authorize({ participation: true })`, its input one
zod schema `{ projectId, question (1–300 characters, trimmed), reading?, previous? }` where `reading`
(a clarify's choice or a kept reading re-run) and `previous` (the reading a follow-up is read against)
name subjects by the project's own labels and are RESOLVED by the server, never trusted — a label the
project does not hold is `ASK_SUBJECT_UNKNOWN`. It answers the facts of §1 and never a sentence.

Test ids, added to `src/ui/testids.ts` by ASK-1b (the integrator merges the registry): `takeoff-nav-ask`
· `ask-screen` (`data-state`, `data-campaign`, `data-answers`, `data-answering`) · `ask-revision` ·
`ask-form` · `ask-field` · `ask-submit` · `ask-clear` · `ask-status` · `ask-thread` · `ask-answer`
(`data-answer`, `data-intent`, `data-routed-by`, `data-call`, `data-stamp`, `data-code`,
`data-origin`) · `ask-question` · `ask-asked` · `ask-understood` (`data-routed-by`) · `ask-body` ·
`ask-breakdown` · `ask-partial` · `ask-evidence` · `ask-show` (`data-drawing`, `data-layout`,
`data-keys`) · `ask-rows` · `ask-rows-table` · `ask-basis` · `ask-stale` · `ask-again` · `ask-clarify`
(`data-lead`) · `ask-reading` (`data-reading`) · `ask-reading-none` · `ask-held` · `ask-empty` · `ask-example`. Used
and never redefined: `evidence-link` (a figure is `ask-answer evidence-link[data-figure]`, carrying
`data-value`, `data-unit`, `data-places`; a quote carries `data-quote`), `refusal-state`,
`error-state`, `error-state-report`, `error-state-retry`, `empty-state`, `skeleton`, `id-chip`,
`unit-badge`, `datatable`, `datatable-row`, `shell-crumb-page`, `shell-main`, `takeoff-nav` and its
six elder entries.

Behavioural hooks without new ids: `role="search"` on the band; `role="feed"` and `aria-busy` on the
thread, `<article>` per answer; `aria-live="polite"` on the newest `ask-body`; `role="status"` on the
offline banner; `aria-disabled` on every door while offline or answering; `cx-reticle` on every
focusable; the asserted absences — no inspector and no second right column; no `select`; no uuid,
digest or `DXF_HANDLE:` text node outside an `IdChip`, an EvidenceLink's `data-key` or a Technical
disclosure; no figure on an `ask-answer` that is not inside an EvidenceLink; no sum over a line whose
coverage is not COMPLETE; no ledger row for a grammar-routed or a restored answer.

Suites. Unit (ASK-1a, `tests/ai/ask/`): `grammar.test.ts` (the vocabulary over a register shaped as
F-RCC6-BNBC reads back — `C3` is never matched inside `PC3`; "level 5" is a clarify offering `5F` and
`4F`; an alias resolves only to a held label; the two refusal cue sets); `queries.test.ts` over the
read-back's own figures, never constants spelled twice — C3 on 5F is 6 and cites the six marks of the
one typical plan (view `20B6`) with the typical-plan statement; column concrete states **93.893 m³**;
PC1–PC5 are 4 / 14 / 5 / 2 / 1; blinding states 4.692 m³ from 12 lines with 14 PARTIAL counted and
none summed; `answer.test.ts` (a figure's face equals the register footer's face for the same rows;
no sum across kinds; a repudiated line never summed; GF's standing height states `3.353` as the levels
grid does, and its two readings are figures — `132` in and `3.353` m, each with its unit and its
source key, neither carrying `data-quote`; every quoted value is a substring of its cited entity's
normalised text, and a note reading that is not one is stated as a figure); `registry.test.ts` (one query per intent, the
duplicate-key test, every class, kind and note kind with its words); the db-lane
`ask-door.test.ts` (a non-participant refused `PERMISSION_NOT_HELD` by name; a blank or a 301-character
question `REQUEST_MALFORMED`; a grammar-routed ask writes no model-call row). ASK-2 (§0.3):
`route-corpus.test.ts` — the recorder composes what the door composes and every paraphrase is one the
machine is in fact asked; all 60 replay through the seam's fixture transport as Proposals, with no
`FIXTURE_MISSING`, `UNSOURCED` or `MALFORMED`; the request's key set is `candidates`, `question`,
`roster` and carries no uuid; the measured line is re-read off the recordings (56 of 60 agree, all 44
at or above 0.70 right); a confident routing is the grammar's reading routed MODEL with its call id; a
routing below the floor is a `MACHINE` clarify of two; a sure `NONE_OF_THESE` is `ASK_NOT_UNDERSTOOD`;
an answer off the offered options is refused, never read. `src/core/model/typesafe-arms/ask-route.test.ts`
holds the arm (recognised by its own key set, nothing posted without a keyed candidate, a slot question
only for a doubled slot, every keyed candidate cited once) beside the registry's duplicate-key test. UI (ASK-1b,
`tests/ui/ask/`): the article anatomy over facts fixtures; the thread kept in the tab's store and
restored with no request; `?q=` asked once and replaced; a kept answer with an older stamp states
`ask_stale`; the matrix's seven cells (`tests/screen-states/**`).

Journey **J-043** (ASK-1b), `tests/e2e/journeys/j-043-ask.spec.ts`, every title carrying **J-043**,
page object `tests/e2e/pages/s-ask.page.ts`, staged by `tests/e2e/takeoff/ask-stage.ts`'s
`stageAsk` over `stageRegister(page, { label })` — which VD-1 restaged to production key shapes: the
plan draws each column's outline and mark as real entities and the lines cite the member's placement,
so a figure's link selects entities the viewer holds and needs no `cite` of its own. The stage reads
back, through the register's own reader and the canon's exact arithmetic, the column concrete the
walk compares with. It walks, within 90 s:
(1) the empty state and its example; (2) **"How many C1 columns are on GF?"** — answered by the
grammar, figure `1`, its EvidenceLink followed to the viewer, which flies to the member
(`data-flyto-flight` ≥ 1, nothing missing — VD-1's own read), then Back: the thread stands as it was,
the article wears the origin mark, and no `ai.ask` request is sent;
(3) **"What is the column concrete?"** — the figure equals the register footer's face for the same
three lines, and the partial row names C4, registered with no line while it awaits corroboration;
(4) **"How many C1 columns are on level 1?"** — a clarify whose held reading is `GF`, chosen, answered
`PERSON`-routed; (5) **"What will the column concrete cost?"** — refused `ASK_ESTIMATE_NOT_BUILT`
with its evidence link to the draft BOQ; (6) **"tally up the C3 columns on GF"** (ASK-2) — no cue the
grammar reads, so Jev routes it from its recorded fixture: answered `1`, `data-routed-by="MODEL"`, a
`data-call` naming the ledger row, the Understood row qualified **the machine's reading**. Checkpoints **s-ask/thread** (dark),
**s-ask/thread-light** and **s-ask/empty**, serious/critical axe 0 and moderate held to the budget,
never widened; baselines `tests/e2e/baselines/design-dark/s-ask/{thread,thread-light,empty}.png`,
`masks()` over the shell breadcrumb, `shell-user`, `shell-tenant-switcher`, `ask-revision` and every
`ask-asked`. Because the seventh tab moves every takeoff-lane picture, the gate re-takes
`design-dark/{s-takeoff,j-021-column-slice,j-022-coverage,j-031-levels,s-schedules,s-boq,s-bbs}/**`
and the J-000 legs' takeoff pictures in their own `baseline:` commit naming the seventh tab as the
proof. The J-000 leg `m4-ask-the-drawings` (ASK-3) walks the BNBC set with grammar-routed questions
only — a count, a quantity by storey, a sheet question, a click to the drawing and one named refusal —
its figures read from the store, never constants, so no model fixture is tied to a register M3 keeps
moving.

Traceability: R-AI-003, J-043 and X-7 move from `none` with the slices that walk them; R-SPINE-052 and
R-TO-016 move with SRCH-1, not with this screen.

## 7. Recorded IOUs (owner named, never a comment in `src/`)

- **Live Jev on the demo stage** (I-395, the owner's Q4). Until DEMO-1's per-stage "recorded
  answer, else live" transport lands, the demo stage replays only (`CUBIT_MODEL_FIXTURE_ROOT`,
  `scripts/lib/stage.mjs`), so a paraphrase nobody recorded refuses `FIXTURE_MISSING` there; the
  grammar-routed questions answer on stage regardless, because they call no model. Owner: DEMO-1,
  which also separates live from replayed spend on the project home (R-AI-005).
- **The BNBC set's own paraphrases.** The ask-route corpus is recorded over J-043's staged register
  (I-625), so on the BNBC project a paraphrase naming, say, PC3 or 5F is a request nobody
  recorded and refuses `FIXTURE_MISSING` in replay. The J-000 leg asks grammar-read questions only
  (I-680), so it did not need them, and the route corpus still holds no `LEVEL_HEIGHT` paraphrase
  (J-043's GF carries no storey-height reading). Owner: the next Ask increment — a paraphrase set over
  the BNBC register, its mark and level keys read back off `placements` and the stack (the recorder
  transcribes them as I-625 does), recorded through the same script, `LEVEL_HEIGHT` among them.
- **A model's refusal followed by the grammar's two best readings** (§1.1 refused). A seam refusal
  reaches the door and renders as registered; the clarify after it is not built, because the grammar
  holds no ranking of intents for words that cue none. Owner: the node that gives the grammar one.
- **A figure that opens the register on exactly its rows.** The register's filters are screen state,
  so a summed figure links to the sheet or to its own evidence row, not to the register filtered to
  what it summed — where the footer would restate the same figure. Owner: the register's node — an
  addressable filter (`?class=&kind=&level=&coverage=`) whose unknown value narrows to nothing, never
  widens to all; then a summed figure links there.
- **A unit the QS names.** `cft`, `sft`, `rft` are read and answered in the register's unit with the
  Understood row saying so. Owner: the format seam's node — a display conversion through the canon,
  stated at a precision the Decision rules, never a second figure the register does not hold.
- **The estimate's questions** ("why is item 07.9 unpriced?", R-AI-003's third example). Owner: M6 —
  the estimate module adds its own intents, composed in `src/server`, and `ASK_ESTIMATE_NOT_BUILT`
  retires for what it answers.
- **Item descriptions and comments as searchable text** (R-SPINE-052's other two sources). Owner:
  SRCH's successors; this screen reads the index it is given.
- **A model-space hit selected on its paper sheet.** Until the walk proves the viewer selects a
  model-space key through a viewport window, a model-space place links to model space and names the
  framing sheet in the Rows. Owner: SRCH-1 and the viewer's node.
- **A conversation kept across tabs or devices.** Needs a store and a migration; nobody has asked for
  it. Owner: a later node, if a QS does.
- **Where each code a partial answer states is settled, as a link** (I-578). The code → screen
  table is `bbs-ui/workspace.tsx`'s private `SETTLED_ON`, holding the rebar lane's codes only. Owner:
  the node that lifts it to one home under `src/core/errors` and extends it to the register's codes
  (`SLAB_THICKNESS_UNSTATED` → the levels or the schedules, `INTERPRETED_UNCORROBORATED` → the
  register's queue); then every partial row links there with its remedy as the Tooltip.
- **Two roundings of one figure** (found here). The register's face states a figure half-up on the
  text (`statedAt`) and the draft BOQ's emission sums with `ROUND_HALF_EVEN` (`boq/emission.ts`
  `sumAt`); on an exact tie the two faces of one figure would differ in the last place. Ask follows
  the register. Owner: the BOQ's node — one rounding, one home (B-17).
