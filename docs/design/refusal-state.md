# Design Decision — RefusalState (the Datum refusal pattern)

Not a routed screen: the single refusal renderer `RefusalState` in
`src/ui/patterns/refusal-state` — the one home (ARCH-02, B-17) that every surface, including
the inside of the product's Dialog, uses to answer with a refusal. Law: R-UI-001/003/004/012/
020, R-SPINE-062, Q-07, B-06, B-17, ARCH-01/02/03. Consumers (R-UI-011): every screen whose
R-UI-050 matrix contains a refusal state — S-Auth (SIGNED_OUT, the auth increment), the
formats/documents surfaces (PRECISION_NOT_APPLIED, CHARACTER_NOT_COVERED), the viewer's
broken-manifest state (R-UI-043, M1), ConsequenceDialog's in-dialog refusal slot (R-UI-010).
Every convention of the primitives-core Decision binds: `cx-` classes, variants on
data-attributes, tokens-only colour and motion, `cx-reticle` solely from
`src/ui/primitives/core/reticle.css`. Core's Interpretations I-1 (mandated geometry constants
in px) and I-2 (no `transparent`) remain in force. This file also fixes the registry copy —
message, remedy, severity, surface — for the three codes this increment registers, and the
copy rules every later code is graded against.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-7 — one role for every severity.** The closed test contract fixes the container's role
  as `alert` (AC-4). An `info` refusal could argue for the politer `status`, but a refusal is
  an answer to something the user just did, and the announcement-on-appearance semantics are
  the same duty at every severity. Ruling: `role="alert"` always; severity never changes the
  role, only the presentation tokens.
- **I-8 — the entry's surface hint is law; the props are closed.** The component's props are
  exactly `{ refusal, evidence }`, so the surface variant comes from `refusal.surface`, never
  from a caller override. A caller that wants banner chrome for an inline-hinted code changes
  the registry entry through ownership of `src/core/errors.ts`, not the call site — the hint
  is taxonomy, not styling.
- **I-9 — severity colour is presentation, not meaning.** R-UI-060 bans colour-only meaning.
  The meaning of a refusal travels entirely in text — code, message, remedy — which is
  identical in greyscale; the semantic tint and border are redundant emphasis. No severity
  glyph is added: a glyph would imply the colour carries information the text lacks.

## 1. Layout and hierarchy

One component file `src/ui/patterns/refusal-state/refusal-state.tsx`, barrel `index.ts`
exporting `RefusalState` only, stylesheet `refusal-state.css` beside them. `import type
{ RefusalEntry } from "…core/errors"` — type-only; the `refusalOf` lookup happens in the
caller, so ui stays value-import-free of core (ARCH-01). The component owns no product copy:
every visible string arrives through the entry or the evidence prop; the only literals in the
JSX are the five test ids and fixed attribute values.

```
<div class="cx-refusal" data-testid="refusal-state" role="alert"
     data-severity={refusal.severity} data-surface={refusal.surface} data-code={refusal.code}>
  <span data-testid="refusal-code">PRECISION_NOT_APPLIED</span>
  <p    data-testid="refusal-message">…</p>
  <p    data-testid="refusal-remedy">…</p>
  <a    data-testid="refusal-evidence-link" class="cx-reticle" href={evidence.href}>
    {evidence.label}
  </a>
</div>
```

Document order is reading order is the hierarchy: the code names it, the message says what
happened, the remedy says what to do, the link goes to where it is done. Column flex, gap
`var(--space-1)`, with `var(--space-2)` above the link (the action stands slightly apart).
The link is `align-self: start` — a real `<a>`, never a button, because evidence is a place
(R-UI-022's Trace affordance grows from here). No heading element: the owning screen's
hierarchy provides headings; a refusal is content, not a landmark. No icon, no illustration,
no close button — a refusal is dismissed by resolving it, not by hiding it. No toast is ever
the carrier (R-UI-020); adopters that also toast are adding status, not moving the answer.

- **Code** — `var(--font-mono)` `var(--text-12)` with `font-variant-numeric: tabular-nums
  slashed-zero`, coloured by severity (§ table below). It is the literal registry code, not
  styled uppercase (the BasisChip ruling) — no letter-spacing.
- **Message** — `var(--font-ui)` `var(--text-13)` `var(--weight-body-medium)`
  `var(--graphite-900)`, line-height `var(--leading-ui)`. The dominant line.
- **Remedy** — `var(--text-13)` weight 400, `var(--graphite-700)`.
- **Evidence link** — `var(--text-13)` `var(--weight-body-medium)`, text `var(--beam-600)`,
  `text-decoration: underline` at rest (interactive on a tinted surface never rides colour
  alone); hover text `var(--beam-500)`, transition over `var(--motion-state)` `var(--ease)`;
  focus is the reticle from its single home (an `<a>` hosts `::after`, so the corner ticks
  render, no fallback needed).

### Surfaces (`data-surface`)

- **inline** — the block card: fill and 1 px border per severity, radius `var(--radius-4)`,
  padding `var(--space-3)` `var(--space-4)`, width sized by the container. This is the
  in-place answer inside a form, a panel, a list region.
- **dialog** — chrome-identical to inline. The hint routes placement (the code belongs
  inside the flow that raised it — see §2), not different paint; a second dialect of the
  card is exactly what B-17 forbids.
- **banner** — the region-width answer: `width: 100%`, radius 0, border-block 1 px per
  severity with no inline borders, padding `var(--space-3)` `var(--space-5)`. For refusals
  that outrank one control — an ended session, a broken manifest — pinned by the consumer
  at the top of the region they void.

### Severity tokens (`data-severity`)

| severity | fill | border + code text |
|---|---|---|
| error | `var(--danger-surface)` | `var(--danger)` |
| warning | `var(--warn-surface)` | `var(--warn)` |
| info | `var(--info-surface)` | `var(--info)` |

R-UI-001 pairs each semantic colour with its surface tint by law; on the founder values the
code text clears 4.5:1 on its tint in both themes, `graphite-900`/`graphite-700` hold their
usual floors on the pale tints, and `beam-600` clears 4.5:1 on all three tints in both
themes. No other colour appears; copper never appears here — a refusal is never an act.

## 2. In-dialog composition

Inside `DialogContent` (the shipped overlay primitive, untouched here) the RefusalState
renders in the content flow **after** the body copy and **before** the footer buttons: title,
body, refusal, actions — the answer sits between what was asked and what can be done next.
Width is the dialog's content width; the card's `var(--space-3)` block padding against the
dialog's `var(--space-5)` padding needs no extra margin from the component (outer spacing is
always the consumer's). `role="alert"` inside `role="dialog"` announces on mount — when a
confirm inside an open dialog is refused, mounting the RefusalState is the announcement, and
the dialog stays open with focus where it was: the user reads the refusal, follows the
evidence link or corrects and retries. This is the composition ConsequenceDialog's refusal
slot (R-UI-021) adopts wholesale when it ships; it may add no chrome around this component.

## 3. Registry copy, verbatim (R-SPINE-062) — and the copy rules

The three entries this increment registers in `src/core/errors.ts`:

| code | severity | surface |
|---|---|---|
| PRECISION_NOT_APPLIED | error | inline |
| CHARACTER_NOT_COVERED | error | inline |
| SIGNED_OUT | warning | banner |

- **PRECISION_NOT_APPLIED** · message **The value is not at the exact precision this
  document requires.** · remedy **Enter the value at the stated precision — nothing is
  rounded or padded on your behalf.** (B-06: the seam refuses; the copy says so plainly.)
- **CHARACTER_NOT_COVERED** · message **The text contains a character the document font
  cannot print.** · remedy **Replace or remove the unsupported character — a document never
  prints a blank box in its place.**
- **SIGNED_OUT** · message **Your session has ended, so this request was not carried out.**
  · remedy **Sign in again to continue.** (ARCH-03, B-21 — the remedy is sign-in, and an
  ended session is expected and recoverable: warning, not error.)

Copy rules, binding on every later code (the registry grows under later ownership, but its
voice is fixed here): the message is one sentence of plain English stating what was refused
and why, in present tense; the remedy is one sentence naming the action that resolves it,
starting with the verb. Never "Oops", never "sorry", never "please", no exclamation marks.
The code is never repeated inside the message. Bible clause ids and build vocabulary
(L-FMT-02, seam, lane, increment) never appear — those belong to the internal detail strings
`refusal()` carries in `src/core/format.ts`, which are for operators and stay out of the
registry. `error` = the request was refused and needs correcting; `warning` = refused but
expected and recoverable in stride; `info` = nothing was refused of the user — the system is
explaining an absence (the future "why this list is empty" codes, R-UI-020, owned by the
screen increments that render lists — a recorded IOU, not this component's slot to fill).

Evidence labels (caller-supplied) follow the button voice: verb-first, naming the
destination — **Open format settings**, **View the source drawing**, **Go to sign-in** —
never "Click here", never "Learn more".

## 4. The R-UI-050 matrix, ruled

This component **is** the refusal state of every owning screen's matrix; the other six
states belong to those screens' Decisions. The component itself is synchronous and
single-state: both props are required by type, so loading, empty and partial are impossible
by construction — there is no RefusalState without an entry and an evidence link (R-UI-020's
"always carries the evidence link" is enforced by the compiler, not by review). Its own
enumerable variants are the nine cells of §1's severity × surface grid plus the link's
hover/focus, and the gallery leaf later screenshots them (the refusal-* baselines are that
leaf's recorded IOU).

## 5. Motion (R-UI-004)

No entrance animation: a refusal is an answer and arrives as instantly as a success would —
theatre in front of a refusal reads as apology. The only transitions are the evidence link's
colour over `var(--motion-state)` `var(--ease)` and the reticle draw in its single home;
both are tokens zeroed at source under reduced motion, so the reduce branch is inherited,
not re-declared.

## 6. Themes

`refusal-state.css` contains no `[data-theme]` selector — every light/dark difference
arrives through token values (R-UI-001): the semantic tints flip to their dark surfaces, the
semantic colours brighten, graphite and beam flip by role. The contrast pairs in §1 hold on
the founder values in both themes. Rendered inside a Dialog the theme arrives through the
portal's document-root `[data-theme]`, per the overlay Decision.

## 7. Test hooks (closed contract, C-05)

Routes: none. Test ids, exactly these five, on the elements ruled in §1: `refusal-state`
(the container) · `refusal-code` · `refusal-message` · `refusal-remedy` ·
`refusal-evidence-link` (the `<a>`; its `href` is the evidence href, its text the evidence
label). Behavioural hooks without new ids: `role="alert"` on the container;
`data-severity`, `data-surface`, `data-code` reflecting the entry; `cx-reticle` on the link.
The acceptance sample render (jsdom, `@vitest-environment jsdom`): `refusalOf`'s entry for
each of the three registered codes, with sample evidence for the in-dialog case —
`{ href: "/settings/documents", label: "Open document settings" }` — composed inside the
shipped Dialog for the dialog-surface assertion. Stylesheet facts (tints, borders, the
banner geometry) are graded by the gallery leaf's baselines later; jsdom asserts structure,
roles, ids and the reflected data-attributes.
