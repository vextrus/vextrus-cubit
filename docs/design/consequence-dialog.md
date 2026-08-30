# Design Decision — ConsequenceDialog (the act pattern)

Not a routed screen: the single preview → confirm pattern `ConsequenceDialog` in
`src/ui/patterns/consequence-dialog` — the one home (B-17) every act flow opens, first
consumed by S-Settings-Participants (this increment, R-UI-011); every later act imports this
component and adds none of its own. Law: R-SPINE-011, R-UI-001/003/004/010/011/012/020/021,
L-ACT-02, B-17, Q-11, Q-17. Every convention of the earlier Decisions binds: `cx-` classes,
tokens-only colour and motion, `cx-reticle` solely from its single home, no `[data-theme]`
selector in authored CSS; Interpretations I-1–I-39 remain in force. Chrome comes only from
shipped primitives — overlay Dialog (Content/Title/Close), core Button and Skeleton, the one
RefusalState — plus the `cx-consequence-*` classes this file rules. Barrel `index.ts` exports
`ConsequenceDialog`; props exactly `open`, `actType`, `preview()`, `commit({
consequenceDigest })`, `onOpenChange`, `onCommitted`. Stylesheet `consequence-dialog.css`.
Strings `src/ui/strings/consequence-dialog.ts` (keys `consequence_dialog_…`, registry
append): pattern chrome only, act-agnostic — every act-specific word arrives in the
Consequence's own data or as the act-type identifier.

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
- **I-43 — the digest renders whole, and the testid holds exactly it.** A digest exists to
  be compared (s-settings-ruleset I-26): the value renders in full, wrapping
  (`overflow-wrap: anywhere`), `user-select: all`. Its label sits outside the testid element,
  so `consequence-digest-line`'s text is character-for-character the `consequenceDigest` the
  preview answered — AC-5 compares it exactly.
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
- **I-46 — the gallery entry renders closed; its sample digest is authored data.** Per
  s-design I-15 an overlay entry renders closed with its trigger reachable; the open paint's
  evidence is not an IOU here but this increment's own committed baseline
  `tests/e2e/baselines/design/consequence-dialog-open.png` (AC-6). The sample's injected
  `preview` resolves authored data (s-design I-18's class): the derivation module computes
  no digest — its fixed 64-hex sample string is sample data like a sample refusal entry,
  never compared to a real digest anywhere.

## 1. Layout and hierarchy

Files: `consequence-dialog.tsx`, barrel `index.ts`, `consequence-dialog.css`. The shipped
Dialog primitive is used unrestyled: scrim, centring, `min(480px, …)` width, entrance, focus
handling and `DialogClose` (✕, `aria-label` = `consequence_dialog_close`) are its own.
Initial focus follows the primitive; the confirm is never autofocused — an act button under
a pre-focused Enter would commit by accident. Inside `DialogContent`, one wrapper:

```
<div data-testid="consequence-dialog" data-act-type={actType} class="cx-consequence">
  <p class="cx-consequence-acttype" aria-hidden="true">{actType}</p>
  <DialogTitle>…</DialogTitle>
  <p class="cx-consequence-hint">…</p>
  [stale notice]                      — only after a stale commit (I-44)
  <ul class="cx-consequence-subjects">  — or skeletons while preview is pending
    <li data-testid="consequence-subject-row" data-subject={key}>
      <p class="cx-consequence-subject-label">{subject label}</p>
      <div class="cx-consequence-roles">  Before | After columns
    </li>…
  </ul>
  <p class="cx-consequence-digest">
    <span class="cx-consequence-digest-label">…</span>
    <span data-testid="consequence-digest-line">{consequenceDigest}</span>
  </p>
  [refusal slot]                      — exactly one RefusalState when refused (I-40)
  <footer>  Cancel · Confirm  </footer>
</div>
```

- **Act-type overline** — the `actType` enum value verbatim (a machine identifier, the
  s-settings-ruleset I-25 class): 10 px `var(--font-mono)`, letter-spacing 0.12em (I-42),
  `var(--graphite-600)`. `aria-hidden` — the title, not the identifier, names the dialog.
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
- **Digest line** — `var(--space-3)` above, label `consequence_dialog_digest_label`
  (`var(--text-12)` `var(--graphite-600)`) then the digest per I-42/I-43: 10 px
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
`onCommitted({ actId })` then `onOpenChange(false)`; focus returns to the trigger (the
primitive's own behaviour). Escape and the scrim close per the primitive — a discarded
preview commits nothing.

## 2. Component states (the R-UI-050 matrix, ruled)

A pattern, not a screen: the seven screen states belong to consumers' Decisions. Its own
enumerable states — `closed` · `pending` (skeletons, aria-busy) · `consequence` (rows +
digest + confirm) · `stale` (notice + pending, then notice + fresh consequence) · `refused`
(RefusalState in the slot; confirm present for commit refusals, absent for preview refusals,
I-41/I-44) · `committing` (confirm loading) — are all reachable through props and injected
functions, so the jsdom acceptance and the gallery can mount them. Empty is impossible: a
lawful Consequence names what it touches, and an act that changes nothing is the seam's
`ACT_CHANGES_NOTHING` refusal, rendered like any other.

## 3. Copy, verbatim (`src/ui/strings/consequence-dialog.ts`)

`consequence_dialog_title` **What this act changes** · `consequence_dialog_hint` **Computed
from the project as it stands. Confirming commits exactly what is shown and nothing else.**
· `consequence_dialog_before_label` **Before** · `consequence_dialog_after_label` **After**
· `consequence_dialog_none` **none** · `consequence_dialog_digest_label` **Consequence
digest** · `consequence_dialog_stale` **The project changed while you were deciding, so
nothing was committed. What is shown below was recomputed just now, and confirming carries
the new digest.** · `consequence_dialog_confirm` **Confirm** · `consequence_dialog_cancel`
**Cancel** · `consequence_dialog_close` **Close**. Voice: calm, concrete, no exclamation
marks; "act", "consequence" and "digest" are the product's own user-facing law, not build
vocabulary. Refusal message and remedy are registry-owned and render as registered (I-40).

## 4. Motion (R-UI-004)

The primitive's own entrance (scrim fade, content fade + 0.98 → 1 scale over
`var(--motion-state)` `var(--ease)`); exit instant. Rows, digest, stale notice and refusal
mount with no entrance — answers arrive instantly, and theatre in front of a consequence
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

Routes: none. Test ids, exactly these five, on the elements ruled in §1:
`consequence-dialog` (the wrapper, `data-act-type`) · `consequence-subject-row` (each
`<li>`, `data-subject`) · `consequence-digest-line` (the digest text, exactly, I-43) ·
`consequence-confirm` (the act Button, `data-digest`) · `consequence-stale-notice`. No
others are added; the dialog card itself is the primitive's `dialog-content`, and the
refusal slot is found by RefusalState's own ids inside `consequence-dialog`.

Behavioural hooks without new ids: `aria-busy` on the wrapper while pending and on the
confirm while committing; `data-variant="act"` and the `act-dot` on the confirm;
`role="alert"` on the stale notice; the absence of `consequence-confirm` whenever no digest
line is rendered — asserted, not assumed.

Acceptance (AC-5, jsdom, @testing-library): mounts with injected `preview`/`commit` —
resolved preview → one row per subject with before and after, digest exact, confirm invoking
`commit` with exactly that digest; pending → no confirm in the DOM; a
`CONSEQUENCES_NOT_CARRIED` rejection → stale notice plus a re-invoked preview and the fresh
digest; another rejection → RefusalState with the injected entry. The gallery entry
(`src/ui/gallery-derivation/entries.tsx`) renders `closed` per I-46: a ghost trigger
labelled **Assign a role**, sample preview resolving one subject — label
`estimator@cubit.test`, before `PRINCIPAL`, after `PRINCIPAL MEASURER` — with the authored
sample digest, commit resolving a fixed act id; `missingEntries()` stays empty. The open
paint's evidence is J-003's committed baseline (see the s-settings-participants Decision
§7), masks on `consequence-digest-line` and `.cx-consequence-subject-label` — the two
per-run texts.
