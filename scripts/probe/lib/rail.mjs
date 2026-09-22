// THE WORKSPACE RAIL'S STATE, in the words a verdict line prints.
//
// WHY THE INSTRUMENT STATES IT. The rail is 48 px and opens to 220 on hover-hold, on focus or on the
// pin (`src/ui/shell/shell-rail.tsx`: `expanded = pinned || held || focused`). Chromium keeps its
// pointer at (0, 0) from load and replays the hover on every layout change; (0, 0) is inside the
// rail's 48x900 box, so a capture taken without moving the pointer is a capture of the OPEN rail —
// a state a customer never meets, and one scoreCraft reads as a chrome fault (rail width > 56 is
// -2 on chromeGeometry). The probe now rests the pointer off the frame (`PROBE_POINTER_REST`), and
// this module is how each line SAYS which rail was photographed, so a reader never has to infer it
// from the score.
//
// Pure: a reading in, a string out. No browser, no DOM, no page.

/**
 * The chrome's own answer, read from the page by `readCraft`.
 * @typedef {object} ChromeReading
 * @property {string | null} [railCollapsed] the rail's `data-collapsed`: `"true"` narrow, `"false"` open.
 * @property {string | null} [hovered] the innermost `:hover` element's test id, `null` when nothing is hovered.
 * @property {string | null} [focused] the active element's test id or tag, `null` when the body holds focus.
 */

/**
 * As much of a craft reading as the rail's state is read from.
 * @typedef {object} RailReading
 * @property {{width: number} | null} [rail] the rail's box, `null` on a screen that carries no shell.
 * @property {ChromeReading | null} [chrome] absent in a reading taken before the chrome was read.
 */

/** The widest a collapsed rail can be — the same 56 px `scoreCraft`'s chromeGeometry reads by. */
const COLLAPSED_MAX = 56;

/**
 * One field for the verdict line: `rail=48/collapsed`, `rail=220/expanded(hover=shell-rail)`,
 * `rail=220/expanded(focus=shell-rail-collapse)`, `rail=220/expanded(pinned)` or `rail=absent`.
 *
 * The cause is the reading's own and is named in the order the rail opens by: a pointer in it, then
 * focus in it, then the remembered pin — which is what is LEFT when the page reports neither, since
 * `held` cannot outlive the pointer (`onPointerLeave` releases it) and `focused` is the active
 * element the same reading just looked at. A reading taken before the chrome was read can say that
 * the rail stands open and nothing about why, so it says exactly that.
 *
 * @param {RailReading} reading
 * @returns {string}
 */
export function railState(reading) {
  const rail = reading.rail ?? null;
  if (rail === null) return "rail=absent";
  const width = Math.round(rail.width);
  const chrome = reading.chrome ?? null;
  const published = chrome === null ? null : chrome.railCollapsed ?? null;
  // The attribute is the rail's own word for its state; the width is the fallback for a reading
  // that predates it (and for a rail whose attribute a future frame stops publishing).
  const collapsed = published === null ? width <= COLLAPSED_MAX : published === "true";
  if (collapsed) return `rail=${width}/collapsed`;
  if (chrome === null) return `rail=${width}/expanded`;
  const hovered = chrome.hovered ?? null;
  if (hovered !== null) return `rail=${width}/expanded(hover=${hovered})`;
  const focused = chrome.focused ?? null;
  if (focused !== null) return `rail=${width}/expanded(focus=${focused})`;
  return `rail=${width}/expanded(pinned)`;
}
