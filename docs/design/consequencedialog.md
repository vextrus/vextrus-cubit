# Design Decision — ConsequenceDialog: the effect slots

Not a routed screen: the two **effect slots** the one preview → confirm pattern
`src/ui/patterns/consequence-dialog` grows in inc-205-scale-ui so an affirmation can preview what
R-TO-020 requires it to preview — *lines that re-derive, signatures that void* — before
`AFFIRM_SCALE` commits. First consumer: S-Scale's affirm footer (`docs/design/s-scale.md` §1,
I-157). Law: R-TO-020, R-UI-021, R-UI-020, R-UI-010, R-UI-001/003/004/012/050, L-ACT-02, B-17,
B-20, C-05, Q-11.

**Relation to `docs/design/consequence-dialog.md`.** That file is the pattern's history and rules
every part of the dialog this increment does not touch — Dialog primitive chrome, act-type
overline, title, hint, subject rows, digest line, stale notice, refusal slot, footer, the
`consequence` / `pending` / `stale` / `refused` / `committing` states, and Interpretations I-40–I-46
and I-161/I-162, which stand unchanged and are not restated here as a competing text. **This file is
normative for the effects block**: its DOM, copy, typography, motion, tokens and test hooks. Where
the two speak of the same element they say the same thing; a disagreement is a defect in this file,
since the pattern's home is the older ruling. No third home for the slots exists (B-17). Every
convention of the earlier Decisions binds: `cx-` classes, tokens-only colour and motion, no
`[data-theme]` selector in authored CSS, copy by key from `src/ui/strings/consequence-dialog.ts`,
model values verbatim in mono, identifiers whole. Files: `consequence-dialog.tsx`,
`consequence-dialog.css`, `src/ui/strings/consequence-dialog.ts`. Props are unchanged — `open`,
`actType`, `preview()`, `commit({ consequenceDigest })`, `onOpenChange`, `onCommitted`: the slots
arrive in the server's Consequence, never as a prop.

## 0. Interpretations (numbering continues the highest recorded, I-162)

- **I-163 — the effects belong to the act, not to a subject row.** One pair of slots renders once,
  under the whole subjects list, even when the act names eight views. A line re-derives because the
  act happened, and the seam answers one `effects` for one preview; per-subject slots would invent a
  breakdown the server did not compute and would read as eight separate acts. Rejected: nesting the
  `<dl>` inside each `<li>`.
- **I-164 — the ids are the count.** R-UI-021 asks for "counts of rows affected, signatures voided";
  the slot answers with the identifiers themselves, whole and space-separated, because an enumerated
  set is its own count *and* is traceable — a reader can carry an id to the register, and cannot
  carry a bare integer anywhere. No count prefix, no "and 3 more", no truncation: the value of each
  `<dd>` is exactly what the seam sent, so `consequence-effect-lines` may be compared character for
  character (the digest's I-43 rule, applied to evidence).
- **I-165 — empty effects never disarm the confirm.** `effects: { linesRederiving: [],
  signaturesVoiding: [] }` is a full answer: the act still changes its subjects, which is what
  `ACT_CHANGES_NOTHING` guards. Both slots read **none** and the confirm stands exactly as it stands
  for any consequence. Rejected: treating two empty lists as nothing-to-do — an affirmation over
  views that carry no quantity line yet is precisely the first affirmation a project makes.
- **I-166 — a long consequence scrolls in the primitive, and adds no height of its own.** The
  effects block sets no `max-block-size` and mints no literal; overflow is the shipped Dialog
  Content's, one home. Eight subject rows plus two filled slots therefore scroll as one body, with
  the footer's confirm reachable by keyboard the whole way (Q-11).

## 1. Layout and hierarchy

The effects block is the last thing said about *what changes*, immediately before the digest line
and the footer — the reading order R-TO-020 itself uses: subjects, then lines, then signatures, then
the digest a person is about to carry. It recedes below the subject rows (a 12 px label column, no
fill of its own) and dominates nothing; the confirm and its copper dot remain the only bright
element in the dialog.

```
  <ul class="cx-consequence-subjects"> … one <li> per subject … </ul>
  [effects]                              — mounted only when the preview carries `effects` (I-161)
    <h3 class="cx-consequence-effects-heading">What follows from this</h3>
    <dl class="cx-consequence-effects">
      <dt>Lines that re-derive</dt>
      <dd data-testid="consequence-effect-lines">…ids… | none</dd>
      <dt>Signatures that void</dt>
      <dd data-testid="consequence-effect-signatures">…ids… | none</dd>
    </dl>
  <p class="cx-consequence-digest"> … </p>
```

- **Placement** — `var(--space-4)` above, `border-top: var(--hairline)`, `padding-block-start:
  var(--space-3)`. The hairline separates the act's subjects from its consequences; no fill, no
  radius, no shadow.
- **Heading** — `<h3>` `consequence_dialog_effects_heading`, `var(--text-12)`
  `var(--weight-body-medium)` `var(--graphite-900)`. A real heading, not a bold paragraph: the
  dialog's outline reads title → this, and a screen reader can jump to it.
- **The `<dl>`** — `display: grid`, `grid-template-columns: auto 1fr`, gap `var(--space-1)`
  `var(--space-3)`; exactly two rows, always in this order (I-163): lines, then signatures.
  Term first, value beside it, both baseline-aligned.
- **Terms** — `consequence_dialog_effects_lines` and `consequence_dialog_effects_signatures`,
  `var(--font-ui)` `var(--text-12)` `var(--graphite-600)`. The label sits in the `<dt>`, outside the
  testid element, so each `<dd>`'s text is the value alone (I-164).
- **Values** — `var(--font-mono)` `var(--text-12)` `var(--graphite-900)`, `font-variant-numeric:
  tabular-nums slashed-zero`, `overflow-wrap: anywhere`, `user-select: all`, left-aligned; ids
  joined by a single space in the order the seam sent them, never sorted, never elided.
- **An empty list** renders `consequence_dialog_none` in `var(--font-ui)` `var(--graphite-600)` —
  the same prose the empty role list uses (I-162), never `0`, never `—`. A stated nothing is what
  R-TO-020 asks a preview to show, and an omitted line would be silence in front of a commit
  (R-UI-020).
- **Lifetime** — the slots stand with the consequence: they mount with it, unmount with it while a
  preview is pending, refused or superseded, and re-render with the fresh one. They are never
  rendered beside skeletons and never outlive a digest.

**The `AFFIRM_SCALE` paint** (the first consumer, and what `j-020-scale/affirm-open` pictures):
overline `AFFIRM_SCALE` verbatim; one `consequence-subject-row[data-subject={viewKey}]` per checked
member, its label the view key whole in mono, **Before** `none` (or the outgoing calibration key)
and **After** the incoming calibration key; then this block, both slots reading **none** while no
quantity line and no signature exist in the project; then the digest line; then Cancel and the act
Confirm carrying `data-digest`.

## 2. States (R-UI-050, as the slots see them)

A pattern, not a screen: the seven screen rows are declared by the consumer — for this increment in
the viewer route's `states.ts`, which S-Scale §2 rules. The dialog's own enumerable states are
`closed · pending · consequence · stale · refused · committing`, all reachable through props and
injected functions. `consequence` keeps two paints, never two states (I-161): **with** the block
when the preview carried `effects`, **without** it when it did not — the presence of the field,
never a prop, which is what keeps every act that shipped before inc-205 byte-identical.

- **Loading** — `pending`: subjects and digest are Skeletons, and the effects block is absent
  entirely. No skeleton is minted for it: its height is unknown until the seam answers, and a bone
  that guesses two rows would move the footer when the answer has none.
- **Empty** — impossible. Two empty lists are a full answer, rendered as **none** twice (I-165); an
  act that changes nothing is the seam's `ACT_CHANGES_NOTHING` refusal, rendered like any other.
- **Error** — a rejection not wearing the refusal shape is a fault, not a refusal: the dialog
  rethrows it (I-40) and the root error boundary shows retry and the report id. The slots make no
  error surface of their own.
- **Refusal** — one RefusalState in the dialog's refusal slot with code, message, remedy and
  evidence link (R-UI-020, I-40). A *preview* refusal unmounts consequence, effects, digest and
  confirm together — no path to commit stands beside no consequence. A *commit* refusal leaves the
  consequence and both slots standing and the confirm armed: a retry is never disarmed.
- **Partial** — one filled slot beside one reading **none** is the ordinary partial, and both are
  shown: an affirmation that re-derives four lines and voids no signature says exactly that.
  Nothing is hidden because it is empty.
- **Offline** — the consumer guards the act press (S-Scale renders its warn notice and opens no
  dialog on nothing). An already-open dialog whose commit rejects for the connection renders the
  registered refusal in the refusal slot with both slots and the confirm still standing; the
  preview's counts stay on screen because they are what the server last computed, and the stale
  path (I-44) is what corrects them if the project moved.
- **Permission-denied** — `PERMISSION_NOT_HELD` from preview or commit renders as registered in the
  refusal slot, naming the permission and its holders, evidence linking the participants screen; a
  member without `MEASURE` never reaches the dialog, because S-Scale does not render the affirm
  footer for them.
- **Stale** — the notice mounts, consequence and both slots unmount with the digest, `preview()` is
  re-invoked, and the fresh answer re-renders them; slots recomputed to **none** or to new ids are
  the honest report of what changed while the reader was deciding.

## 3. Copy, verbatim (`src/ui/strings/consequence-dialog.ts`, registry append)

`consequence_dialog_effects_heading` **What follows from this** ·
`consequence_dialog_effects_lines` **Lines that re-derive** ·
`consequence_dialog_effects_signatures` **Signatures that void** ·
`consequence_dialog_none` **none** (existing key, reused — I-162).

Three keys, act-agnostic like the rest of the table: no scale word, no view word, no clause id
appears in the pattern's copy. Everything act-specific arrives as data — view keys, calibration
keys, line ids, signature ids — and renders verbatim in mono, never woven into a sentence. Voice:
calm, concrete, professional; present tense about what will be true; no exclamation marks; no build
vocabulary ("seam", "door", "digest computation", "slot" appear nowhere a reader can see, while
"act", "consequence" and "digest" are the product's own user-facing law). Refusal message and remedy
are registry-owned and render as registered.

## 4. Motion (R-UI-004)

The block mounts with the consequence and has **no** entrance of its own — no fade, no height
tween, no stagger between the two rows. An answer arrives instantly; theatre in front of a
consequence reads as persuasion, and a value that fades in reads as a value still being decided.
The dialog's entrance (scrim fade, content fade with 0.98 → 1 scale over `var(--motion-state)`
`var(--ease)`) is the primitive's own and covers this block as part of the content; exit is instant.
Skeleton pulse and the reticle draw live in their single homes. Every duration is a token zeroed at
source under `prefers-reduced-motion`, so `consequence-dialog.css` carries no reduced-motion branch.

## 5. Tokens

`--graphite-600` (terms, and the **none** prose) · `--graphite-900` (values, heading) ·
`--hairline` (the separating rule) · `--space-1/3/4` · `--text-12` · `--font-mono` / `--font-ui` ·
`--weight-body-medium` · `--motion-state` / `--ease` (inherited from the primitive's entrance). No
colour literal, no new px literal: the closed literal set of `consequence-dialog.css` (the two 10 px
lines, 0.12em tracking, the skeleton bones 16 × 360, 12 × 240 and 32 × 96) is unchanged by this
block, and any other literal is a defect. No semantic tint: an effect is a fact, not a warning —
"four lines re-derive" is neither good nor bad news, and colouring it would decide for the reader.
No copper: it stays on the confirm, the one place the law reserves it (R-UI-070's scarcity).

## 6. Themes

`consequence-dialog.css` gains no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001), and the portal keeps the document-root theme. Contrast holds on the
founder values in both themes: graphite-600 on graphite-0 ≥ 4.5:1 (the 12 px terms and the **none**
prose included — size earns no carve-out), graphite-900 on graphite-0 far above it, the hairline as
a non-meaning separator. Nothing here is colour-only: each slot is named by its `<dt>`, and an
absence is the word **none**, so the block survives greyscale and both themes identically.

## 7. Test hooks (closed contract, C-05)

Routes: none. Test ids added by this increment, exactly two, on the elements ruled in §1:
`consequence-effect-lines` and `consequence-effect-signatures` — the two `<dd>`s, each carrying
exactly the seam's value or the one word **none** (I-164). The pattern's five existing ids are
unchanged: `consequence-dialog` (`data-act-type`), `consequence-subject-row` (`data-subject`),
`consequence-digest-line`, `consequence-confirm` (`data-digest`), `consequence-stale-notice`. No
other id is added; the heading and the `<dl>` are found by role and text.

Behavioural hooks without new ids: the **absence of both slots** whenever the preview carried no
`effects` field, asserted rather than assumed (I-161) — this is what keeps the six acts that shipped
before inc-205 rendering the DOM they already rendered; the absence of both slots whenever the
consequence is absent (pending, preview-refused, superseded); the fixed order lines-then-signatures
in document order; `<h3>` as the block's heading role.

Acceptance (jsdom, @testing-library, `src/ui/patterns/consequence-dialog/__tests__`), added to the
pattern's existing suite, which stays green unchanged:

- a preview carrying `effects: { linesRederiving: [], signaturesVoiding: [] }` → both testids
  present, each `textContent` exactly **none**, and `consequence-confirm` present and armed (I-165);
- a preview carrying ids → each slot's text exactly those ids, space-separated, in the seam's order;
- a preview with no `effects` field → neither testid in the DOM;
- a `CONSEQUENCES_NOT_CARRIED` commit rejection → both slots unmount with the digest, then
  re-render from the fresh preview;
- a preview refusal while open → RefusalState in the slot and neither testid in the DOM.

Journey: `j-020-scale/affirm-open` (tests/e2e/journeys/j-020-scale.spec.ts, page object
tests/e2e/pages/s-scale.page.ts) reads `consequence-dialog[data-act-type=AFFIRM_SCALE]` with one
`consequence-subject-row[data-subject={viewKey}]`, both slots reading **none**, and
`consequence-confirm[data-digest]` equal to `consequence-digest-line`; axe serious/critical = 0.
Baselines: `tests/e2e/baselines/design/consequence-dialog-open.png` **does not move** — the gallery
entry's sample preview carries no `effects` field, so the pictured DOM is unchanged and no
re-baseline is taken (B-20 is not engaged for this asset). The gallery entry
(`src/ui/gallery-derivation/entries.tsx`) is likewise unchanged and `missingEntries()` stays empty:
the slots' evidence is the jsdom acceptance above and the J-020 checkpoint, not a new gallery card.
