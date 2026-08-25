# Design Decision — Root error boundary (the product's error state)

Screen: the app-root React error boundary, `src/app/error.tsx` (client component).
Increment: inc-002-server-fault-spine. Law: ARCH-03, B-21, R-SPINE-007; states per R-UI-050;
copy discipline per C-SPINE-PLATFORM.

## 0. Scope ruling — why this screen is unstyled

The Datum token source (`src/ui/tokens.ts`, R-UI-001) does not exist in the tree yet, and the
increment spec places "design tokens, styling" out of scope for this leaf. Therefore this
Decision specifies **semantic HTML only**: no colour values, no font declarations, no spacing,
no class names that imply styling, no inline styles. The browser's user-agent rendering is the
accepted appearance. When the design system lands, the `ErrorState` primitive (R-UI-010)
replaces this markup and a successor Decision restyles it under Datum; that successor also owes
the visible report id (see §2, Interpretation I-1). Nothing in this file names a token because
there are lawfully none to name — this is the one screen for which that is true, and the reason
is recorded here so the omission is never read as licence.

## 1. Layout and hierarchy

The boundary replaces the failed page's content inside the root layout. It renders one
landmark containing exactly three things, in this document order — title, message, action:

```
<main data-testid="error-state">
  <section role="alert" aria-labelledby="error-state-title">
    <h1 id="error-state-title" data-testid="error-state-title">…</h1>
    <p data-testid="error-state-message">…</p>
    <button type="button" data-testid="error-retry">…</button>
  </section>
</main>
```

Decisions, each binding:

- `<main>` is the landmark: the boundary substitutes for the page, so it owns the page's main
  landmark. The heading is an `<h1>` for the same reason — nothing else on a failed page
  outranks it.
- `role="alert"` sits on the inner `<section>`, not on `<main>`: the boundary mounting is
  itself the event, so the alert region's content is announced once, on appearance, to
  assistive technology. No `aria-live` attribute is added beyond what `role="alert"` implies.
- The retry control is a real `<button type="button">` — never an anchor, never a div. Its
  accessible name is its visible text (no `aria-label`); its activation calls the boundary's
  `reset` prop exactly once per activation (AC-4). No `onKeyDown` handlers: native button
  semantics already cover Enter and Space.
- No icon, no illustration, no brand mark, no fault-code dump, no "details" disclosure, no
  link to support. Three elements is the whole screen. Anything more is a deviation.
- No focus is stolen on mount (no `autoFocus`): the alert role announces the state; the
  button is the first and only tabbable element, reached with one Tab. Focus visibility is
  the user agent's default outline until the Datum reticle (R-UI-012) exists.
- Hierarchy: the title dominates (it is the only heading), the message supports, the button
  is the single action. Density rules (R-UI-005) do not apply — there is no table or row here.

## 2. States (R-UI-050)

This screen **is** the error state of every other screen's matrix; it is terminal and has
exactly one visual state. The matrix is ruled state by state so the enumeration is checkable:

- **Error** — the only state. Content per §3. The remedy is the retry button, which calls
  `reset` and lets React re-render the failed subtree; a recovered render simply replaces
  the boundary. If the fault persists, the boundary re-renders identically — no counter,
  no escalating copy, no disabled button. Retry is idempotent and always available.
- **Loading** — none. The boundary renders synchronously from strings already in the bundle;
  there is nothing to await, so no skeleton exists.
- **Empty** — impossible. The boundary only mounts when an error object exists.
- **Refusal** — never rendered here. A refusal is an answer, not a fault (ARCH-03): the wire
  maps it to `error.data.kind: "refusal"` and the owning screen renders it in place
  (R-UI-020). If a refusal-marked error is ever thrown during render, that throw is itself a
  defect upstream, and this boundary truthfully shows the fault state — it never inspects
  `refusalCode` and never impersonates a refusal surface.
- **Partial** — impossible; the boundary replaces the whole failed subtree or nothing.
- **Offline** — indistinguishable by design. A render crash while offline shows this same
  state; retry re-attempts and re-renders the same state on failure. No offline banner here —
  that banner belongs to screens that can still show data, which this one cannot.
- **Permission-denied** — never rendered here; that is a refusal with a named permission,
  answered in place on the owning screen.

**Interpretation I-1 (recorded per the Law section of CLAUDE.md):** R-UI-050's error state
names "retry + report id". The increment's closed test contract fixes this screen to exactly
three visible strings and four test ids, and the string table ships with only the three
`error_` keys — a report-id label cannot exist without a new key, and an unlabelled raw digest
is not honest copy. The message therefore states the truth in prose ("The fault has been
recorded for the operators") and the visible report id is owed by the styled `ErrorState`
primitive's Decision, alongside its string-table key. This is a deferral with a named owner,
not an omission.

## 3. Copy, verbatim (C-SPINE-PLATFORM)

All three strings come from `src/ui/strings.ts` — the JSX contains **no string literals except
the four test ids** and fixed attribute values (`role`, `type`, `id`). Values, exactly:

- `strings.error_title` → **Something went wrong on our side**
- `strings.error_body` → **Your work is safe. The fault has been recorded for the operators — try again, and if it keeps failing, contact support.**
- `strings.error_retry` → **Try again**

Voice check, so nobody "improves" it: the title admits fault plainly ("on our side" — never
"Oops", never an exclamation mark); the body answers the two questions a user actually has
(is my work safe; what do I do) and tells the truth about operator visibility (B-21); the
button names the remedy in two words. No error internals — the thrown message, stack, or
cause — ever appear in this markup, mirroring the wire rule that a fault answer never leaks
the internal message (AC-3).

## 4. Motion (R-UI-004)

None. The boundary appears with no transition, no fade, no spinner — a static replacement of
the failed content. This is a decision, not a gap: motion durations are Datum tokens, the
token source does not exist, and an outage screen must cost zero frames. Consequently
`prefers-reduced-motion` is satisfied vacuously. The styled successor may add the standard
160 ms state ease; it may never animate the retry button.

## 5. Tokens

None used; none may be used. A colour literal, font-family, or pixel value in `error.tsx` is
a defect against this Decision and against the increment's out-of-scope ruling. See §0 for
why this screen is the lawful exception to the "name the Datum tokens" duty.

## 6. Themes

Identical in dark and light — the markup carries no colour, so it inherits the user agent's
scheme (the root layout does not yet set `[data-theme]`). When Datum lands, the successor
Decision assigns graphite roles; nothing theme-dependent may be introduced here meanwhile.

## 7. Test hooks (closed contract, C-05)

Test ids, exactly these four, on the elements ruled in §1:

- `error-state` — the `<main>` root of the boundary's markup
- `error-state-title` — the `<h1>`
- `error-state-message` — the `<p>`
- `error-retry` — the `<button>`

Routes: none introduced by this screen — `src/app/error.tsx` binds to every route under the
root layout. It is provoked in tests by rendering the component directly under jsdom with a
stubbed `reset` (AC-4), not by crashing a page. Behavioural hooks under test: the button's
accessible name equals `strings.error_retry`; one activation calls `reset` exactly once.
