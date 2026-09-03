# Design Decision — OfferedGroups (the offered-group pattern)

Not a routed screen: the single bulk-offer pattern `OfferedGroups` in
`src/ui/patterns/offered-group` — the one home (B-17) for L-ACT-02's "bulk is offered, never
assembled", mounted in this increment on S-Drawings (its named product consumer, R-UI-011)
and in the `/design` gallery. Law: L-ACT-02, R-UI-001/003/004/005/010/011/012/020/023/050/
060, B-17, B-19, Q-11, Q-17. Every convention of the earlier Decisions binds: `cx-` classes,
variants on data-attributes, tokens-only colour and motion, `cx-reticle` solely from its
single home, no `[data-theme]` selector in authored CSS; Interpretations I-1–I-76 remain in
force. Chrome comes only from the shipped core Button plus the `cx-offered-*` classes this
file rules. Barrel `index.ts` exports `OfferedGroups` only; props exactly `groups` and
`onConfirm`, with `OfferedGroupItem = { key, label, count }`. Stylesheet
`offered-group.css`. Copy lives in `src/ui/strings/offered-group.ts` (keys
`offered_group_…`, registry append); JSX carries no string literal beyond test ids and fixed
attribute values. `import type { OfferedGroupKey }` only — ui stays value-import-free of core
(ARCH-01, the refusal-state ruling).

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-77 — the absence of a select-all is the pattern's substance, and it is asserted.** The
  component renders no `input[type=checkbox]`, no row selection, no "select all", no
  indeterminate control and no per-member list: membership is the machine's, resolved in the
  Consequence (L-ACT-02). A visitor cannot add a subject to a group or take one out; the only
  door is confirming the group exactly as it is named. That absence is a behavioural hook
  (§7), tested, not merely intended.
- **I-78 — the count arrives formatted and renders whole.** `count` is a string the consumer
  produced through SEAM-FORMAT (the dropzone I-70 class); the pattern never counts, never
  re-formats and never abbreviates it — "1 sheet" and "9 sheets" are the consumer's words
  because only the consumer knows what is being counted. ui touches no `Intl`.
- **I-79 — the label is the consumer's sentence, rendered verbatim.** R-UI-023's named group
  ("14 columns sighted from view B-2, layer S-COL, basis INTERPRETED") is one sentence naming
  the fact judged; the pattern adds no prose around it, no truncation and no title-casing. A
  group that cannot be named in one line is a grouping defect in the consumer, not a layout
  problem here.
- **I-80 — the live region is the count, never the row.** R-UI-060 owes a live region for
  changing status. A polite region over the whole row would re-announce the label every time
  one member is confirmed elsewhere; `aria-live="polite"` sits on the count `<span>`, whose
  text is the only thing that moves while the row stands (R-UI-023's "live membership
  count").
- **I-81 — the confirm is a secondary Button, never the act variant.** Copper is reserved for
  act commitment (R-UI-001), and this door commits nothing: it opens the consumer's
  ConsequenceDialog, whose act-variant confirm is the one place the act is carried
  (R-UI-010/021). A copper button here would spend the scarcity twice for one act.
- **I-82 — the pattern owns no heading and no empty frame.** Headings belong to the
  consuming screen's hierarchy (the refusal-state ruling), so the root is a `<section>` the
  consumer names through `aria-labelledby` on its own `<h2>`… and with zero groups the
  pattern renders one sentence in the list's place, not a centred teaching frame — the
  screen's own empty state is elsewhere and larger (the S-Audit I-33 class). The sentence is
  act-agnostic by necessity: the pattern is not told what is grouped.

## 1. Layout and hierarchy

Files: `offered-groups.tsx`, barrel `index.ts`, `offered-group.css`. The pattern sizes to
its container and sets no width of its own (outer spacing is always the consumer's).

```
<section data-testid="offered-groups" class="cx-offered" data-count={groups.length}>
  <ul class="cx-offered-list">                              ← only when groups.length
    <li data-testid="offered-group" class="cx-offered-group"
        data-kind={key.kind} data-discipline={key.discipline}
        data-drawing={key.drawingId}   ← PROPOSED_DISCIPLINE only
        data-sheet={key.sheetId}>      ← SHEET only
      <p id={labelId} class="cx-offered-label">{label}</p>
      <span data-testid="offered-group-count" class="cx-offered-count"
            aria-live="polite">{count}</span>
      <Button data-variant="secondary" data-testid="offered-group-confirm"
              id={buttonId} aria-labelledby={`${buttonId} ${labelId}`}>…</Button>
    </li>…
  </ul>
  <p class="cx-offered-empty">…</p>                         ← only when groups.length === 0
</section>
```

- **Row** — grid `1fr auto auto`, column gap `var(--space-3)`, align-items centre,
  min-height `var(--row-comfortable)` re-keyed to `var(--row-compact)` under an ancestor
  `[data-density="compact"]` (the dropzone I-75 mechanism, the shell's published attribute
  read as the contract it is); padding-block `var(--space-2)`; border-top `var(--hairline)`
  after the first row. No hover fill: a row is not itself a target — its button is.
- **Label** — `var(--text-13)` `var(--graphite-900)`, `var(--leading-ui)`, wrapping (a named
  group is a sentence, and a clipped sentence hides the fact judged).
- **Count** — `var(--font-mono)` `var(--text-13)` `var(--weight-body-medium)`
  `var(--graphite-900)`, `tabular-nums slashed-zero`, right-aligned: the membership is the
  number a person checks before confirming, so it reads as a numeral, not as prose (R-UI-005).
- **Confirm** — the shipped core Button, `data-variant="secondary"`, `align-self: center`,
  wearing the reticle from its single home. Its accessible name is its own label followed by
  the group's label (I-79's sentence), so a screen reader hears which group a door belongs
  to; every row's visible text stays identical, which is what keeps the column scannable.
  Activation invokes `onConfirm(key)` with exactly the item's key object — never a copy,
  never a derived string.
- **Empty line** — `var(--text-13)` `var(--graphite-600)`, padding-block `var(--space-3)`,
  no border, no action: the pattern has no action to offer when nothing is grouped.
- **Root** — column flex, gap 0; `data-count` reflects the group count so a journey can wait
  on a group's disappearance without counting DOM nodes.

## 2. Component states (the R-UI-050 matrix, ruled)

A pattern, not a screen: the seven screen states belong to consumers' Decisions. Its own
enumerable states — `groups` (one or more rows) · `empty` (the one sentence) — are both
reachable through props alone, so jsdom and the gallery mount them. Loading is impossible:
the props are resolved data, and a bone standing in for a count the consumer already holds
would be theatre (R-UI-004). Error, refusal and partial are impossible here: the pattern
makes no request, so nothing can be refused of it, and a group is offered whole or not
offered at all — a refused confirmation renders in the consumer's own place (R-UI-020), and
a group whose membership shrank to zero is not rendered smaller, it is not offered.

## 3. Copy, verbatim (`src/ui/strings/offered-group.ts`)

`offered_group_confirm` **Preview this group** · `offered_group_empty` **No groups are
offered right now. A group appears as soon as the product can name what a set of subjects
has in common.** Nothing else: the label and the count are the consumer's data (I-78, I-79),
and the act's own words live in the ConsequenceDialog the door opens. Voice: calm, concrete,
professional; no exclamation marks; no build vocabulary. "Group" and "preview" are the
product's own user-facing law (L-ACT-02), not internal words.

## 4. Motion (R-UI-004)

The Button's hover and the reticle draw live in their single homes; nothing else moves.
Rows mount with no entrance and unmount instantly — a group that leaves because it was
confirmed is an answer, and an exit animation in front of a committed act reads as theatre.
The count is replaced text with no tween: a number that eases toward the truth lies about
the membership while it travels (the dropzone I-70 reading). No bounce, no pulse, no
spinner. Every duration the pattern relies on is a token zeroed at source under reduced
motion, so `offered-group.css` carries no `prefers-reduced-motion` branch of its own.

## 5. Tokens

`--graphite-600/900` · `--hairline` · `--space-2/3` · `--text-13` · `--font-mono` ·
`--weight-body-medium` · `--leading-ui` · `--row-comfortable`/`--row-compact`. The door's
paint is the core Button's own. `offered-group.css` contains **no px literal at all** — the
pattern measures nothing a token does not measure — and any literal added to it is a defect.
No copper, no semantic tint and no basis colour appears: an offer is not an act, not a
refusal and not a basis.

## 6. Themes

`offered-group.css` contains no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001). Contrast holds on the founder values in both themes:
graphite-900 (label, count) and graphite-600 (the empty line) on graphite-0 clear 4.5:1, and
the hairline row seam at graphite-200 clears the 3:1 UI floor. In greyscale nothing is lost:
every distinction the pattern draws is text or position.

## 7. Test hooks (closed contract, C-05)

Routes: none; the pattern is mounted at `/design`, which exists, and on
`/t/{tenantId}/p/{projectId}/drawings`, which its consumer's Decision introduces.

Test ids, exactly these four, on the elements ruled in §1: `offered-groups` (the root
`<section>`, `data-count`) · `offered-group` (each `<li>`, `data-kind`, `data-discipline`,
and `data-drawing` or `data-sheet` by kind) · `offered-group-count` (the count `<span>`,
whose text is `item.count` character for character) · `offered-group-confirm` (the Button).
No others are added.

Behavioural hooks without new ids: `aria-live="polite"` on the count; the confirm's
composed accessible name (its label then the group's label); `cx-reticle` on the confirm;
one `onConfirm` call per activation carrying the identical key object; and the asserted
absences of I-77 — no `input[type=checkbox]`, no `[role=checkbox]`, no select-all control
anywhere inside `offered-groups`.

Acceptance (AC-3, jsdom, `@testing-library/react` + `user-event`): mounts three items and
asserts the §1 structure, the data-attributes per kind, the count text verbatim with its
live region, one `onConfirm` per press with exactly that key, the absence hooks, and the
barrel's single export; mounts `groups: []` and asserts the `offered_group_empty` sentence
read from the string table by key with no row and no button. The gallery entry
(`src/ui/gallery-derivation/entries.tsx`, no hooks in `render()`) publishes
`patterns/offered-group/OfferedGroups` with two states — `groups`, three rows in this order:
**STRUCTURAL proposed from the title block on rcc6.dxf** / **9 sheets** ·
**ARCHITECTURAL proposed from the title block on tower-arch.dxf** / **3 sheets** ·
**STRUCTURAL proposed for S-104 — Typical column schedule** / **1 sheet** (the third a
`SHEET` key, the first two `PROPOSED_DISCIPLINE` keys at fixed sample uuids) — and `empty`
(`groups: []`), leaving `missingEntries()` empty. J-004's baselines capture the
`gallery-shell` region only, so no re-baseline is owed.
