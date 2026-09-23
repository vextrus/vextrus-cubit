# Design Decision — ConsequenceDialog (the act pattern)

**v22 d0 documentation move (2026-09-11) — one home.** `consequencedialog.md` (inc-205's "effect
slots" Decision) is merged into this file as Part 2 below, verbatim; the pattern now has exactly one
Design Decision, as this file's own preamble always required. **Drift recorded for U1 to fix
(F-uiux §3.2–3.3), in the product, not in these words:**

- *Effects block placement.* Both parts rule `var(--space-4)` above the digest line, `border-top:
  var(--hairline)`, `padding-block-start: var(--space-3)`. Shipped CSS
  `src/ui/patterns/consequence-dialog/consequence-dialog.css` `.cx-consequence-effects-block` carries
  only `margin-top: var(--space-3)` — no hairline, no padding. The committed baseline
  `tests/e2e/baselines/design/consequence-dialog-open.png` froze the code, not the Decision. U1 brings
  the CSS to the Decision and re-baselines under the foundation node's lease.
- *Strings home.* Both parts place `consequence_dialog_effects_*` in
  `src/ui/strings/consequence-dialog.ts`; they live in `src/ui/strings/consequence-effects.ts`
  (exported under the `"consequence-effects"` registry name). U1 either moves the three keys into
  `consequence-dialog.ts` or amends the two references in this file — one of the two, in the same
  commit, so the Decision and the registry agree.
- *Focus on open.* The dialog focuses its container, so a reticle is drawn around the whole body
  (F-uiux §1 #5). The direction (`00-direction.md` §1) rules: focus the first control.

**Amended by DLG-1 (session 8, walk-0 BLOCKS_DEMO — "the ConsequenceDialog speaks QS").** The walk
opened a storey-height preview on the BNBC project and read: an eyebrow `AUTHOR_STOREY_HEIGHT`,
**Before** `none` although GF stood agreed at 3.3528 m, **After** `3.2` with no unit and no word that
GF would suspend, then 52 raw line ids and a 64-hex digest that pushed Confirm ~1,400 px down. The
QS could not tell what the act would do. This amendment makes the dialog say it: the act in the words
its door uses (I-444); each subject's standing before and after, with figure, unit and readings
(I-445); the lines that move counted by class, kind and level, the ids one press away (I-446);
the act's code and the digest in one Details disclosure (I-447); focus back on the door that
opened it (I-448). The body is published on its own as `ConsequenceSummary`, which is what
S-Measure's inline card reuses, and it has its own gallery states (R-UI-011). Where this amendment
and an older line of this file disagree, this amendment rules, and the older line says so in place.
The new behaviour's proof is the pattern's jsdom suites (`consequence-dialog.test.ts`,
`consequence-effects.test.tsx`), the pure seam suite `src/core/acts/__tests__/consequence-words.test.ts`
and the live suite `tests/takeoff/levels-ui/consequence-words.test.ts`.


Not a routed screen: the single preview → confirm pattern `ConsequenceDialog` in
`src/ui/patterns/consequence-dialog` — the one home (B-17) every act flow opens, first
consumed by S-Settings-Participants (this increment, R-UI-011); every later act imports this
component and adds none of its own. Law: R-SPINE-011, R-UI-001/003/004/010/011/012/020/021,
L-ACT-02, B-17, Q-11, Q-17. **Amended by inc-205-scale-ui** (R-TO-020, B-20 — the increment
that widens the pattern owns its Decision) with the two effect slots an affirmation previews:
I-161, I-162, the effects block in §1, three keys in §3, two test ids in §7. The amendment is
additive by construction and re-baselines nothing; this file stays the pattern's one home, so
no second Decision for `ConsequenceDialog` is written beside it. Every convention of the earlier Decisions binds: `cx-` classes,
tokens-only colour and motion, `cx-reticle` solely from its single home, no `[data-theme]`
selector in authored CSS; Interpretations I-1–I-39 remain in force. Chrome comes only from
shipped primitives — overlay Dialog (Content/Title/Close), core Button and Skeleton, the one
RefusalState — plus the `cx-consequence-*` classes this file rules. Barrel `index.ts` exports
`ConsequenceDialog`; props exactly `open`, `actType`, `preview()`, `commit({
consequenceDigest })`, `onOpenChange`, `onCommitted`, and — added by inc-205-scale-ui, optional,
defaulting to the document's body, so every act that shipped before it passes six and renders the
DOM it always rendered — `container` (I-167). Since DLG-1 the barrel also exports
`ConsequenceSummary` (props exactly `consequence`, `digest`), the dialog's body on its own
(I-447). Stylesheet `consequence-dialog.css`.
Strings `src/ui/strings/consequence-dialog.ts` (keys `consequence_dialog_…`, registry
append): pattern chrome, plus one name per act type (I-444) and the words a standing, a count
and a level are said in — every other act-specific word arrives in the Consequence's own data.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-40 — refusals travel as typed rejections; the caller does the lookup.** The prop set is
  closed and the resolved shapes carry no refusal arm, so a refusal is a rejection of the
  injected function. ui stays value-import-free of core (the refusal-state ruling), so the
  dialog cannot call `refusalOf`: the consumer's wrapper rejects with `{ refusal:
  RefusalEntry, evidence: { href, label } }` (types via `import type` only), and the dialog
  renders that entry in its refusal slot exactly as refusal-state §2 composes it, adding no
  chrome. A rejection not wearing that shape is a fault, not a refusal: the dialog rethrows
  it to the error boundary.
- **I-41 — the dialog computes its own preview at every open; before open the screen
  answers, once open the dialog does.** The dialog invokes the injected `preview()` itself
  whenever `open` flips true (and again on staleness, I-44), so what it shows is never older
  than its own opening — that currency is the point of R-UI-021. A consumer that pre-checks
  the same wrapper before opening (S-Settings-Participants does) answers preview refusals in
  its own in-place slot and never opens the dialog on nothing; the dialog's slot serves the
  refusals that arrive while it holds focus. A preview that is refused *while open* (the
  stale re-preview can be) renders in the slot with the consequence, digest line and confirm
  unmounted — no consequence, no path to commit (AC-5).
- **I-42 — the 10 px mono lines are mandated constants.** R-UI-010 fixes the digest line at
  10 px mono and R-UI-003 allows tiny overlines (10 px mono, tracking 0.12–0.14em) as the
  one uppercase exception. No `--text-10` token exists and none is minted: the two 10 px
  values and the 0.12em tracking are px/em literals of core I-1's mandated class.
  *Amended by I-444/d:* the overline is words now, set in the UI face without tracking, and the
  digest stands in the Details disclosure in the 12 px mono the shipped CSS already used; the
  0.12em literal is retired from `consequence-dialog.css`.
- **I-43 — the digest renders whole, and the testid holds exactly it.** A digest exists to
  be compared (s-settings-ruleset I-26): the value renders in full, wrapping
  (`overflow-wrap: anywhere`), `user-select: all`. Its label sits outside the testid element,
  so `consequence-digest-line`'s text is character-for-character the `consequenceDigest` the
  preview answered — AC-5 compares it exactly. *Unchanged by I-447*, which moves where the
  line stands (inside Details), not what it holds.
- **I-44 — a stale digest is answered by re-render, never by a refusal card.** R-UI-021 says
  it itself: "a stale digest re-renders the dialog with what changed." A commit rejection
  whose `refusal.code` is `CONSEQUENCES_NOT_CARRIED` (compared against the registry's code
  union via `import type`, so a renamed code is a compile error) therefore mounts the stale
  notice and re-invokes `preview()`; the registered entry is not rendered. The superseded
  consequence, digest line and confirm unmount at once — a confirm may never stand beside a
  digest the current state does not produce — and skeletons keep the layout until the fresh
  consequence renders. Every other commit rejection renders in the refusal slot with the
  consequence still standing and the confirm still enabled: a retry is never disarmed, and
  the refusal is dismissed by resolving it (R-UI-020).
- **I-45 — the consequence rendering is a total map.** L-ACT-02 makes an act type without a
  rendering a compile error, and this component is where acts render. The body renders by
  exhaustive switch over the typed Consequence's closed arms — today the one shipped arm,
  subjects with before/after role lists. A later act's Consequence arm adds its rendering
  here (owner: that act's increment) or fails to compile; offered-group rendering
  (L-ACT-02's bulk, R-UI-023) arrives with the first grouped act in M2 the same way.
- **I-161 — the effect slots mount exactly when the seam sends them, so every earlier act is
  byte-identical.** (Numbering continues the global chain's highest, s-scale's I-160; the
  amendment is inc-205-scale-ui's, R-TO-020.) `Consequence.effects` is optional in core: a
  preview that carries no `effects` field mounts neither slot and no heading, so the six acts
  that shipped before this one render exactly the DOM they rendered, and
  `consequence-dialog-open.png` is unchanged and is not re-baselined. Rejected: defaulting the
  field to two empty lists in the dialog, which would print **Lines that re-derive — none**
  under acts that re-derive nothing by construction and teach a consequence the act does not
  have. The slots are part of the SUBJECTS rendering, not a second `ConsequenceRendering` arm:
  I-45's exhaustive switch is untouched, because effects say more about the same subjects
  rather than describing a different kind of thing.
- **I-162 — an empty slot says `none`, in the word the pattern already owns.** A slot the seam
  sent but did not fill renders `consequence_dialog_none` — the same prose the empty role list
  uses — because a stated nothing is exactly what R-TO-020 asks a preview to show, and an
  omitted line would be silence in front of a commit (R-UI-020). Rejected: hiding a filled-in
  slot's heading when both are empty; a reader who confirms an affirmation is entitled to read
  that no line re-derives and no signature voids, and to read it in the same place every time.
- **I-46 — the gallery entry renders closed; its sample digest is authored data.** Per
  s-design I-15 an overlay entry renders closed with its trigger reachable; the open paint's
  evidence is not an IOU here but this increment's own committed baseline
  `tests/e2e/baselines/design/consequence-dialog-open.png` (AC-6). The sample's injected
  `preview` resolves authored data (s-design I-18's class): the derivation module computes
  no digest — its fixed 64-hex sample string is sample data like a sample refusal entry,
  never compared to a real digest anywhere.

- **I-167 — a dialog raised from inside a screen may be portalled into that screen's root.**
  (Numbering continues the global chain's highest, consequencedialog's I-166.) The Dialog primitive
  portals to `document.body` so the document root's `[data-theme]` themes it and no ancestor clips
  it, and that stays the default for every consumer. But a screen that raises an act from one of its
  own regions — S-Viewer's scale tab is the first — is entitled to say that the act it raised is part
  of what that screen shows: `container` is handed the screen's root element and the primitive's
  portal lands there instead. Both promises survive it, because the element is inside the same
  document root that carries the theme and the content is still fixed-positioned over the scrim.
  Rejected: a component that reads the nearest region for itself — a dialog guessing where it belongs
  is a rule nobody can see from the call site; and rejected: dropping the portal for everyone, which
  would put every act's DOM at the mercy of whatever ancestor a later screen wraps it in.

- **I-444 — the act is named in the words its door uses; its enum is on no face.** R-UI-082 says
  enum values render as human labels outside a data-technical disclosure, and the walk read
  `AUTHOR_STOREY_HEIGHT` as the first word of the one surface where a person decides. The overline
  is now the act's name — **Record a storey height**, **Affirm a scale**, **Change a participant's
  role** — from one table keyed by the act-type enum itself (`{ [T in ActType]: string }`), so an
  act added to L-ACT-02's map without a name is a compile error rather than an enum on screen. Each
  name is the one the act's own door or screen already uses (the register's **Record a reading**,
  the coverage screen's **Hold out of this bill**); `REPUDIATE_LEVEL` reads **Remove a level**, the
  walk's word, while the stored enum keeps "repudiate". The enum stays where machines read it: on
  the wrapper's `data-act-type` and in Details (I-447). A string no enum member holds — which no
  consumer passes — is said by EnumLabel's one mechanical rule, never raw. The overline is no longer
  `aria-hidden`: it is words now, and it tells a screen-reader user which act the generic title is
  about. Rejected: retitling the dialog per act — the title stays the pattern's one sentence, **What
  this act changes**, and the overline above it names the act, as the spec for this slice rules.
- **I-445 — a subject that stands over competing readings says how it stands, before and
  after.** `ConsequenceSubject.standing` (core, optional) carries, for an act whose kind judges a
  standing, the standing before, the standing after, and the figure the act records: each standing
  is its name off the roster that judges it, the figure it stands at (a decimal string, or null),
  the unit, and the count of current readings. `AUTHOR_STOREY_HEIGHT` is the first act to fill it,
  computed by the same `storeyHeightStanding` the stack is read with — over the level's readings,
  and over those readings with this one appended — so the dialog says exactly what the stack will
  say once the act lands (B-17; the live suite proves it against the stack). The row renders
  **Agreed** `3.3528` `m` / **2 readings** under **Before**, **Suspended** / **3 readings do not
  agree** under **After**, and **This reading** `3.2` `m` beneath both; a first reading reads **Not
  stated** / **No reading yet** before. The figure is the exact metres the standing carries — the
  inspector's rule (I-352 keeps the grid's face at three places; the consequence is what a person
  confirms, so it is never rounded) — through the frame's figure conventions, with the unit as a
  UnitBadge. The field is BOUND by the digest, unlike `subjectLabel`: a reading another person adds
  between preview and commit changes what this act does to the standing without changing its own
  key's before and after, and the person confirmed the standing they were shown (I-44 then
  re-renders it). A subject with no standing digests exactly as before, so no stored act's digest
  moves. Subjects of other acts keep their before/after lists verbatim (their own presentation is
  their act's to add, the same way). Rejected: rewriting `before`/`after` as standings — they are
  what the act writes and what `movesNothing` judges, and a third agreeing reading would then have
  "changed nothing".
- **I-446 — the lines that move are counted as a quantity surveyor counts them; the ids stand
  one press away.** R-UI-021 asks for "counts of rows affected", and R-UI-082 bars UUIDs as body
  text. `ConsequenceEffects.lineGroups` (core, optional) counts `linesRederiving` by class, kind and
  the level the measured object stands on — the bill's own description (`Column · Concrete`), the
  level's label or lawful-null slot, and a count — ordered up the building (the foundation slot,
  then levels by ordinal, then what stands on no resolved level) and then in the bill's
  class-then-kind roster order. It is filled ONCE, by the act seam's `preview` in
  `src/core/acts/index.ts`, for every act whose effects name lines, in the transaction that named
  them — no act spells its own counting. It is digest-blind: the ids are what the person confirms
  and what the commit recomputes; a line's class and kind never change under its id. The lines slot
  renders one row per group — **Column · Concrete** · **GF** · **26 lines** — with **52 lines in
  all** beneath when there is more than one row; a consequence whose effects were not grouped says
  the ids' count alone (**2 lines**); signatures are counted the same way. Each slot keeps its ids
  inside itself, in a closed disclosure (**Line ids**, **Signature ids**), whole, space-separated
  and selectable — each id one unbreakable run, so an opened list reads an id a line rather than a
  UUID broken at its hyphens — so a reader can still carry an id to the register, and the slot's
  text still holds the seam's ids, space-joined (J-031 reads them there). A level slot and a
  standing are said in words off tables keyed by their core rosters' own name types (`LevelSlot`,
  `StoreyHeightStandingName`), as the act names are (I-444): a slot or standing added without
  words is a compile error. An empty slot still reads **none** (I-162).
  *Supersedes I-164* ("the ids are the count"): an enumerated set is traceable, but 52 of them in
  front of Confirm is the wall the walk found, and the Bible asked for counts. **Not built, and
  owed:** each group row was to link to the register filtered to it; the register takes no filter
  in its address today (its filters are screen state, and the register's screen is VD-1's and
  REG-FILT's this wave), so a row carries `data-class`, `data-kind`, `data-level` and `data-count`
  for the door that will link it, and no link that would land on the wrong set.
- **I-447 — what a machine compares stands in one Details disclosure; the body is published for
  inline reuse.** R-UI-021's "confirm … carries the digest, shown as the digest line" is read with
  R-UI-082 (AM-08, the later clause): a 64-hex digest is never body text, and the Bible names a
  data-technical disclosure as where machine values live. The dialog's last block is a closed
  `<details>` whose summary reads **Details** (`consequence-details`); inside, **Act** with the enum
  and **Consequence digest** with `consequence-digest-line` — whole, wrapping, select-all, exactly
  the digest (I-43), `data-technical`. The confirm still carries the digest on `data-digest`, so
  the two can still be compared character for character. `ConsequenceSummary` is the body — subject
  rows, effect slots, Details — as its own export, so a surface that previews an act inline
  (S-Measure's card is the first) reads a consequence in exactly this form and adds none of its own
  (B-17); the dialog frames it. It is not an overlay, so its gallery entry stands open in four
  states (§ 7). Journeys that asserted the digest line visible now open Details first and assert it
  visible there (J-003, the participants walk, J-000's affirm-scale leg) — the same claim, after
  the one press the law now puts in front of it.
- **I-448 — closing returns focus to the door that opened the dialog.** The primitive returns
  focus to its own trigger, and this dialog is opened by a consumer's door rather than a
  `DialogTrigger`, so a close dropped focus onto the body (walk-0; R-UI-060). The dialog notes what
  held focus when it opened and gives it back on close — unless the door is gone from the document,
  or something else already holds focus (a consumer that deliberately focused the row its act
  wrote keeps it).

## 1. Layout and hierarchy

Files: `consequence-dialog.tsx`, barrel `index.ts`, `consequence-dialog.css`. The shipped
Dialog primitive is used unrestyled: scrim, centring, `min(480px, …)` width, entrance, focus
handling and `DialogClose` (✕, `aria-label` = `consequence_dialog_close`) are its own.
Initial focus follows the primitive; the confirm is never autofocused — an act button under
a pre-focused Enter would commit by accident. Inside `DialogContent`, one wrapper:

```
<div data-testid="consequence-dialog" data-act-type={actType} class="cx-consequence">
  <p class="cx-consequence-acttype">{the act in words}</p>          — I-444
  <DialogTitle>…</DialogTitle>
  <p class="cx-consequence-hint">…</p>
  [stale notice]                      — only after a stale commit (I-44)
  ── ConsequenceSummary ──            — or skeletons while preview is pending (I-447)
  <ul class="cx-consequence-subjects">
    <li data-testid="consequence-subject-row" data-subject={key}
        [data-standing-before data-standing-after]>                 — I-445
      <p class="cx-consequence-subject-label">{subject label}</p>
      <div class="cx-consequence-roles">  Before | After columns — a standing, or the lists verbatim
      [<p class="cx-consequence-recorded">This reading {figure}{unit}</p>]
    </li>…
  </ul>
  [effects]                           — only when the preview carries `effects` (I-161)
    <h3 class="cx-consequence-effects-heading">…</h3>
    <dl class="cx-consequence-effects">
      <dt>…</dt><dd data-testid="consequence-effect-lines">        — I-446
        <ul class="cx-consequence-groups">
          <li data-testid="consequence-effect-group" data-class data-kind data-level data-count>
            {description} · {level} · {n lines}
          </li>… [<li>{N lines in all}</li>]
        </ul> | {n lines} | none
        [<details><summary>Line ids</summary><span data-technical>{ids}</span></details>]
      </dd>
      <dt>…</dt><dd data-testid="consequence-effect-signatures">{n signatures} [ids disclosure] | none</dd>
    </dl>
  <details class="cx-consequence-details">                           — I-447
    <summary data-testid="consequence-details">Details</summary>
    <dl>  Act {actType}  ·  Consequence digest
          <span data-testid="consequence-digest-line">{consequenceDigest}</span>  </dl>
  </details>
  ── end ConsequenceSummary ──
  [refusal slot]                      — exactly one RefusalState when refused (I-40)
  <footer>  Cancel · Confirm  </footer>
</div>
```

- **Act overline** (I-444) — the act's name in words from the one table keyed by the act-type
  enum, `var(--font-ui)` `var(--text-12)` `var(--weight-body-medium)` `var(--ink-muted)`, sentence
  case, no tracking; readable by assistive technology. The enum stays on `data-act-type` and in
  Details.
- **Standing** (I-445) — where a subject carries `standing`, each column is the standing's word
  (`var(--text-13)`; **After** in `var(--weight-body-medium)` `var(--ink)`, **Before** in
  `var(--ink-muted)` — what will be true dominates) with the figure in the mono tabular face and its
  UnitBadge, and beneath it the readings line (`var(--text-12)` `var(--ink-muted)`). **This
  reading** with the recorded figure and unit stands under both columns, `var(--space-2)` above.
- **Counted lines** (I-446) — a three-column grid (`minmax(0, 1fr) auto auto`, gap
  `var(--space-1)` `var(--space-3)`), each row a subgrid: description `var(--ink)`, level
  `var(--ink-muted)`, count mono tabular right-aligned; the total row spans all three over a
  hairline, `var(--ink-muted)`. The ids' disclosure follows, its summary `var(--text-12)`
  `var(--ink-muted)` with the reticle, the ids once opened in 12 px mono `var(--ink-secondary)`,
  select-all, each id an inline-block run (`cx-consequence-id`, `max-inline-size: 100%`) that wraps
  between ids and only inside one wider than the line.
- **Details** (I-447) — `var(--space-3)` above the footer's content; a closed `<details>`, its
  summary as the ids' summaries are; inside, a two-column `<dl>` (`auto 1fr`, gap `var(--space-2)`
  `var(--space-4)`) whose values are 12 px mono `var(--ink-secondary)`, tabular, wrapping,
  select-all.
- **Title** — `consequence_dialog_title` in the primitive's title style (`var(--text-16)`
  `var(--weight-heading)` `var(--graphite-900)`); hint `consequence_dialog_hint` below it,
  `var(--text-12)` `var(--graphite-600)`.
- **Subject rows** — `var(--space-4)` above; one `<li>` per subject of the Consequence, in
  the order the seam answered. Rows separate with `var(--hairline)` border-top after the
  first, padding-block `var(--space-2)`. Subject label: `var(--text-13)`
  `var(--weight-body-medium)` `var(--graphite-900)`, single line, ellipsis. Under it a
  two-column grid (`1fr 1fr`, gap `var(--space-4)`): each column a label —
  `consequence_dialog_before_label` / `consequence_dialog_after_label`, `var(--text-12)`
  `var(--graphite-600)` — over the role list, `var(--font-mono)` `var(--text-12)`, role enum
  values verbatim joined by spaces: before `var(--graphite-600)`, after
  `var(--graphite-900)` (what will be true dominates). An empty list renders
  `consequence_dialog_none` in `var(--font-ui)` `var(--graphite-600)` — prose standing for
  absence, never a fake role name.
- **Effect slots** (I-161/I-162) — `var(--space-4)` above the digest line, `border-top:
  var(--hairline)`, padding-block-start `var(--space-3)`. `<h3>`
  `consequence_dialog_effects_heading`, `var(--text-12)` `var(--weight-body-medium)`
  `var(--graphite-900)`; under it a `<dl>` grid (`auto 1fr`, gap `var(--space-1)`
  `var(--space-3)`) of exactly two rows, in this order: `<dt>`
  `consequence_dialog_effects_lines` then `<dd data-testid="consequence-effect-lines">`, and
  `<dt>` `consequence_dialog_effects_signatures` then `<dd
  data-testid="consequence-effect-signatures">`. Labels `var(--text-12)`
  `var(--graphite-600)`; values `var(--font-mono)` `var(--text-12)` `var(--graphite-900)`
  `tabular-nums slashed-zero`, the ids the slot names rendered whole and space-separated,
  wrapping, `user-select: all` (the digest's I-43 rule: what a person compares is never
  truncated). An empty list renders `consequence_dialog_none` in `var(--font-ui)`
  `var(--graphite-600)` — the same prose the empty role list uses, never a zero and never a
  dash. The label sits outside the testid element, so each `<dd>`'s text is exactly the value
  the seam sent or that one word. The slots stand with the consequence: they unmount with it
  while a preview is pending, refused or superseded, and re-render with the fresh one.
- **Digest line** — *since I-447, inside Details*: label `consequence_dialog_digest_label`
  (`var(--text-12)` `var(--graphite-600)`) in the `<dt>`, then the digest per I-43:
  `var(--font-mono)` `tabular-nums slashed-zero` `var(--graphite-700)`, whole, wrapping,
  select-all.
- **Stale notice** — `<div data-testid="consequence-stale-notice" role="alert">`, the house
  notice chrome (`var(--info-surface)` fill, `var(--hairline)` border re-keyed
  `border-color: var(--info)`, radius `var(--radius-4)`, padding `var(--space-3)`
  `var(--space-4)`, `var(--text-13)` `var(--graphite-900)`), text
  `consequence_dialog_stale`. `role="alert"` because mounting is the announcement
  (refusal-state I-7's duty); info chrome because nothing the person did was wrong —
  severity colour is presentation, not meaning (refusal-state I-9).
- **Refusal slot** — after the body, before the footer, exactly refusal-state §2's
  composition: one RefusalState from the rejection's entry and evidence, no added chrome.
  The dialog stays open, focus stays where it was; mounting announces.
- **Footer** — `var(--space-5)` above, flex, justify-end, gap `var(--space-2)`: secondary
  core Button `consequence_dialog_cancel` invoking `onOpenChange(false)`, then
  `<Button data-variant="act" data-testid="consequence-confirm" data-digest={digest}>`
  `consequence_dialog_confirm` — the act variant with its copper dot is the confirm of every
  ConsequenceDialog (R-UI-010); activating it invokes `commit({ consequenceDigest })` with
  exactly the rendered digest. The confirm exists only while a consequence and digest line
  are rendered: while the preview is pending, refused or superseded it is unmounted — not
  disabled — so no path to commit exists without them (AC-5). In its place while pending
  stands a 32 × 96 px Skeleton keeping the footer's height.

**Pending preview** (every open, and after staleness): the subjects list and digest line are
replaced by Skeletons keeping layout — two 16 × min(360 px, 100 %) bones and one
12 × 240 px bone — with `aria-busy="true"` on the wrapper. **Committing:** the confirm takes
core's loading state (`aria-busy`, no spinner); cancel and close stay enabled — closing does
not abort the request, and a commit that resolves after close still invokes `onCommitted`
so the consumer's surfaces refresh. **Committed:** the dialog invokes
`onCommitted({ actId })` then `onOpenChange(false)`; focus returns to the door that opened the
dialog (I-448 — the primitive's own return reaches only a `DialogTrigger`, which no consumer
uses). Escape and the scrim close per the primitive — a discarded preview commits nothing.

## 2. Component states (the R-UI-050 matrix, ruled)

A pattern, not a screen: the seven screen states belong to consumers' Decisions. Its own
enumerable states — `closed` · `pending` (skeletons, aria-busy) · `consequence` (rows +
digest + confirm) · `stale` (notice + pending, then notice + fresh consequence) · `refused`
(RefusalState in the slot; confirm present for commit refusals, absent for preview refusals,
I-41/I-44) · `committing` (confirm loading) — are all reachable through props and injected
functions, so the jsdom acceptance and the gallery can mount them. `consequence` has two
paints rather than two states (I-161): with the effect slots when the preview carried
`effects`, without them when it did not — the presence of the field, never a prop. Empty is impossible: a
lawful Consequence names what it touches, and an act that changes nothing is the seam's
`ACT_CHANGES_NOTHING` refusal, rendered like any other.

## 3. Copy, verbatim (`src/ui/strings/consequence-dialog.ts`)

`consequence_dialog_title` **What this act changes** · `consequence_dialog_hint` **Computed
from the project as it stands. Confirming commits exactly what is shown and nothing else.**
· `consequence_dialog_before_label` **Before** · `consequence_dialog_after_label` **After**
· `consequence_dialog_none` **none** · `consequence_dialog_digest_label` **Consequence
digest** · `consequence_dialog_stale` **The project changed while you were deciding, so
nothing was committed. What is shown below was recomputed just now, and confirming carries
the new digest.** · `consequence_dialog_effects_heading` **What follows from this** ·
`consequence_dialog_effects_lines` **Lines that re-measure** (DLG-1: was *Lines that re-derive* —
"re-derive" is the law's word, "re-measure" the QS's) ·
`consequence_dialog_effects_signatures` **Signatures that void** ·
`consequence_dialog_confirm` **Confirm** · `consequence_dialog_cancel`
**Cancel** · `consequence_dialog_close` **Close**. Voice: calm, concrete, no exclamation
marks; "act", "consequence" and "digest" are the product's own user-facing law, not build
vocabulary. Refusal message and remedy are registry-owned and render as registered (I-40).

Added by DLG-1. The act names (I-444), one per act type:
`consequence_dialog_act_assign_participant_role` **Change a participant's role** ·
`…_confirm_discipline` **Confirm disciplines** · `…_confirm_view_type` **Confirm view types** ·
`…_pin_drawing_set` **Pin a drawing set** · `…_affirm_scale` **Affirm a scale** ·
`…_insert_level` **Insert levels** · `…_repudiate_level` **Remove a level** ·
`…_author_storey_height` **Record a storey height** · `…_author_typical_range` **State a typical
floor range** · `…_transcribe_sheet_notes` **Record a sheet's notes** · `…_corroborate` **Record a
reading** · `…_repudiate` **Strike an object** · `…_hold_out_of_bill` **Hold out of this bill** ·
`…_declare_not_in_project_scope` **Declare out of project scope** · `…_author_ruleset_edition`
**Author a ruleset edition** · `…_author_site_fact` **Record a site fact**. The standing
(I-445): `consequence_dialog_standing_agreed` **Agreed** · `…_suspended` **Suspended** ·
`…_none` **Not stated** · `…_readings` **{count} readings** · `…_readings_one` **1 reading** ·
`…_disagree` **{count} readings do not agree** · `…_unread` **No reading yet** · `…_recorded`
**This reading**. The counts (I-446): `consequence_dialog_lines` **{count} lines** ·
`…_lines_one` **1 line** · `…_lines_total` **{count} lines in all** · `…_signatures` **{count}
signatures** · `…_signatures_one` **1 signature** · `consequence_dialog_level_foundation`
**Foundation** · `…_level_unresolved` **Level not resolved** · `…_level_none` **No level**.
Details (I-447): `consequence_dialog_details` **Details** · `…_details_act` **Act** ·
`…_details_lines` **Line ids** · `…_details_signatures` **Signature ids**. Every count renders
through the frame's figure conventions (SEAM-FORMAT, injected); with none mounted, the exact
decimal is shown, the DataTable subtotal's own rule.

## 4. Motion (R-UI-004)

The primitive's own entrance (scrim fade, content fade + 0.98 → 1 scale over
`var(--motion-state)` `var(--ease)`); exit instant. Rows, effect slots, digest, stale notice
and refusal mount with no entrance — answers arrive instantly, and theatre in front of a consequence
reads as persuasion. Skeleton pulse and reticle draw live in their single homes. Every
duration is a token zeroed at source under reduced motion.

## 5. Tokens

`--graphite-600/700/900` · `--info/--info-surface` · `--hairline` · `--space-2/3/4/5` ·
`--radius-4` · `--text-12/13/16` · `--font-mono/--font-ui` ·
`--weight-body-medium/--weight-heading` · `--motion-state/--ease`. Act colour is the core
Button's own; the semantic tints and evidence-link paint inside the slot are RefusalState's
own. Px/em literals, closed set (core I-1's mandated class, I-42): the two 10 px lines,
0.12em tracking, skeleton bones 16 × 360, 12 × 240 and 32 × 96. Any other literal is a
defect.

## 6. Themes

`consequence-dialog.css` contains no `[data-theme]` selector; every light/dark difference
arrives through token values (R-UI-001), and the portal keeps the document-root theme (the
primitives-data ruling). Contrast holds on founder facts in both themes: graphite-600 and
700 on graphite-0 ≥ 4.5:1 (the 10 px lines included — size earns no carve-out), act-600 on
act-surface ≥ 4.5:1, the info pair per the refusal-state ruling. Copper appears exactly
once, on the confirm — the one place the law reserves it.

## 7. Test hooks (closed contract, C-05)

Routes: none. Test ids, exactly these nine, on the elements ruled in §1:
`consequence-dialog` (the wrapper, `data-act-type`) · `consequence-subject-row` (each
`<li>`, `data-subject`, and since DLG-1 `data-standing-before`/`-after` where the subject carries
a standing) · `consequence-effect-lines` and `consequence-effect-signatures`
(the two `<dd>`s — added by inc-205-scale-ui; since I-446 each says its count or `none` on its
face and keeps its ids in its own closed disclosure) · `consequence-effect-group` (each counted
row, `data-class`, `data-kind`, `data-level`, `data-count` — DLG-1) · `consequence-details` (the
Details summary — DLG-1) · `consequence-digest-line` (the digest text, exactly, I-43, inside
Details) · `consequence-confirm` (the act Button, `data-digest`) · `consequence-stale-notice`. No
others are added; the dialog card itself is the primitive's `dialog-content`, and the
refusal slot is found by RefusalState's own ids inside `consequence-dialog`.

DLG-1's acceptance (jsdom): the overline says the act's name and no face of the dialog holds the
enum, which stays on `data-act-type` and in Details (I-444); a storey-height subject reads its
standing before and after with figure, unit and readings, and the recorded figure with its unit,
every figure through the injected conventions (I-445); grouped lines render one
`consequence-effect-group` per group with description, level words and count, a total under more
than one, and no id on the slot's face while every id stands whole in its disclosure (I-446);
the digest line sits in a closed disclosure that one press on `consequence-details` opens, and
the confirm's `data-digest` still equals it (I-447); closing returns focus to the opening door
(I-448). The seam's half is `src/core/acts/__tests__/consequence-words.test.ts` (pure: the
standing moves, the grouping and its order, what the digest binds and that a consequence without
a standing digests as before) and `tests/takeoff/levels-ui/consequence-words.test.ts` (live: the
groups add up to the bound ids, the previewed standing is the stack's before and after the commit,
and the counted preview's digest commits). Gallery (R-UI-011): `ConsequenceSummary` stands open in
four states — `suspends` (GF agreed at 3.3528 m over two readings, a third entered at 3.2 m;
Column · Concrete GF 26 and Column · Formwork GF 26 of 52 sample line ids), `settles` (the same
key re-read at 3.3528 m), `first-reading` (1F not stated → agreed at 3.048 m, both effect slots
**none**), `roles` (the participants sample below). Baselines: `consequence-dialog-open.png`
(J-003) MOVES — the overline is words, the digest is behind Details — and is re-taken by the gate
(`pnpm e2e:retake`, a `baseline:` commit), never by hand.

Behavioural hooks without new ids: `aria-busy` on the wrapper while pending and on the
confirm while committing; `data-variant="act"` and the `act-dot` on the confirm;
`role="alert"` on the stale notice; the absence of `consequence-confirm` whenever no digest
line is rendered — asserted, not assumed — and the absence of **both** effect slots whenever
the preview carried no `effects` field, asserted the same way (I-161), which is what keeps
every act that shipped before inc-205 rendering the DOM it already rendered.

Acceptance (AC-5, jsdom, @testing-library): mounts with injected `preview`/`commit` —
resolved preview → one row per subject with before and after, digest exact, confirm invoking
`commit` with exactly that digest; pending → no confirm in the DOM; a
`CONSEQUENCES_NOT_CARRIED` rejection → stale notice plus a re-invoked preview and the fresh
digest; another rejection → RefusalState with the injected entry. Added by inc-205-scale-ui: a
preview carrying `effects: { linesRederiving: [], signaturesVoiding: [] }` → both slots
present, each reading exactly **none**; a preview carrying ids → each slot's text exactly
those ids, space-separated, in the order the seam sent them; a preview with no `effects`
field → neither testid in the DOM, and the sample gallery preview stays that one, so
`consequence-dialog-open.png` is not re-baselined. The gallery entry
(`src/ui/gallery-derivation/entries.tsx`) renders `closed` per I-46: a ghost trigger
labelled **Assign a role**, sample preview resolving one subject — label
`estimator@cubit.test`, before `PRINCIPAL`, after `PRINCIPAL MEASURER` — with the authored
sample digest, commit resolving a fixed act id; `missingEntries()` stays empty. The open
paint's evidence is J-003's committed baseline (see the s-settings-participants Decision
§7), masks on `consequence-digest-line` and `.cx-consequence-subject-label` — the two
per-run texts.


---

<!-- PART 2 — merged verbatim from docs/design/consequencedialog.md (the effect slots) -->

> **DLG-1 note (session 8).** Part 2 stands as the effect slots' history. Where it rules a slot's
> VALUE — "the ids the slot names rendered whole and space-separated" (I-164, § 1 *Values*, § 7's
> "each slot's text exactly those ids") — I-446 now rules instead: the slot says its count, by
> class, kind and level for lines, and keeps the ids whole in its own closed disclosure. The
> `AFFIRM_SCALE` paint's overline is **Affirm a scale**, not the enum (I-444), and its digest
> stands in Details (I-447). Everything else below — placement, heading, lifetime, states,
> motion, tokens, themes — is unchanged.

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
