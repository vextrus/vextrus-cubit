// THE FRAME'S TWO SLOTS, AS THE CRAFT RUBRIC MEASURES THEM — the 32 px tool row and the 24 px
// readout (Direction §1, §3.1), read for `chromeGeometry` and for the tool-row half of
// `controlHeight` (AM-08 Part 2's mechanical half, `lib/craft.mjs`).
//
// WHY THE RUBRIC NEEDS A RULE FOR WHICH BOX IT MEASURES. The frame publishes both tracks
// (`src/ui/shell/app-shell.tsx`) and a screen fills them through `useShellToolbar` and
// `useShellStatus` (`src/ui/shell/slots.tsx`); what it mounts there is its own. Coverage mounts a
// `<ShellToolbar>` (`shell-toolbar`); the takeoff lane mounts its tab row; the viewer mounts its tool
// groups bare and its own readout (`viewer-status`) in place of the frame's (`shell-status`). The
// rubric read only `shell-toolbar` and `shell-status`, so on the viewer both were absent and
// chromeGeometry scored 5 on "toolbar absent, status absent" without measuring either (session 7's
// final craft re-look): the craft table's viewer row proved nothing about its chrome.
//
// THE RULE. A region is measured where a screen mounted one; a track holding nothing is no region.
//  - The tool row: `shell-toolbar` where a screen mounted the frame's toolbar. Else the frame's own
//    slot, `shell-toolbar-slot` — but ONLY while it holds an element AND stands above zero height.
//    The frame mounts the slot on every screen and zeroes its track when nothing is in it (R-UI-080:
//    a region holding nothing is absent, not a placeholder), so a slot read unconditionally would
//    score "toolbar 0" on every screen with no tools — home, audit, drawings, documents, settings —
//    a point off each for the absence the law asks for.
//  - The readout: `shell-status`, the frame's own. Else `viewer-status`, the one screen readout that
//    stands in its place — and only then, so a page that somehow shows both is graded on the frame's.
//  - The row's buttons are read from the same box as the row's height: the row that is measured is
//    the row whose buttons are measured, never one row's height beside another's buttons. In the
//    bare slot they are the buttons of its tool groups (`role="group"`, `ShellToolbarGroup`): the slot
//    also carries the takeoff tab row, whose pinned-revision IdChip (a 24 px chip) and one primary
//    action the Direction places there (§3.2) and which are not tools (`readCraft` reads them so).
//  - A row's HEIGHT is the frame's, not the row's. The body's grid gives the tool track
//    `--toolbar-h` and the readout's `--status-h` (`src/ui/shell/shell.css`), the slot and the
//    frame's toolbar clip what they hold (`overflow: hidden`), and the tab row "takes the track's
//    height" (takeoff.css) — so a slot read at 32 is the frame's CSS constant, and it stays 32 when
//    the row inside it has wrapped onto a second line or spilled past its right edge (session 7's
//    BOQ tab row: every label and three buttons wrapped and clipped inside the 32 px track,
//    s-boq.md I-boq-1(a)). What says whether the row FITS is its content against its box: the
//    measured row element's `scrollHeight`/`scrollWidth` against its `clientHeight`/`clientWidth`.
//    A row whose content runs past its box on either axis costs the row's point, and the reason
//    names the box and both figures (`toolbar clipped (shell-toolbar-slot) 45>32 high`). A
//    descendant that clips its own overflow (an ellipsised label) spills nothing into the row and is
//    no finding: the design lets a label ellipsise, never lets the row clip it.
//
// Pure: a reading in, the measured regions and the criterion out. No browser, no DOM, no page — the
// page half is `readCraft`'s, which hands this module what it saw.
import { idOf } from "./testids.mjs";

/** The ids the rule is written in, from the registry (AM-09 §1) — the harness spells none. */
export const FRAME_REGIONS = Object.freeze({
  toolbar: idOf("shell.toolbar"),
  toolbarSlot: idOf("shell.toolbarSlot"),
  status: idOf("shell.status"),
  viewerStatus: idOf("viewer.status"),
});

/** Direction §1's two track heights: the 32 px tool row and the 24 px readout. */
export const TOOLBAR_HEIGHT = 32;
export const STATUS_HEIGHT = 24;

/** The widest a collapsed rail may be (Direction §7, C3) — `lib/rail.mjs` reads by the same 56. */
const RAIL_MAX = 56;
/** The top bar's height ceiling (Direction §1). */
const TOPBAR_MAX = 40;

/**
 * A box as the page measured it (`getBoundingClientRect`, plus its area).
 * @typedef {object} Box
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} area
 */

/**
 * How far a row's content runs against the box that holds it — the reading a fixed track's height
 * cannot give. The page's own integers (`Element.scrollWidth` and the rest).
 * @typedef {object} Extent
 * @property {number} scrollWidth
 * @property {number} scrollHeight
 * @property {number} clientWidth
 * @property {number} clientHeight
 */

/**
 * What the page answers about the two tracks — every candidate, measured or not, so the choice
 * between them is made here, once.
 * @typedef {object} SlotsReading
 * @property {(Box & {extent: Extent}) | null} toolbar `shell-toolbar`'s box and its content's extent; `null` where no screen mounted one.
 * @property {number[]} toolbarButtons the heights of the buttons inside it.
 * @property {(Box & {children: number, extent: Extent}) | null} toolbarSlot the frame's slot, with how many elements it holds and their extent.
 * @property {number[]} slotButtons the heights of the buttons in the slot's tool groups.
 * @property {Box | null} status `shell-status`'s box; `null` where a screen replaced the frame's readout.
 * @property {Box | null} viewerStatus `viewer-status`'s box; `null` off the viewer.
 */

/**
 * One measured region: which box the rubric read, by its test id, and what it read there.
 * @typedef {object} Measured
 * @property {string} region
 * @property {Box} box
 */

/**
 * The regions the rubric measures on one page.
 * @typedef {object} FrameSlots
 * @property {(Measured & {buttons: number[], extent: Extent}) | null} toolbar `null`: no screen mounted a tool row.
 * @property {Measured | null} status `null`: neither the frame's readout nor the viewer's stands.
 */

/**
 * Which boxes the rubric measures, by the rule above.
 * @param {SlotsReading} slots
 * @returns {FrameSlots}
 */
export function frameSlots(slots) {
  const slot = slots.toolbarSlot;
  /** @type {FrameSlots["toolbar"]} */
  let toolbar = null;
  if (slots.toolbar !== null) toolbar = { region: FRAME_REGIONS.toolbar, box: slots.toolbar, buttons: slots.toolbarButtons, extent: slots.toolbar.extent };
  else if (slot !== null && slot.children > 0 && slot.height > 0) toolbar = { region: FRAME_REGIONS.toolbarSlot, box: slot, buttons: slots.slotButtons, extent: slot.extent };
  /** @type {FrameSlots["status"]} */
  let status = null;
  if (slots.status !== null) status = { region: FRAME_REGIONS.status, box: slots.status };
  else if (slots.viewerStatus !== null) status = { region: FRAME_REGIONS.viewerStatus, box: slots.viewerStatus };
  return { toolbar, status };
}

/**
 * The criterion's reading of the rest of the chrome, beside the two slots.
 * @typedef {object} ChromeReading
 * @property {{width: number} | null} rail
 * @property {{height: number} | null} topbar
 * @property {FrameSlots} frame
 */

/** The slack a sub-pixel layout rounds away: content one pixel past its box has not spilled. */
const SPILL_SLACK = 1;

/**
 * Where a row's content runs past the box that holds it, axis by axis, as the figures that say so
 * (`45>32 high`, `1520>1392 wide`); empty where the row fits its box.
 * @param {Extent} extent
 * @returns {string[]}
 */
export function spill(extent) {
  /** @type {string[]} */
  const out = [];
  if (extent.scrollHeight > extent.clientHeight + SPILL_SLACK) out.push(`${extent.scrollHeight}>${extent.clientHeight} high`);
  if (extent.scrollWidth > extent.clientWidth + SPILL_SLACK) out.push(`${extent.scrollWidth}>${extent.clientWidth} wide`);
  return out;
}

/**
 * A measured track's height in whole pixels, and — where the rubric read a stand-in rather than
 * the frame's own region — the stand-in's name, so a verdict never hides which box it measured.
 * It is the TRACK's height: the frame sets it, and it says nothing of whether the row inside fits.
 * @param {Measured | null} measured
 * @param {string} own the frame's own region for this track
 * @returns {string}
 */
function stated(measured, own) {
  if (measured === null) return "0";
  const height = String(Math.round(measured.box.height));
  return measured.region === own ? height : `${height} (${measured.region})`;
}

/**
 * Criterion 3, chrome geometry: 5, less 2 for a rail that is absent or open past 56, less 1 for a
 * tool row that stands off its 32 px track OR whose content runs past its box (one point for the
 * row, whichever it is — both are "not a 32 px row"), less 1 for a readout off its 24 px track, less
 * 1 for a top bar over 40. A region no screen mounted costs nothing and says so ("toolbar absent"),
 * exactly as before the slots were read.
 *
 * The words keep the frame's measure apart from the row's: `toolbar track 32` is the frame's
 * track, and only `its row fits` — or `toolbar clipped (<region>) 45>32 high` — speaks for the row.
 * @param {ChromeReading} reading
 * @returns {{score: number, why: string}}
 */
export function chromeGeometry(reading) {
  const { rail, topbar, frame } = reading;
  let score = 5;
  /** @type {string[]} */
  const why = [];
  if (rail === null || rail.width > RAIL_MAX) { score -= 2; why.push(`rail ${rail === null ? "absent" : Math.round(rail.width)}`); }
  if (frame.toolbar === null) why.push("toolbar absent");
  else {
    const offTrack = Math.round(frame.toolbar.box.height) !== TOOLBAR_HEIGHT;
    const spilled = spill(frame.toolbar.extent);
    if (offTrack) why.push(`toolbar track ${stated(frame.toolbar, FRAME_REGIONS.toolbar)}`);
    if (spilled.length > 0) why.push(`toolbar clipped (${frame.toolbar.region}) ${spilled.join(" ")}`);
    if (offTrack || spilled.length > 0) score -= 1;
  }
  if (frame.status === null) why.push("status absent");
  else if (Math.round(frame.status.box.height) !== STATUS_HEIGHT) { score -= 1; why.push(`status track ${stated(frame.status, FRAME_REGIONS.status)}`); }
  if (topbar !== null && Math.round(topbar.height) > TOPBAR_MAX) { score -= 1; why.push(`topbar ${Math.round(topbar.height)}`); }
  return {
    score: Math.max(0, Math.min(5, score)),
    why: why.length > 0 ? why.join(", ") : `rail ${Math.round(rail?.width ?? 0)}, toolbar track ${stated(frame.toolbar, FRAME_REGIONS.toolbar)} and its row fits, status track ${stated(frame.status, FRAME_REGIONS.status)}`,
  };
}
