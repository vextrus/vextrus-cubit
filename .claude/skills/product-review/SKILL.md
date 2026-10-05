---
name: product-review
description: Review the RUNNING Vextrus in a real browser the way a QS, an MD and a design lead would. Serve it, sign in, walk a real task end to end on a real Drawing Set with the chrome-devtools MCP, look at what the eye sees, and turn what is wrong into a ranked, evidenced defect list. Use to judge any screen or flow, before and after a change, and before every milestone walk.
---
# Product review in the browser

Tests prove contracts; they do not prove the product is good. Cubit passed its gates and failed in
front of the owner (docs/postmortem.md). This is how a session looks at the product itself.

## 1. Serve it
- **G1's agent layer** starts from the script's state: `scripts/walk/run.py <sha40>` serves the head and
  writes `.private/work/walks/<sha40>/walk.json`; walk its served URLs, never your own server.
  Otherwise start the app with the dev command in `CLAUDE.md`. Use `127.0.0.1`, never `localhost`.
- Use a real Drawing Set: the Sample Project or the Edison set (`.private/reference/`), in a local
  session. A cloud session has no real drawings. Say so, and review only what committed data can
  show.

## 2. Walk it (chrome-devtools MCP, headless Chromium, 1440x900)
- `new_page` the sign-in, then `take_snapshot` and `fill_form`, and sign in. The browser is shared:
  select your own page by URL before every action.
- Walk the job in order, as the user does it, saying at each step what they are trying to achieve and
  whether the screen lets them:
  - **The QS:** upload the set, confirm sheets and storeys, then each Takeoff Step (grid, columns,
    beams, slabs, walls…), answering Questions; then the Priced BOQ, the Material Schedule and the
    exports.
  - **The MD:** the Project Summary, the Target Cost, the 3D Building Model, the Revision Comparison.
- **Evidence.** Save `take_screenshot` to `.private/work/review/<area>-<step>.png` (on a G1 walk, under
  `.private/work/walks/<sha40>/evidence/<finding id>/`), then Read the PNG and look at it. Every claim
  about a screen cites a picture you looked at. Per-page `emulate` 1280x800 for the second viewport.
  `list_console_messages` (an error is a defect) and `list_network_requests` (a slow or failed call is
  a defect with a cause).

## 3. Judge it
Judge against, in order:
1. the QS's real workflow and words (`CONTEXT.md`);
2. trust: the Trace in one click, Rebar Basis, Questions answerable in place;
3. numbers: ৳ in lakh and crore, Display Units, and the same figure on screen, in Excel and in PDF;
4. craft and accessibility;
5. OpenConstructionERP's weaknesses (docs/research/oce-product-walk.md), which we must beat.

When the walk is wide, fan it out: `ux-critic` per area, `qs-critic` on figures and documents,
`refuter` on any finding before a fix is spent on it.

## 4. Record and act
- A ranked defect list (BLOCKS_DEMO › FRICTION › POLISH), each with screen, element, repro, screenshot
  path and fix. Defects become GitHub issues. **No drawing content goes in an issue:** describe the
  screen, not the client's data.
- Screenshots of real drawings stay in `.private/work/review/`.
- Re-walk the screen after the fix. A milestone is done only when the owner has walked it.
