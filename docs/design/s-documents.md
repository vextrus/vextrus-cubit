# Design Decision — S-Documents (the project's issued documents)

Route `/t/{tenant}/p/{project}/documents` under `src/app/(app)/t/[tenant]/p/[project]/documents/**`,
inside the shell frame and behind `authorizePage({ tenant, project })`. Increment
inc-300b-documents-list. Law: R-SPINE-040, R-UI-004/005/010/012/020/031/050/060/080/081/082/083/084/
085/086, S-Documents, B-17, B-19, B-20, C-05, C-13.

Cut from the **grid workspace template** (Direction §3.2) with the template's optional furniture
absent by scope — no tabs row, no filter bar, no tree, no inspector, no footer totals: the domain has
no filter, no selection and no subtotal here. Files: `documents/{page.tsx,documents-screen.tsx,
route-address.ts,links.ts,loading.tsx,states.ts,documents.css}`; copy at `src/ui/strings/documents.ts`;
the fourth quick action in `home/areas.ts` with its label in `home/strings.ts`. Chrome is shipped
primitives only — DataTable v2, IdChip, EnumLabel, EmptyState, Button, Skeleton — plus the
`cx-documents-*` classes this file rules. No pattern is invented, so no gallery entry is added. The
screen is a reader: it issues nothing, so no copper, no ConsequenceDialog and no act door appear on it.

## 0. Interpretations (continuing the chain above s-schedules' I-257)

- **I-258 — the row IS the link, and there is no preview.** The door serves an attachment
  (`/api/documents/{id}?…`), so the last cell is one anchor per row (`documents-open`) and the screen
  renders no viewer, no thumbnail and no inspector. A row is not selectable: with nothing to inspect,
  a selection would mount the shell's one right column to show what the row already says (R-UI-080).
- **I-259 — order is the recency, because the listing states no date.** `DocumentListing` answers id,
  kind, version, sha256, issuedBy, supersededBy and (this increment) actIds — no `issuedAt`. The
  screen therefore renders **no When column** and never sorts: `listDocuments`' own order (issued
  descending, then version, then id) is what "newest first" means here, and a column the store does
  not answer would have to be fetched in a second read.
- **I-260 — a kind is an enum for R-UI-082's purpose.** `proof` is a registry key, not prose: it
  renders through `EnumLabel` with the string-table label `documents_kind_<kind>` where one exists and
  `humaniseEnum` otherwise, the raw key kept on `data-kind` and in the primitive's technical
  disclosure. A kind added by a later increment reads as words on the day it is registered.
- **I-261 — "Current" is a statement, not a blank.** The Superseded-by cell renders on every row:
  an `IdChip` of the superseding document where one exists, and the word `documents_current` in
  `--ink-muted` where none does. An empty cell would leave a reader to infer the live issue from a
  hole (R-UI-020: silence never happens).
- **I-262 — two act chips and a count.** A cell never wraps (R-UI-083) and a tooltip full of uuids
  teaches nothing, so the Acts-cited cell renders the first two act ids as chips in the listing's
  order, then `documents_acts_more` in `--ink-muted`; with no act cited it renders
  `documents_no_acts` — **No acts cited** — in `--ink-muted`. The whole set belongs to the act log,
  which the audit screen already lists. *Amended by inc-300b-documents-list (§9): the cell said
  `shell_status_absent`, the em dash of an absent figure, and a dash in a column of identifiers reads
  as a value nobody filled in rather than as the fact that the document stands on no committed act.
  Silence never happens, so this cell says what is true in words (R-UI-020).*
- **I-263 — retry is this address, requested again.** The screen runs no procedure, so `documents-retry`
  is a `next/link` to `documentsRoute(tenantId, projectId)` wearing the core Button at
  `data-variant="secondary"` — which is why the screen is handed its two segment ids. `useRouter` is
  not used anywhere, so `DocumentsScreen` mounts bare under jsdom.
- **I-264 — an expired link is answered at the door, not on the list.** The link is minted per render
  with `DOCUMENT_LINK_TTL_SECONDS` 900; a link followed after that is refused by
  `/api/documents/{id}` with its registered code. This screen's remedy for it is the list itself —
  the matrix's refusal cell carries `DOCUMENT_URL_EXPIRED` with this route as its evidence link.

## 1. Layout and hierarchy (1440 × 900)

```
┌R─┬──────────────────────────────────────────────────────────────────────────────┐
│▲ │ ws › Sattva Court ▾ › Projects › Documents                     ⌘K ⟳ ✉ ◉ │ top bar 40
│  ├──────────────────────────────────────────────────────────────────────────────┤
│▦ │ Documents                                                       2 documents   │ header 32
│▤ ├────────┬────────┬───────────┬──────────┬──────────┬─────────────┬────────────┤
│⚙ │ Kind   │ Version│ Issued by │ Digest   │Acts cited│Superseded by│ Document   │ header 28
│  │ Proof  │      2 │ 7c1e4a2 ⎘ │ 9f3b81c ⎘│ 4a0d2e1 ⎘│ Current     │ Open PDF   │ rows 28
│  │ Proof  │      1 │ 7c1e4a2 ⎘ │ 21bd7f0 ⎘│ e77c903 ⎘│ 3d92f5a ⎘   │ Open PDF   │
│  │        │        │           │          │          │             │            │
│  │        │  28 px rows · 13 px · frozen Kind · sticky header · no wrapping cell │
│  │        │                                                                      │
│  └────────┴──────────────────────────────────────────────────────────────────────┘
└──┴──────────────────────────────────────────────────────────────────────────────┘
      (no right column: nothing on this screen is selectable — R-UI-080, I-258)
```

Above the fold: the grid's header stands 24 (the frame's own padding on `shell-main`) + 32 + 4 =
**60 px** below the top of main and its first row at 88 px, at 1440×900 and at 1280×800 alike —
inside §7 C2's 120. Work-surface share: the grid is 1344 × 720 of main's 1392 × 804 = **86 %**; at
1280×800, 1184 × 620 of 1232 × 704 = **85 %**. Twenty-five rows are visible without scrolling. The
grid scrolls inside its own viewport, horizontally at 1280 with the Kind column frozen; the page
never scrolls sideways (§7 C10).

| Region | What it holds | Width / height rule | Tokens | State when empty |
|---|---|---|---|---|
| top bar + rail | the shell's; `shell-crumb-page` reads **Documents** under workspace › project › Projects, declared by `useShellPage(strings.documents_title)` and `routes.ts` | `--rail-w` 48 · `--topbar-h` 40 | the shell's | — |
| header track | `<h1>` `documents_title` at `--text-20`/`--weight-heading`, and at its right the `<span role="status">` count readout `documents_count` in `--font-mono` `--text-caption`, tabular | 100 % × 32; `margin-bottom: var(--space-1)` | `--ink`, `--ink-muted`, `--font-mono` | the count reads **0 documents** and the heading stands |
| grid (primary) | `documents-grid`: DataTable v2 over the listing, `tableId` `s-documents`, `data-rows-rendered` = `String(rows.length)`, rows `documents-row`, seven columns (below), no sort, no filter row, no group rows, no selection | `flex: 1 1 auto`, 100 % × remainder; ≥ 55 % of main; rows `--row-h` 28, header 28 sticky, first column frozen | `--surface-app`, `--surface-sunken` (header), `--ink`, `--ink-code`, `--font-mono`, `--cell-px`, `--cell-py`, `--hairline` | not rendered at all: `documents-empty` stands in its place |
| empty (in the grid's place) | the shipped `EmptyState` `documents-empty`: heading, one sentence, one action to the takeoff register | max-width 520, centred in the grid's box — the sentence is a paragraph at the measure the fault block stands at, never a line the width of the work column | `--ink`, `--ink-muted`, `--accent` through Button | this IS the empty state |
| error (in the grid's place) | `documents-error`: heading, one sentence, `documents-report-id` (`IdChip` under `documents_report_label`), `documents-retry` | 100 % × auto, max-width 520 | `--ink`, `--ink-muted`, `--hairline`, `--radius-4` | — |
| inspector (frame's one slot) | nothing ever mounts it here (I-258) | **absent — width 0** | — | absent |

**Columns**, left to right, widths multiples of 4:

| # | Header | Width | Cell |
|---|---|---|---|
| 1 | `documents_col_kind` | 200, **frozen** | `EnumLabel` over the kind, label `documents_kind_<kind>` else `humaniseEnum` (I-260); raw key on the row's `data-kind` |
| 2 | `documents_col_version` | 96, `meta.align: 'right'` | the bare integer, `--font-mono` tabular slashed-zero |
| 3 | `documents_col_issued_by` | 200 | `IdChip` `documents-issued-by`, `data-value` the whole uuid |
| 4 | `documents_col_digest` | 200 | `IdChip` `documents-digest`, `data-value` the whole 64-hex sha256 |
| 5 | `documents_col_acts` | remainder, min 240 | up to two `IdChip`s `documents-act`, then `documents_acts_more`; `documents_no_acts` where none (I-262) |
| 6 | `documents_col_superseded` | 220 | `documents-superseded-by`: an `IdChip` of the superseding id, or `documents_current` in `--ink-muted` (I-261) |
| 7 | `documents_col_document` | 160 | `documents-open`: an `<a href={row.href}>` wearing `cx-btn cx-reticle` `data-variant="ghost"`, text `documents_open`, `aria-label` `documents_open_label` filled with kind and version |

Each row carries `data-document` (the row id), `data-kind`, `data-version` and `data-superseded`
(`"true"`/`"false"`), all from the listing verbatim, through the DataTable's `rowDataOf`.

## 2. States (R-UI-050), ruled cell by cell

`DOCUMENTS_STATES` in `documents/states.ts` = `["loading","empty","error","ready"]` — the four a
reader can stand in — and `documents-screen[data-state]` derives in that order, first holding wins.
The seven-cell declaration lives in `src/ui/screen-states/matrix.tsx` under
`/t/[tenant]/p/[project]/documents`, spread from `workspaceCells` as s-audit's is, with the four
cells below overridden; `tests/screen-states/**` reflects over it and `missingStates` counts it.

- **Loading** — `loading.tsx`, frame and header track intact, root at `data-state="loading"`: the
  DataTable in its `loading` posture over the same `DOCUMENTS_COLUMNS` (exported beside
  `DocumentsScreen`, one spelling) — the header real, the body eight `datatable-skeleton-row` bones
  at `--row-h`, the count readout absent. Never a spinner on a table (R-UI-004).
- **Empty** — no document has been issued. `documents-empty` fills the grid's place, the grid does
  not render, and the one action is `documents_empty_action` → `takeoffRoute(tenantId, projectId)`:
  a document is issued from published work, so the register is where a reader goes next.
- **Partial** — impossible on this screen and declared as such: one read, answered whole, over rows
  that cannot individually refuse (a listing row is six columns of its own record). The matrix's
  partial cell mounts `state_partial_documents` as an inline answer; no row ever renders
  `data-refused`.
- **Error** — the read threw. `page.tsx` records it once through `reportFault` and hands the
  `faultId` down as `reportId`; `documents-error` stands in the grid's place with
  `documents_error_heading`, `documents_error_body`, the id through `documents-report-id` under
  `documents_report_label`, and `documents-retry` re-requesting this address (I-263).
- **Refusal** — this screen runs no procedure and registers no code of its own. Its one reachable
  refusal is a stale link, answered by the download door: the matrix cell renders the ONE
  `RefusalState` from the registered `DOCUMENT_URL_EXPIRED` entry — its own message and remedy, never
  paraphrased — with evidence `{ href: documentsRoute(...), label: documents_evidence_list }`. No
  screen-local refusal block exists anywhere (R-UI-020, B-17).
- **Offline** — a fault of reachability: the read is server-rendered, so a failed navigation surfaces
  the error path, and the rows on screen are what stood when the page loaded. No banner is invented —
  there is no door here to disarm — and the matrix cell is the shared workspace one.
- **Permission-denied** — delegated to `authorizePage({ tenant, project })`, which answers before
  anything renders: the matrix cell names the permission and its holder,
  `state_denied_documents_permission` over `state_denied_documents_holder`, on the registered
  `PERMISSION_NOT_HELD` entry with the project's participants screen as evidence. A workspace the
  session does not hold is the shell's frameless denial; unauthenticated is the `/sign-in` redirect.

## 3. Copy, verbatim (`src/ui/strings/documents.ts`, keys `documents_…`)

`documents_title` **Documents** · the count readout's two forms, `documents_count_one` **1 document**
and `documents_count_other` **{count} documents** · `documents_grid_label` **Issued documents** · `documents_col_kind` **Kind** ·
`documents_col_version` **Version** · `documents_col_issued_by` **Issued by** · `documents_col_digest`
**Digest** · `documents_col_acts` **Acts cited** · `documents_col_superseded` **Superseded by** ·
`documents_col_document` **Document** · `documents_kind_proof` **Proof** · `documents_current`
**Current** · `documents_acts_more` **+{count} more** · `documents_no_acts` **No acts cited** ·
`documents_open` **Open PDF** ·
`documents_open_label` **Open {kind} version {version} as a PDF** · `documents_empty_heading` **No
document issued yet** · `documents_empty_body` **An issued document seals a published figure, the
basis behind it and the acts that committed it into a PDF that never changes. Publish from the
takeoff register, and every issue appears here, newest first.** · `documents_empty_action` **Go to
the takeoff register** · `documents_error_heading` **The documents could not be listed** ·
`documents_error_body` **Nothing was changed. Try again, and quote the report id if it keeps
happening.** · `documents_report_label` **Report id** · `documents_retry` **Try again** ·
`documents_evidence_list` **Open the documents list**.

In `home/strings.ts`, for the fourth quick action: `project_home_action_documents` **Documents**.

Reused by key and never respelled (B-17): the registered `DOCUMENT_URL_EXPIRED` and
`PERMISSION_NOT_HELD` messages and remedies.

The matrix reads THIS TABLE, and there is no mirror. This screen's copy lives in the shared
`src/ui/strings/documents.ts` rather than in a `strings.ts` beside its route, and `src/ui/strings` is
a layer the matrix may import — so `src/ui/screen-states/matrix.tsx` says this screen's sentences by
this screen's own keys and a second spelling of any of them would be the drift a mirror exists to
survive. Matrix-only, and keyed with the rest: `documents_state_partial` **The list is one read
answered whole: every issue this project holds is shown, and a row that could not be read would be
the read failing, not a row refusing.** · `documents_denied_permission` **Reading this project's
documents needs membership of the project.** · `documents_denied_holder` **A project principal can
add you on the participants screen.** *Amended by inc-300b-documents-list (§9): this section ruled a
mirror into `src/ui/strings/screen-states.ts` under `state_…` keys, which is the arrangement a
route-local table needs and this screen does not have (C-13, R-SPINE-060).*

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "seam", "store",
"door", "digest pin" and every clause id appear nowhere a reader can see. Kinds render as words
through `EnumLabel`; uuids, digests and act ids are model data and render only through `IdChip`,
never woven into a sentence (R-UI-082).

## 4. Motion (R-UI-004)

Nothing on this screen eases in: it is a read and every row arrives complete. The only transitions
are inherited from single homes — row hover fill, the chip's copy-state and the Button's and
anchor's colour over `var(--motion-state)` `var(--ease)`; the Tooltip's own entrance from the
primitive; the reticle draw at `var(--motion-reticle)` from `reticle.css`; the Skeleton pulse while
`loading.tsx` holds the route. No entrance on the header, the grid, the empty state or the error
block; no bounce, no spinner, no shimmer beyond one skeleton cycle. Every duration is a token zeroed
at source under `prefers-reduced-motion`, so `documents.css` carries no reduced-motion branch.

## 5. Tokens

Only the semantic alias group and the density/layout tokens (Direction §4.1, §4.2); a `--graphite-*`
or `--beam-*` reference outside `tokens.ts` is a lint failure (R-UI-086, `cubit/no-primitive-token`).
This screen spends: `--surface-app` · `--surface-panel` · `--surface-sunken` · `--surface-hover` ·
`--ink` · `--ink-secondary` · `--ink-muted` · `--ink-code` · `--line` · `--hairline` ·
`--accent` (only through the Button the empty state renders) · `--space-1/2/3/4` · `--radius-4` ·
`--text-20` · `--text-body` · `--text-caption` · `--font-ui` · `--font-mono` · `--leading-ui` ·
`--weight-body-medium` / `--weight-heading` · `--motion-state` / `--motion-reticle` / `--ease`; and,
read by the primitives rather than stated here, `--row-h`, `--cell-px`, `--cell-py`, `--control-h`.
Px literals, closed set: the header track's 32, the 520 measure the error block and the empty state
both stand at, the seven column widths (200/96/200/200/240/220/160) and the loading leg's eight
bones. Any other literal is a defect.
No basis colour, no semantic tint and **no copper anywhere**: listing a document is never an act.

## 6. Themes

`documents.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Dark is the default and light is complete; both are captured, the light
picture by `emulateTheme(page, "light")` inside the dark lane, restored by `restoreLaneTheme`.
Contrast holds on the founder values in both themes: `--ink` and `--ink-secondary` on `--surface-app`
and on the sticky header's `--surface-sunken` clear 4.5:1; `--ink-muted` (graphite-600) clears 4.5:1
as the Current word, the act count and the caption; the chip's copy IconButton and the row-hover fill
clear the 3:1 UI floor. Nothing on the screen carries meaning by colour alone — superseded is a word
and a chip, current is a word, and the kind is a word (R-UI-060).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenantId}/p/{projectId}/documents` (`documentsRoute`, the one spelling; crumbs in
`routes.ts`, `shell-crumb-page` reads **Documents**) and the file route
`/t/[tenant]/p/[project]/documents` (the matrix key). Linked, all shipped:
`/api/documents/{id}?tenant={tenantId}&expires={digits}&signature={hex}` (each row's minted link,
`DOCUMENT_LINK_TTL_SECONDS` 900), `/t/{tenantId}/p/{projectId}` (S-Project, whose fourth quick action
reaches this screen — R-UI-031), `/t/{tenantId}/p/{projectId}/takeoff` (the empty state's action).
Procedures: none. Reads: `listDocuments(tx, projectId)` and `documentDownloadUrl(storage, row, opts)`.

Test ids, exactly the registry's spellings, on the elements ruled in §1: `documents-screen`
(`data-state`: loading|empty|error|ready) · `documents-grid` (`data-rows-rendered`) ·
`documents-row` (`data-document`, `data-kind`, `data-version`, `data-superseded`) ·
`documents-issued-by` · `documents-digest` · `documents-act` · `documents-superseded-by` ·
`documents-open` · `documents-empty` · `documents-error` · `documents-report-id` ·
`documents-retry`; and on S-Project, `project-quick-action` (`data-action="documents"`). Used and
never redefined, other files' ids: `datatable-header` (the grid's sticky header row),
`datatable-row` (the DataTable's default row id, which `rowTestId="documents-row"` replaces here —
that is the prop's declared purpose), `id-chip` (the primitive's default, which every named chip on
this screen overrides; the copy buttons derive as `documents-digest-copy` and its kin),
`shell-crumb-page`, `shell-main`, `empty-state`, `enum-label`, `refusal-state`, `skeleton`. No other
id is introduced.

Behavioural hooks without new ids: `data-theme` at the document root, read by the light baseline ·
`data-value` on every `IdChip` and `EnumLabel`, where the whole uuid, the whole 64-hex digest and the
raw kind key stay · `role="status"` on the count readout · `aria-label` `documents_grid_label` on the
grid · a per-row `aria-label` on `documents-open` (I-258) · `cx-reticle` on every focusable ·
`[data-density]` at the ROOT, the one switch the grid reads `--row-h` from. Asserted absences: no
inspector and no second right column (R-UI-080); no native `select` or `input[type=date]`
(R-UI-083); no uuid, digest or act id as a text node outside an `IdChip` (R-UI-082); no `When`
column (I-259); no wrapping cell; no `documents-grid` while `documents-empty` stands.

Suites and evidence. Journey `tests/e2e/documents.spec.ts`, every title carrying **J-030**, staged
in-process by `tests/e2e/documents/documents-stage.ts` (`stageDocuments`, `stageBareProject`) through
`storeDocument`; page objects `tests/e2e/pages/s-documents.page.ts` and
`tests/e2e/pages/s-project.page.ts`; checkpoints **s-documents/list** (dark, then light by
`emulateTheme`) and **s-documents/empty**, axe serious/critical = 0 at each, never widened; baselines
`tests/e2e/baselines/design-dark/s-documents/*.png`, `masks()` over the shell breadcrumb,
`shell-user` and `shell-tenant-switcher` — every other text on the screen is staged and fixed. Bare
jsdom acceptance (`tests/ui/documents/**`) mounts `DocumentsScreen({ rows, tenantId, projectId,
reportId: null })` over injected listings for order, the four row attributes, the kind label, the
bare version integer, both Superseded-by arms, the act cap and the empty and error branches.

Owed by AC-2 and made by the Builder, not by this file: the fourth `QUICK_ACTIONS` entry
`{ key: "documents", label: "project_home_action_documents", route: documentsRoute }`, the
re-baselining of `PROJECT_QUICK_ACTIONS`, `QUICK_ACTION_ROUTES` and the `tests/ui/project-home`
roster from three to four, the changelog line in `docs/design/s-project.md` naming the fourth action,
and the re-take of every picture the fourth button moves
(`tests/e2e/baselines/design-dark/s-project/**` and any J-000 leg capturing S-Project) in its own
`baseline:`-subject commit naming this proof (B-20).

## 8. Recorded IOUs (owner named, never a comment in `src/`)

- **Issued-by reads as a uuid.** Resolving an issuer to a display name is a second read (a users
  join), out of scope by name; the chip is whole and copyable meanwhile. Owner: the node that owns a
  project-people read.
- **No issue date on the row.** `DocumentListing` states none (I-259). Owner: whoever next widens the
  listing; the column is `documents_col_issued`, a `RelativeTime` cell at 130, when it exists.
- **Issuing from this screen.** No act door, no render, no BOQ or BBS kind. Owners: inc-311a
  (`boq-draft`) and inc-310 (`bbs`), each one kind file and one line (AM-11).

## 9. Changelog

- **inc-300b-documents-list, after the build.** Four amendments, each recorded where it changes the
  screen's contract rather than only here (C-13). (1) The Acts-cited cell with nothing in it says
  `documents_no_acts` **No acts cited** instead of `shell_status_absent`: a dash in a column of
  identifiers reads as a value nobody filled in, and R-UI-020 asks the cell to say the true thing.
  §0's I-262 and §1's column table carry the amendment. (2) The matrix says this screen's sentences
  by this screen's own `documents_…` keys; §3's ruled mirror into `src/ui/strings/screen-states.ts`
  is withdrawn, because that arrangement exists for a screen whose copy sits beside its route and
  this screen's sits in the shared table the matrix may read. (3) §3 names the count readout's two
  forms, `documents_count_one` and `documents_count_other`, which is what a count in words needs.
  (4) The empty state stands at the same 520 measure as the fault block beside it (§1, §5): at the
  full width of the work column its one sentence set as a single ~1 110 px line and read as a banner.
- **inc-300b-documents-list, the demonstration door.** `documents/demonstration.ts` answers the
  `?__state=` instrument for all four names §2 resolves — `ready`, `empty`, `error`, and `loading`,
  which stands the reader in `loading.tsx` itself rather than in a second drawing of it — so the
  grid, its chips, its bones and its links can be reviewed on a served product before the first door
  that issues a document lands. The rows it answers are named as a demonstration and name nothing any
  workspace holds; the instrument is armed by name and shut everywhere else. Their links are written
  through `documentDownloadUrl` (§7's one mint) over a signer of the door's own that signs nothing:
  an installation that states no signing secret refuses to sign at all (Q-12), and a demonstration
  that asked it to would answer the reviewer with the crash boundary instead of a cell. What the row
  then carries is a link of the seam's shape that the download door refuses, as it refuses any link
  it did not sign.
