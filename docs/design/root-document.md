# Design Decision — root-document (the root layout and the / landmark)

Screen: the root document — `src/app/layout.tsx` (the real root layout: stylesheets, metadata,
theme resolution) and `src/app/page.tsx` (the `/` route's landmark). Increment:
inc-019-root-document. Law: R-UI-001/003/004/012/050, C-SPINE-PLATFORM, R-SPINE-060, Q-11,
J-000 (the Golden Path's first checkpoint). This file replaces the deliberately unstyled
placeholders inc-000-foundation left at the app root; the root-error-boundary Decision's §0
scope ruling ("the token source does not exist yet") is hereby spent — from this increment on,
every route that renders *inside* this root layout stands on the Datum ground. One document
does not, and is named rather than glossed: `src/app/global-error.tsx` (inc-002, unowned here)
replaces the root layout entirely when the layout itself throws, so it supplies its own
`<html><body>` and receives none of this file's work. §1 records that gap.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-10 — the theme resolver is code, not copy.** C-SPINE-PLATFORM bans string literals in
  JSX except test ids and codes. The pre-paint resolver is an inline `<script>` whose text is
  executable code the user never reads; it is a code literal in the same class as a test id.
  No string-table key exists for it and none is owed. `suppressHydrationWarning` appears on
  `<html>` only — the one element whose server-rendered attribute the script lawfully changes —
  and nowhere else.
- **I-11 — the landmark's styles are inline, tokens-only.** This increment owns no CSS file
  (globals.css and tokens.css are out of scope; ownership grants no new stylesheet), and no
  shipped primitive owns "a centered holding page", so B-17 is not in play. Ruling: the few
  styles §1 fixes are authored as React `style` objects on the three elements, and every
  *design* value in them — every colour, every type size, every unit of space on the 4-pt grid
  — is a `var(--…)` token; such a literal is a defect (R-UI-001). Two values in §1 are not
  design values and are named here so the exception is closed rather than implied:
  `minHeight: "100dvh"` on the `main` (a viewport-relative box keyword — R-UI-001's scale
  measures space between things, and emits no token for the size of the viewport) and
  `margin: 0` on the `h1` and the `p` (a UA-default reset to zero; the gap between the two
  elements is carried by the flex `gap: "var(--space-2)"`, which is the tokened value). These
  two, and no others: any third literal is a defect, and if the token source later emits a
  viewport or reset value this exception is spent. When the shell (inc-013) re-homes `/`
  inside real chrome, these inline styles go with this markup.
- **I-12 — metadata is the title alone.** The interfaces line fixes `metadata.title` as
  `strings.app_title`. A description, Open Graph set, or title template would be user-facing
  copy needing keys the contract does not grant. Ruling: `export const metadata: Metadata =
  { title: strings.app_title }` — nothing else. Per-screen titles are those screens' future
  Decisions; no `%s` template is established here.

## 1. Layout and hierarchy

### The root layout (`src/app/layout.tsx`)

Synchronous default export `RootLayout`. It is the single loader of the Datum stylesheets for
the whole app — two imports at the top of the module, in exactly this order, and no page or
component under `src/app/` imports either file:

```tsx
import "../ui/tokens.css";        // the generated token values — first, always
import "../ui/theme/globals.css"; // the ground that consumes them
```

Markup, complete:

```tsx
<html lang="en" data-theme="light" suppressHydrationWarning>
  <body>
    <script dangerouslySetInnerHTML={{ __html: THEME_RESOLVER }} />
    {children}
  </body>
</html>
```

The layout renders no chrome, no wrapper div, no class: the rail, top bar and navigation are
inc-013's (out of scope). The ground — graphite-0 fill, graphite-900 text, Spline Sans 14 px at
1.45 — arrives from `globals.css` on `html`/`body`, so every route and the root error boundary
(`src/app/error.tsx`, unchanged) stand on it without importing anything. That is how AC-2's
"single loader" is observable: the themed ground is present at `/` and on the error route with
no per-page imports.

**The one document outside that reach — a recorded gap, not a claim.** `src/app/global-error.tsx`
is not a route rendered inside `RootLayout`: Next mounts it *in place of* the root layout when the
layout itself throws, and it therefore renders its own `<html lang="en"><body>` (its inc-002 code
comment says as much). It imports neither `tokens.css` nor `globals.css`, carries no `data-theme`,
and runs no pre-paint resolver — so the single most severe fault surface in the product currently
draws on the UA canvas in UA fonts, in either OS theme. Fixing it is not in this increment's
ownership (`src/app/global-error.tsx` is not in the Ownership list, and the spec scopes no work
there), and the honest reading of "loaded once for every route" is that a second document shell is
a second root, owing its own loader. This Decision therefore claims nothing about that file and
records the gap: a future increment owes `global-error.tsx` the same two stylesheet imports, the
`data-theme="light"` server attribute and the same `THEME_RESOLVER` as body's first child — or a
ruling that an outage screen deliberately stands on UA defaults.

### Theme resolution (the mechanism this file is required to record)

The server renders `data-theme="light"` — light is the product's default, never a guess about
the client. Before first paint, the OS preference resolves dark:

- `THEME_RESOLVER` is this exact code (a module-level `const`, minified as written):
  `try{if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark")}}catch(_){}`
- It renders as a **blocking inline `<script>`, the first child of `<body>`**, before
  `{children}`. The parser executes it synchronously before any body content exists, so no
  frame is ever painted with the wrong theme — there is no flash to hide and none may be
  hidden with opacity tricks. (Not in `<head>`: the App Router owns `<head>` via the metadata
  API and an authored child there has no guaranteed placement.)
- It only ever sets `"dark"`; it never writes `"light"` (the server attribute stands), never
  reads or writes storage, and registers no change listener — a user-facing theme setting,
  persistence, and live reaction to OS changes after first paint are out of scope by name.
- Dark then differs from light purely because token values flip under `[data-theme="dark"]`
  (R-UI-001: "dark mode flips values, never consumer code"): no component, including this
  page, branches on the theme. `globals.css`'s existing `color-scheme` rules follow the same
  attribute, so browser chrome (scrollbars, form controls) flips with it.
- `suppressHydrationWarning` on `<html>` is the lawful cost: React hydrates against a DOM
  whose `data-theme` the script may have changed, and that one attribute mismatch is by
  design.

### The `/` landmark (`src/app/page.tsx`)

`/` renders — it does not redirect. It is the Golden Path's first checkpoint and stays a real
page even after auth ships (inc-009 adds links; until then the page has none). Default export
`HomePage`, no interactive elements, markup complete:

```tsx
<main data-testid="root-home-main">
  <h1 data-testid="root-home-heading">{strings.app_title}</h1>
  <p data-testid="root-home-tagline">{strings.home_tagline}</p>
</main>
```

Both strings come through the aggregate `strings` export of `src/ui/strings` (never the
`spine` table directly, per that barrel's rule). Geometry, per I-11 as inline styles:

- `main` — `minHeight: "100dvh"`, `display: "flex"`, `flexDirection: "column"`,
  `alignItems: "center"`, `justifyContent: "center"`, `gap: "var(--space-2)"`,
  `padding: "var(--space-5)"`, `textAlign: "center"`. The product name sits at the optical
  center of an otherwise empty graphite-0 field — a nameplate, not a splash screen.
- `h1` — `fontSize: "var(--text-32)"`, `margin: 0`. Colour (`--graphite-900`), weight
  (`--weight-heading`) and line-height (`--leading-ui`) are inherited from the `globals.css`
  ground and heading rules; restating them here would be a second home. No letter-spacing, no
  uppercase (R-UI-003).
- `p` — `fontSize: "var(--text-16)"`, `color: "var(--graphite-700)"` (the secondary text
  role), `margin: 0`.

No brand mark: R-UI-070 puts the full spark mark on sign-in and certificates and the quiet
mark on the rail — none of which is this page. No favicon work beyond what already exists (out
of scope). Density (R-UI-005) does not apply — no table, no rows. The page wraps and reflows
at 200 % zoom and at `sm` widths on the `--space-5` padding alone (R-UI-060).

## 2. States (R-UI-050)

The page is static content compiled into the bundle; it consults no seam and awaits nothing.
The matrix is ruled cell by cell so the enumeration is checkable:

- **Default** — the only rendered state. Content per §1, in both themes.
- **Loading** — none. Server-rendered from strings already in the bundle; there is nothing to
  await, so no skeleton exists (a skeleton for instant content would be theatre, R-UI-004).
- **Empty** — impossible. The copy is compiled in; an empty `/` cannot occur.
- **Error** — a render fault at `/` mounts the root error boundary (`src/app/error.tsx`),
  whose own Decision rules that screen; this page adds nothing to it.
- **Refusal** — none. No request is made, so nothing can be refused; there is no list here
  owing an emptiness explanation (R-UI-020 is satisfied vacuously, and no screen-local
  refusal block may be invented).
- **Partial** — impossible; there are no rows to partially show.
- **Offline** — indistinguishable by design. If the document loaded, it renders fully and
  nothing on it can go stale; if it never loaded, the browser's own offline page shows before
  any of our code runs. No offline banner — that banner protects screens showing data that
  can age, which this one has none of.
- **Permission-denied** — impossible. `/` is the public, unauthenticated entry; no permission
  gates it and none is named.

No interactive elements means no focus reticle on this screen and nothing for Tab to reach —
lawful, because the page offers no actions until inc-009 (auth links) and inc-013 (shell
navigation) add them; R-UI-012 binds interactive elements, of which there are zero.

## 3. Copy, verbatim (C-SPINE-PLATFORM, R-SPINE-060)

`src/ui/strings/spine.ts` gains exactly two keys (a lawful extension of the spine table —
presence and fidelity, never closure):

- `app_title` → **Vextrus Cubit**
- `home_tagline` → **From drawing to bill of quantities.**

`app_title` is both the document title (via `metadata`, I-12) and the `h1` text — the tab and
the page agree on the product's name. The tagline is one plain sentence stating what the
product does, drawing to bill: no slogan voice, no exclamation mark, no build vocabulary. The
JSX contains no string literals except the three test ids. These values are pinned by the
increment spec and may not be varied here or by the Builder.

## 4. Motion (R-UI-004)

None. The page renders statically with no entrance animation, and theme resolution completes
before first paint, so there is never a light→dark transition to ease. This is a decision: a
nameplate that animates is a splash screen. `prefers-reduced-motion` is satisfied vacuously;
no duration token is consumed.

## 5. Tokens

Named directly by this screen: `--space-2`, `--space-5`, `--text-32`, `--text-16`,
`--graphite-700`. Inherited from the `globals.css` ground rather than restated:
`--graphite-0`, `--graphite-900`, `--font-ui`, `--text-14`, `--weight-body`,
`--weight-heading`, `--leading-ui`. No other token, and no literal colour, size or duration,
may appear in `layout.tsx` or `page.tsx` — save the two non-design layout keywords I-11 names
and closes (`minHeight: "100dvh"`, `margin: 0`), for which the token source emits nothing.

## 6. Themes

Neither file branches on the theme; every dark/light difference arrives through token values
under the root `[data-theme]` (R-UI-001). The visible character: light is near-white
graphite-0 (`#F4F5F4`) with near-black text; dark is near-black (`#0C0E11`) with near-white —
the full-viewport ground flip is what guarantees AC-2's dark capture is not byte-identical to
the light one. Contrast holds by founder fact in both themes: graphite-900 on graphite-0
(primary text) and graphite-700 on graphite-0 (the tagline's secondary role, ≥ 4.5:1).

## 7. Test hooks (closed contract, C-05)

Route introduced: `/` (it renders; it never redirects). Test ids, exactly these three, on the
elements ruled in §1: `root-home-main` (the `<main>`) · `root-home-heading` (the `<h1>`) ·
`root-home-tagline` (the `<p>`).

Behavioural hooks without new ids:

- `document.documentElement` carries `lang="en"` and `data-theme` — `"light"` in a default
  Playwright context, `"dark"` in a context created with `colorScheme: "dark"`, observable
  immediately after load (the emulation lever; the OS is never coupled).
- `document.title` is non-empty and equals **Vextrus Cubit**.
- "Before first paint" is read off the **served HTML**, not off a settled attribute: at each
  checkpoint the journey fetches `/` and asserts the resolver is an inline `<script>` in `<body>`
  whose code mentions `data-theme`, carries no `defer`/`async`/`type="module"`, contains no
  deferring call (`addEventListener`, `DOMContentLoaded`, `onload`, `setTimeout`,
  `requestAnimationFrame`, `requestIdleCallback`), stands ahead of the landmark, and has nothing
  paintable before it in `<body>` (React's `<div hidden>` bookkeeping and comment markers are the
  only lawful company). A post-load `data-theme` read cannot tell a pre-paint resolver from a
  late one — every late variant leaves the attribute correct once the page has settled — so this
  source read, not that attribute, is what binds AC-2's "before first paint".
- axe (injected from `node_modules/axe-core`) at `/`: violations with impact `serious` or
  `critical` number exactly 0 — never widened to any-impact (Q-11).
- The J-000 spec (`tests/e2e/j-000-golden-path.e2e.ts`, title containing "J-000") compares
  its light and dark full-page captures at runtime with `Buffer.equals` and asserts
  inequality; no baseline file is committed (the full V-E2E lane is out of scope).
- The capture comparison does not stand alone, and may not: `color-scheme: light|dark` on
  `:root` repaints the browser's own canvas whether or not a token ever resolved, so two
  differing captures alone would also be produced by a document that loaded no stylesheet.
  Each checkpoint therefore reads the ground off `html` in the running browser —
  `--graphite-0`'s resolved value (non-empty, i.e. tokens.css is on the document), and
  `html`'s computed `background-color`, which must equal that same token value pushed through
  the browser's colour parser — and the two checkpoints together assert the token *value*
  differs between light and dark. That is what binds AC-2's byte difference to R-UI-001's
  token flip rather than to the UA canvas.
- `webServer.reuseExistingServer` is opt-in (`E2E_REUSE_SERVER=1`, and never under `CI`), not
  the scaffold's off-CI default. Playwright skips the whole `next build && next start` command
  when the port already answers, so a leftover listener from an earlier session would silently
  hand the journey a stale bundle to walk; a gate or plain local run therefore always builds.
- Journey checkpoints: **root-entry** (light: the landmark, heading and tagline on the
  graphite-0 ground, non-empty title, axe clean) · **root-entry-dark** (the same page under
  dark emulation with `html[data-theme="dark"]` and a differing capture).
- The jsdom acceptance (`tests/app/root-document.test.ts(x)`) imports the layout and page
  modules and renders `HomePage`: the three test ids, heading text `strings.app_title`,
  tagline text `strings.home_tagline`, `metadata.title === strings.app_title`, and no
  interactive element inside the landmark.
