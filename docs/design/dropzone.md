# Design Decision — Dropzone (the upload pattern)

Not a routed screen: the single upload-gathering pattern `Dropzone` in
`src/ui/patterns/dropzone` — the one home (B-17) every surface that takes drawings from a
person opens, mounted in this increment in the `/design` gallery only; S-Drawings (inc-108)
is the named product consumer (R-UI-011). Law: R-SPINE-020, R-UI-001/003/004/005/010/011/
012/020/033/050/060, Q-07, Q-12, B-17, Q-17. Every convention of the earlier Decisions
binds: `cx-` classes, variants on data-attributes, tokens-only colour and motion,
`cx-reticle` solely from its single home, no `[data-theme]` selector in authored CSS;
Interpretations I-1–I-68 remain in force. Chrome comes only from shipped primitives — core
Button, the one RefusalState — plus the `cx-dropzone-*` classes this file rules. Barrel
`index.ts` exports `Dropzone` and `uploadFiles` only; props exactly `onFiles`, `items`,
`accept?`. Stylesheet `dropzone.css`. Copy lives in `src/ui/strings/dropzone.ts` (keys
`dropzone_…`, registry append); JSX carries no string literal beyond test ids and fixed
attribute values. `import type { RefusalEntry }` only — ui stays value-import-free of core
(ARCH-01, the refusal-state ruling), so every number a row shows is formatted by the
consumer through SEAM-FORMAT and arrives as `progress`.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-69 — the pattern supplies its own evidence link.** R-UI-020 and RefusalState's closed
  props require an evidence link on every refusal; `DropzoneItem` carries `refusal` and no
  evidence, and the prop set is closed. Ruling: the Dropzone builds it — label
  `dropzone_evidence_formats`, href the fragment of *this instance's* accepted-formats line
  (`#${useId()}`, so two mounts on one page do not share an id). The place that resolves a
  refused upload is the sentence saying what the product accepts, and it is on screen. One
  string key is added for the label; string keys are not part of C-05's freeze, and a
  refusal rendered without its link would be.
- **I-70 — the queue shows a progress *line*, never a bar.** No Progress primitive ships,
  and a determinate bar needs a fraction; the item carries a formatted string the consumer
  produced through the format seam. Minting a bar here would be an inventory ahead of its
  consumer (R-UI-011) and a second home for progress paint (B-17). Ruling: text only, mono,
  tabular-nums — a person reading drawings reads bytes, not a filled rectangle.
- **I-71 — the pickers are hidden inputs behind real Buttons.** A file input renders a
  UA-styled control that cannot wear the reticle and cannot be restyled to the house's
  Button. Ruling: both inputs are visually hidden (`clip-path: inset(50%)`, 1 px box),
  `tabindex="-1"` and `aria-hidden="true"`; the two shipped core Buttons above them carry
  the accessible names and open them with `.click()`. One tab stop per door, every focus
  visible (R-UI-012). `dropzone-browse` names the file door; the folder door is found by its
  accessible name (`dropzone_browse_folder`) and its input by `dropzone-folder-input` — the
  test-id roster is closed at six and a seventh is a spec revision.
- **I-72 — a refused row keeps its state word and adds no sentence.** "No other text of its
  own" bars the pattern from writing prose about a refusal, not from labelling the row:
  `dropzone_state_refused` is the fifth of five registered state words, rendered in the same
  slot as the other four, and a row that dropped it would leave the queue's one status
  column blank exactly where it matters most. Ruling: name, state word and progress render
  in every state; in `refused` the RefusalState is appended below them and the pattern
  authors nothing beside it.
- **I-73 — the live region is the state word, never the progress line.** R-UI-060 owes live
  regions for job status. A polite region over the whole row would announce every chunk —
  the same sentence forty times for one file. Ruling: `aria-live="polite"` sits on the state
  word `<span>`, which changes at most four times per row (queued → uploading →
  stored/duplicate/refused); the progress line stays in the accessibility tree, readable on
  demand, and is never announced.
- **I-74 — the queue is flat, and partial is rendered.** A `.zip` and a dropped folder are
  many drawings under one presented name, and `DropzoneItem` has no children. Ruling: the
  consumer composes one row per presented name plus one row per archive member — accepted
  members `stored`/`duplicate`, skipped members `refused` carrying the registered
  `FORMAT_NOT_ACCEPTED` entry — and the pattern renders `items` in array order, imposing
  none of its own. A set where two sheets stored and one was refused shows all three rows
  (R-UI-050's partial); nothing is hidden and no tally stands in for a name.
- **I-75 — density arrives from the frame, not from a prop.** The props are closed and the
  shell publishes `data-density` on `shell-root` (density-and-prefs I-35). Ruling:
  `dropzone.css` binds the row's minimum height to `var(--row-comfortable)`, and an ancestor
  `[data-density="compact"]` re-keys it to `var(--row-compact)` — the published attribute
  read as the contract it is. In the gallery, which stands outside the frame, rows are
  comfortable.
- **I-76 — the whole pattern is the drop target.** A file released over the queue is not a
  miss. Ruling: the drag handlers sit on the root `<section>`, and the dragging paint is
  drawn on the zone inside it; enter/leave are counted (a depth counter), so crossing a
  child's boundary does not flicker the state back to `idle`. `dragover` is prevented so the
  browser does not navigate to the dropped file — the classic silent data loss.

## 1. Layout and hierarchy

Two regions, stacked, column flex, gap `var(--space-4)`; the pattern sizes to its container
and sets no width of its own (outer spacing is always the consumer's).

```
<section data-testid="dropzone" data-state="idle|dragging" class="cx-dropzone">   ← handlers, I-76
  <div class="cx-dropzone-zone">
    <p  class="cx-dropzone-prompt">dropzone_prompt</p>
    <div class="cx-dropzone-doors">
      <Button data-variant="secondary" data-testid="dropzone-browse">dropzone_browse</Button>
      <Button data-variant="ghost">dropzone_browse_folder</Button>
    </div>
    <p  id={acceptsId} class="cx-dropzone-accepts">dropzone_accepts</p>
    <input data-testid="dropzone-input"        type="file" multiple>          ← hidden, I-71
    <input data-testid="dropzone-folder-input" type="file" webkitdirectory>   ← hidden, I-71
  </div>
  <ul class="cx-dropzone-queue">                                    ← only when items.length
    <li data-testid="dropzone-item" data-name={name} data-state={state}>
      <p    class="cx-dropzone-item-name">{name}</p>
      <span class="cx-dropzone-item-state" aria-live="polite">{state word}</span>
      <span data-testid="dropzone-item-progress" class="cx-dropzone-item-progress">{progress}</span>
      [RefusalState]                                        ← only when state === "refused"
    </li>…
  </ul>
</section>
```

- **The zone** dominates while the queue is empty and recedes once it fills — it keeps one
  size either way, because a target that shrinks under the rows it produced is a target that
  moves while a person is dropping on it. Centred column, gap `var(--space-2)`, padding
  `var(--space-6)` `var(--space-5)`, min-height 160 px (core I-1's mandated class: a drop
  target needs a body no token measures), border 1 px dashed `var(--graphite-300)`, radius
  `var(--radius-8)`, no fill. Dashed is the one place this system draws a dashed line: it
  says "an outline waiting to be filled", which is exactly the affordance.
- **Prompt** — `var(--text-14)` `var(--weight-body-medium)` `var(--graphite-900)`. The
  teaching line (R-UI-033): it names the gesture and the two shapes a drawing set arrives in.
- **Doors** — flex row, gap `var(--space-2)`: the shipped secondary Button (the file door,
  the common case) then the ghost Button (the folder door). Both are keyboard-reachable and
  wear the reticle from its single home.
- **Accepts line** — `var(--text-12)` `var(--graphite-600)`, the formats and the ceiling
  stated before anything is dropped, not after something is refused (Q-12's "uploads
  validated", said to the person up front). It is also I-69's evidence target.
- **Dragging** (`[data-state="dragging"]`) — the zone's border turns solid
  `var(--beam-500)` and takes fill `var(--beam-100)`; nothing moves, nothing scales. The
  state is carried by two channels (border style and fill), never by colour alone.
- **Queue** — `<ul>`, list-style none, margin/padding 0, rows separated by `var(--hairline)`
  border-top after the first. Each `<li>`: min-height per I-75, padding-block
  `var(--space-2)`, a three-column grid (`1fr auto auto`, gap `var(--space-3)`, align
  centre) that wraps the RefusalState onto its own full-width track below.
  - **Name** — `var(--text-13)` `var(--graphite-900)`, single line, ellipsis, `dir="ltr"`
    (a path is a path). The relative path renders verbatim — `structural/S-101.dxf`, not a
    basename: which folder a sheet came out of is drawing information.
  - **State word** — `var(--text-12)` `var(--weight-body-medium)`, `var(--graphite-600)` for
    `queued`/`uploading`, `var(--success)` for `stored`, `var(--graphite-700)` for
    `duplicate`, `var(--danger)` for `refused`. The word carries the meaning; the colour is
    redundant emphasis (refusal-state I-9, R-UI-060).
  - **Progress** — `var(--font-mono)` `var(--text-12)` `tabular-nums slashed-zero`
    `var(--graphite-700)`, right-aligned (R-UI-005's numerals), the item's string verbatim
    (I-70). An item whose consumer passes an empty string renders an empty element — the
    hook stands, the row does not invent a figure.
  - **Refusal** — exactly one RefusalState from `item.refusal` with I-69's evidence, no
    wrapper chrome, composed as refusal-state §1 rules it. A `duplicate` row is not a
    refusal: identical content is linked and not re-stored, which is a success with a
    different word.

## 2. Component states (the R-UI-050 matrix, ruled)

Root: `idle` · `dragging`. Row: `queued` · `uploading` · `stored` · `duplicate` ·
`refused`. All seven are reachable through props and DOM events, so jsdom and the gallery
mount them. The seven screen states, ruled for this pattern:

- **Loading** — no skeleton. A row's content is known the instant the file is dropped (its
  name) and the wait is the transfer itself, which the `uploading` word and the progress
  line report continuously; a bone standing in for a name the browser already holds would be
  theatre (R-UI-004). The zone itself is compiled-in chrome and waits for nothing.
- **Empty** — `items: []`: the queue element is not rendered at all, and the zone stands
  alone. The empty state teaches by asking (`state_empty_form_asks`'s reading): the prompt
  says the gesture, the accepts line says what will be taken, the file door is the one
  action. No second sentence about an empty list — the list is not there.
- **Error** — the pattern renders none: it performs no request. A fault in the consumer's
  `uploadFiles` call reaches that screen's error cell and, unhandled, the root error
  boundary with its report id (`src/app/error.tsx`). The row can only hold one of five
  states, and a fault is not one of them.
- **Refusal** — the refused row (§1), one RefusalState per row, registered copy verbatim,
  evidence per I-69. Every code the protocol answers renders here: `FILE_TOO_LARGE`,
  `FORMAT_NOT_ACCEPTED`, `DIGEST_MISMATCH`, `UPLOAD_NOT_RESUMABLE`, `SCAN_REJECTED`,
  `WORKSPACE_PERMISSION_NOT_HELD`, `SIGNED_OUT` (which is registered at surface `banner` and
  renders as one across the row's full width — the session outranks the file).
- **Partial** — rendered, never hidden, per I-74: stored, duplicate and refused rows stand
  together in one queue in the order the consumer composed them.
- **Offline** — the protocol's own answer: a transfer that loses its connection leaves the
  row at `uploading` with the progress line frozen at the last acknowledged offset, which is
  the truth — the server holds exactly those bytes and `GET /api/upload/{uploadId}` resumes
  from them. The pattern invents no banner; the consuming screen says the connection is gone
  (`state_offline_transport_fault`'s reading). Recorded IOU — the offline banner over a
  live queue, owner: S-Drawings (inc-108).
- **Permission-denied** — a real cell here, not a delegation: a member of no workspace of
  the project gets `WORKSPACE_PERMISSION_NOT_HELD` on the `POST`, so every queued row
  settles `refused` with the registered copy naming the workspace membership that is missing
  and who grants it. Nothing is uploaded and the zone stays armed — a retry is never
  disarmed.

## 3. Copy, verbatim (`src/ui/strings/dropzone.ts`)

`dropzone_prompt` **Drop drawings here to upload them. A folder or a .zip archive works
too.** · `dropzone_browse` **Choose files** · `dropzone_browse_folder` **Choose a folder** ·
`dropzone_accepts` **DWG, DXF, PDF, PNG, JPG and TIFF, up to 500 MB per file. A .zip is
expanded into the drawings it holds.** · `dropzone_state_queued` **Queued** ·
`dropzone_state_uploading` **Uploading** · `dropzone_state_stored` **Stored** ·
`dropzone_state_duplicate` **Already stored** · `dropzone_state_refused` **Refused** ·
`dropzone_evidence_formats` **See the accepted formats**. Voice: calm, concrete, no
exclamation marks, no build vocabulary; "drawing", "folder" and "archive" are the words the
people who use this say.

### The five codes this increment registers (`src/core/errors.ts`)

Copy rules are refusal-state §3's, unchanged: one sentence saying what was refused, one
starting with the verb that resolves it, no code in either.

| code | severity | surface |
|---|---|---|
| FILE_TOO_LARGE | error | inline |
| FORMAT_NOT_ACCEPTED | error | inline |
| DIGEST_MISMATCH | error | inline |
| UPLOAD_NOT_RESUMABLE | warning | inline |
| SCAN_REJECTED | error | inline |

- **FILE_TOO_LARGE** · message **This file is larger than the 500 MB an upload carries.** ·
  remedy **Send the drawing on its own, or split the set into files of 500 MB or less.**
- **FORMAT_NOT_ACCEPTED** · message **This file is not one of the drawing formats the
  product reads.** · remedy **Upload a DWG, DXF, PDF, PNG, JPG or TIFF — the name and the
  contents both have to say the same format.**
- **DIGEST_MISMATCH** · message **The bytes that arrived do not match the checksum the
  browser took of this file, so nothing was stored.** · remedy **Upload the file again — a
  file that changes while it is being read is the usual cause.**
- **UPLOAD_NOT_RESUMABLE** · message **This upload continued from a different point than
  the one already received, so nothing was added.** · remedy **Resume from the point the
  server reports, or upload the file again from the start.** (Expected and recoverable in
  stride — warning, on the `SIGNED_OUT` reading.)
- **SCAN_REJECTED** · message **The virus scan rejected this file, so it was not stored.** ·
  remedy **Check the file on your own machine, then upload a clean copy.**

## 4. Motion (R-UI-004)

The zone's border colour, border style and fill transition over `var(--motion-state)`
`var(--ease)` on entering and leaving `dragging`. Nothing else animates: rows mount with no
entrance (a queue is an answer, and an answer arrives instantly), the progress line is
replaced text with no tween — a number that eases toward the truth is a number that lies
about the offset — and the state word swaps in place. No bounce, no pulse, no spinner. Every
duration is a token zeroed at source under reduced motion, so `dropzone.css` carries no
`prefers-reduced-motion` branch of its own; the reticle draw and the Button hover live in
their single homes.

## 5. Tokens

`--graphite-0/300/600/700/900` · `--beam-100/500` · `--success` · `--danger` · `--hairline`
· `--space-2/3/4/5/6` · `--radius-8` · `--text-12/13/14` · `--font-mono` ·
`--weight-body-medium` · `--row-comfortable/--row-compact` · `--motion-state/--ease`. The
refusal card's tints and evidence-link paint are RefusalState's own; the doors' paint is the
core Button's. Px literals, closed set (core I-1's mandated class): the zone's 160 px
min-height, the 1 px dashed border, and the 1 px visually-hidden box of I-71's inputs. Any
other literal is a defect. No copper appears anywhere on this pattern — an upload is not an
act (the increment's own ruling: no consequence, no act row).

## 6. Themes

`dropzone.css` contains no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001). Contrast holds on the founder values in both themes:
graphite-600 on graphite-0 ≥ 4.5:1 (the accepts line and the two quiet state words),
graphite-700 and 900 likewise, and the dashed border at graphite-300 clears the 3:1 UI floor
against graphite-0. `--success` and `--danger` on graphite-0 carry the state words at ≥
4.5:1 in both themes, and the beam-100 dragging fill leaves the prompt's graphite-900 above
the text floor in both. The dragging state's second channel (dashed → solid) is what makes
it legible in greyscale.

## 7. Test hooks (closed contract, C-05)

Routes: the pattern declares none and is mounted at `/design`, which exists. The client
`uploadFiles` addresses this increment's three: `POST /api/upload`, `GET
/api/upload/{uploadId}`, `PATCH /api/upload/{uploadId}`.

Test ids, exactly these six, on the elements ruled in §1: `dropzone` (the root `<section>`,
`data-state`) · `dropzone-input` (the multiple file input) · `dropzone-folder-input` (the
`webkitdirectory` input) · `dropzone-browse` (the file door Button) · `dropzone-item` (each
`<li>`, `data-name`, `data-state`) · `dropzone-item-progress` (the progress line, whose text
is the item's `progress` character for character). No others are added: the folder door is
found by its accessible name, and a row's refusal by RefusalState's own ids inside
`dropzone-item`.

Behavioural hooks without new ids: `data-state` on the root flipping `idle` ↔ `dragging` on
`dragenter`/`dragleave`/`drop`; `multiple` and `webkitdirectory` on the two inputs;
`aria-live="polite"` on the state word; `cx-reticle` on both doors; RefusalState's
`data-code` on a refused row; an ancestor `[data-density]` re-keying the row height (I-75).
`onFiles` is invoked exactly once per drop or picker change, with
`{ name, file }` per file where `name` is `webkitRelativePath` when the browser set one and
the file's `name` otherwise.

Acceptance (AC-6, jsdom, `@testing-library/react` + `user-event`): mounts with `items: []`
and asserts the §1 structure, the barrel's two exports, the §3 copy read from
`src/ui/strings/dropzone.ts` by key, the drag flip, the single `onFiles` call on a two-file
drop, and one `dropzone-item` per item with its verbatim progress text; a `refused` item
asserts RefusalState's ids inside the row and no sentence of the pattern's own beside them
(I-72). The gallery entry (`src/ui/gallery-derivation/entries.tsx`, no hooks in `render()`)
publishes `patterns/dropzone/Dropzone` with three states — `idle` (`items: []`), `dragging`
(the same mount, handed the `dragenter` the root listens for, so §4's one piece of motion and
the two channels it moves are on the review surface rather than in jsdom alone) and `queue`,
five rows in this order: **structural/S-101.dxf** `stored` **12.4 MB** · **structural/
S-102.dxf** `uploading` **8.4 MB of 24.1 MB** · **structural/S-103.dxf** `queued` **0 B of
9.7 MB** · **arch/A-201.pdf** `duplicate` **4.1 MB** · **notes.txt** `refused` (empty
progress) carrying `sampleRefusal("FORMAT_NOT_ACCEPTED", "inline")` — which adds that code
to `SampleRefusalCode` in `sample-refusals.ts` with its registered message and remedy
verbatim (s-design I-18), leaving `missingEntries()` empty. The gallery's J-004 baselines
capture the shell region only, so no re-baseline is expected.
