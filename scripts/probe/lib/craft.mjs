import { chromeGeometry, frameSlots } from "./frame.mjs";
import { idOf } from "./testids.mjs";
// THE NUMERIC CRAFT RUBRIC (AM-08 Part 2), the mechanical half: twelve criteria 0–5, weights summing
// to 12, read from the DOM after settled(). A human may only LOWER a computed score.
export const WEIGHTS = Object.freeze({
  workSurface: 1.5,
  aboveTheFold: 1.5,
  chromeGeometry: 1,
  controlHeight: 1,
  rowHeight: 1,
  identifierExposure: 1.5,
  copyDiet: 1,
  tokensAndGrid: 0.5,
  themes: 0.5,
  noHorizontalScroll: 0.5,
  hierarchy: 1,
  states: 1,
});

/** One reading of the DOM's geometry and hygiene. Runs in the page. */
const IDS = Object.freeze({
  shellMain: idOf("shell.main"),
  viewerCanvas: idOf("viewer.canvas"),
  datatable: idOf("datatable.root"),
  datatableRow: idOf("datatable.row"),
  datatableCell: idOf("datatable.cell"),
  sheetIndex: idOf("sheet.index"),
  homeGrid: idOf("sHome.grid"),
  rail: idOf("shell.rail"),
  toolbar: idOf("shell.toolbar"),
  toolbarSlot: idOf("shell.toolbarSlot"),
  status: idOf("shell.status"),
  viewerStatus: idOf("viewer.status"),
  topbar: idOf("shell.topbar"),
  inspector: idOf("shell.inspector"),
  idChip: idOf("idChip.root"),
  tooltip: idOf("tooltip.content"),
  refusal: idOf("refusal.state"),
  error: idOf("error.state"),
  popover: idOf("popover.content"),
  layerSwatch: idOf("viewer.layerSwatch"),
  viewerScreen: idOf("viewer.screen"),
});

/**
 * Read the page, then settle which of the frame's slots the rubric measures (`lib/frame.mjs`): the
 * page answers every candidate box, and the choice between them is made once, in node, where it is
 * tested (tests/toolchain/probe-frame-slots.test.ts). `toolbar` and `status` are the boxes MEASURED,
 * `frame` names them, `frame.toolbar.extent` says whether the row's content fits its box, and
 * `controls.toolbarButtons` are the buttons of the measured row.
 */
export async function readCraft(page, options = {}) {
  const reading = await page.evaluate(({ opts, ids }) => {
    const q = (selector, root = globalThis.document) => root.querySelector(selector);
    const qa = (selector, root = globalThis.document) => [...root.querySelectorAll(selector)];
    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, area: box.width * box.height };
    };
    const vw = globalThis.window.innerWidth;
    const vh = globalThis.window.innerHeight;
    const main = q(`[data-testid="${ids.shellMain}"]`) ?? q("main") ?? globalThis.document.body;
    const mainRect = rect(main);

    // The primary work surface: the largest of the candidates inside main.
    const candidates = [
      ...qa(`[data-testid="${ids.viewerCanvas}"]`, main),
      ...qa("[data-virtualised]", main),
      ...qa(`[data-testid="${ids.datatable}"]`, main),
      ...qa('[data-testid$="-grid"]', main),
      ...qa('[role="grid"]', main),
      ...qa("table", main),
      ...qa(`[data-testid="${ids.sheetIndex}"]`, main),
      ...qa(`[data-testid="${ids.homeGrid}"]`, main),
    ];
    // A candidate standing inside another candidate is part of that region, not a region of its own:
    // a bill's table inside the BOQ grid, a DataTable inside the home grid. The primary is measured
    // at the outermost region that holds it — the frame a reader sees — never at a nested table whose
    // own box the frame clips.
    const outermost = candidates.filter((candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)));
    let primary = null;
    for (const candidate of outermost) {
      const box = rect(candidate);
      if (box && box.area > 0 && (primary === null || box.area > primary.box.area)) primary = { id: candidate.getAttribute("data-testid") ?? candidate.tagName.toLowerCase(), box };
    }

    const rail = rect(q(`[data-testid="${ids.rail}"]`));
    // The frame's two slots, every candidate: which of them is measured is `lib/frame.mjs`'s rule.
    // The frame's toolbar is a tool row by construction, so every button in it is a tool; the bare
    // slot also carries the takeoff tab row, whose pinned-revision IdChip and one primary action the
    // Direction puts there (§3.2) and which are not tools — so the slot's tools are the buttons of its
    // tool groups (`ShellToolbarGroup`'s `role="group"`), the same primitive the viewer mounts.
    // A row's box is the frame's track (its height is `--toolbar-h`, and both the slot and the
    // frame's toolbar clip what they hold), so whether the row FITS is read from its content: how far
    // that runs against the box, on both axes — a wrapped label or a spilled aside shows only here.
    const heightsIn = (element, selector) => (element === null ? [] : [...new Set(qa(selector, element).map((b) => Math.round(rect(b).height)))]);
    const extentOf = (element) => ({ scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight, clientWidth: element.clientWidth, clientHeight: element.clientHeight });
    const toolbarElement = q(`[data-testid="${ids.toolbar}"]`);
    const slotElement = q(`[data-testid="${ids.toolbarSlot}"]`);
    const slots = {
      toolbar: toolbarElement === null ? null : { ...rect(toolbarElement), extent: extentOf(toolbarElement) },
      toolbarButtons: heightsIn(toolbarElement, "button"),
      toolbarSlot: slotElement === null ? null : { ...rect(slotElement), children: slotElement.childElementCount, extent: extentOf(slotElement) },
      slotButtons: heightsIn(slotElement, '[role="group"] button'),
      status: rect(q(`[data-testid="${ids.status}"]`)),
      viewerStatus: rect(q(`[data-testid="${ids.viewerStatus}"]`)),
    };
    const topbar = rect(q(`[data-testid="${ids.topbar}"]`));
    const inspector = rect(q(`[data-testid="${ids.inspector}"]`));

    // The chrome's own state, so a verdict line can say WHICH rail was photographed (lib/rail.mjs).
    // `data-collapsed` is the rail's published answer; the hover and focus readings are the two
    // causes a page can be asked for (shell-rail.tsx: `expanded = pinned || held || focused`).
    // An element with no id of its own is named by the nearest ancestor that has one — the rail's
    // inner divs carry none, and "the pointer is in the rail" is the fact worth printing.
    const nameOf = (element) => (element === null ? null : element.closest("[data-testid]")?.getAttribute("data-testid") ?? element.tagName.toLowerCase());
    const hoverChain = qa(":hover");
    const active = globalThis.document.activeElement;
    const chrome = {
      railCollapsed: q(`[data-testid="${ids.rail}"]`)?.getAttribute("data-collapsed") ?? null,
      hovered: hoverChain.length === 0 ? null : nameOf(hoverChain[hoverChain.length - 1]),
      focused: active === null || active === globalThis.document.body || active === globalThis.document.documentElement ? null : nameOf(active),
    };

    // Controls in main: their heights, and any native select / date input. The tool row's buttons
    // are the slots' (above), read from whichever row the rubric measures.
    const controls = qa("button, [role=button], input, select, textarea", main).filter((element) => rect(element)?.height > 0);
    const heights = controls.map((element) => Math.round(rect(element).height));
    const nativeSelects = qa("select", globalThis.document).length;
    const dateInputs = qa('input[type="date"]', globalThis.document).length;

    // Rows: the grid's rows, by median height; wrapping cells.
    const rows = qa(`[data-testid="${ids.datatableRow}"], tr, [role="row"], [data-testid$="-row"]`, main).filter((element) => rect(element)?.height > 0 && !element.closest("thead"));
    const rowHeights = rows.map((element) => Math.round(rect(element).height)).sort((a, b) => a - b);
    const medianRow = rowHeights.length === 0 ? null : rowHeights[Math.floor(rowHeights.length / 2)];
    const wrappingCells = qa(`[data-testid="${ids.datatableCell}"], td`, main).filter((cell) => {
      const style = globalThis.getComputedStyle(cell);
      return style.whiteSpace !== "nowrap" && cell.scrollHeight > rect(cell).height + 2;
    }).length;

    // Identifier exposure: raw ids in visible text outside the chip.
    const walker = globalThis.document.createTreeWalker(main, globalThis.NodeFilter.SHOW_TEXT);
    const exposed = [];
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const HEX64 = /\b[0-9a-f]{64}\b/i;
    const HANDLE = /\b(?:DXF_HANDLE|PDF_OBJECT|RASTER_TRACE):[0-9A-Za-z]+/;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent ?? "";
      if (!(UUID.test(text) || HEX64.test(text) || HANDLE.test(text))) continue;
      const element = node.parentElement;
      if (!element) continue;
      if (element.closest(`[data-testid="${ids.idChip}"], [data-testid="${ids.tooltip}"], [hidden], .cx-visually-hidden, [aria-hidden="true"]`)) continue;
      const style = globalThis.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.clipPath === "inset(50%)" || style.position === "absolute" && rect(element).width <= 1) continue;
      exposed.push({ text: text.trim().slice(0, 80), in: element.getAttribute("data-testid") ?? element.className?.toString().slice(0, 40) ?? element.tagName });
    }

    // Copy diet: explanatory paragraphs longer than a line, outside empty/refusal states.
    const paragraphs = qa("p", main).filter((p) => {
      if (p.closest(`[data-testid$="-empty"], [data-testid="${ids.refusal}"], [data-testid="${ids.error}"], [data-testid="${ids.popover}"], [data-testid="${ids.tooltip}"], [role="dialog"]`)) return false;
      const style = globalThis.getComputedStyle(p);
      if (style.display === "none" || style.clipPath === "inset(50%)") return false;
      const box = rect(p);
      const lineHeight = parseFloat(style.lineHeight) || 18;
      return box.height > lineHeight * 1.6 && (p.textContent ?? "").trim().length > 80;
    }).map((p) => (p.textContent ?? "").trim().slice(0, 60));

    // Tokens: inline hex/rgb colours outside canvases, swatches and artifact data.
    const inlineColours = qa("[style]", main).filter((element) => {
      if (element.closest(`[data-testid="${ids.layerSwatch}"], canvas, svg`)) return false;
      const style = element.getAttribute("style") ?? "";
      return /#[0-9a-f]{3,8}\b|rgba?\(/i.test(style);
    }).map((element) => element.getAttribute("data-testid") ?? element.className?.toString().slice(0, 30) ?? element.tagName);

    // Scroll.
    const html = globalThis.document.documentElement;
    const pageScroll = html.scrollWidth > html.clientWidth + 1 || globalThis.document.body.scrollWidth > html.clientWidth + 1;
    const mainScroll = main.scrollWidth > main.clientWidth + 1;

    // Hierarchy.
    const headings = qa("h1, h2, h3, h4, h5, h6", globalThis.document).filter((h) => rect(h)?.height >= 0).map((h) => Number(h.tagName[1]));
    const h1 = qa("h1", globalThis.document).length;
    let skips = 0;
    for (let index = 1; index < headings.length; index += 1) if (headings[index] - headings[index - 1] > 1) skips += 1;
    const SCALE = new Set([10, 12, 13, 14, 16, 20, 24, 32]);
    const offScale = new Set();
    for (const element of qa("*", main).slice(0, 4000)) {
      const size = Math.round(parseFloat(globalThis.getComputedStyle(element).fontSize));
      if (!SCALE.has(size) && element.childNodes.length > 0 && [...element.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== "")) offScale.add(size);
    }

    // States: the screen root the product publishes — `data-screen-root` where a screen wears it,
    // else the screen's own root in main carrying `data-state` (register-workspace, levels-screen …).
    const root =
      q("[data-screen-root]") ??
      qa(`[data-testid$="-screen"][data-state], [data-testid$="-workspace"][data-state], [data-testid="${ids.viewerScreen}"], [data-testid$="-index"][data-state]`, main)[0] ??
      qa("[data-state]", main).find((e) => e.getAttribute("data-testid") && !e.closest("[role=menu],[data-radix-popper-content-wrapper]")) ??
      null;
    const rootState = root?.getAttribute("data-state") ?? null;
    const regionStates = qa("[data-rendered-region]").map((e) => e.getAttribute("data-state"));

    return {
      viewport: { width: vw, height: vh },
      main: mainRect,
      primary,
      rail, slots, topbar, inspector, chrome,
      controls: { count: controls.length, heights: [...new Set(heights)].sort((a, b) => a - b), nativeSelects, dateInputs },
      rows: { count: rows.length, median: medianRow, distinct: [...new Set(rowHeights)], wrappingCells },
      exposed,
      paragraphs,
      inlineColours,
      scroll: { page: pageScroll, main: mainScroll, htmlScrollWidth: html.scrollWidth, htmlClientWidth: html.clientWidth },
      hierarchy: { h1, skips, headings, offScale: [...offScale] },
      states: { rootState, regionStates, rootId: root?.getAttribute("data-testid") ?? null },
      opts,
    };
  }, { opts: options, ids: IDS });
  const frame = frameSlots(reading.slots);
  return {
    ...reading,
    frame,
    toolbar: frame.toolbar?.box ?? null,
    status: frame.status?.box ?? null,
    controls: { ...reading.controls, toolbarButtons: frame.toolbar?.buttons ?? [] },
  };
}

const clamp = (n) => Math.max(0, Math.min(5, n));

/** Score the reading: {criterion: {score, why}} and the weighted total. */
export function scoreCraft(reading, axeByTheme = {}, kind = "grid") {
  const r = reading;
  const out = {};
  const vpArea = r.viewport.width * r.viewport.height;
  const mainArea = r.main ? r.main.area : vpArea;

  // 1 work surface
  if (r.primary === null) out.workSurface = { score: 0, why: "no primary grid or canvas found" };
  else if (kind === "canvas") {
    const share = r.primary.box.area / vpArea;
    out.workSurface = { score: clamp(share >= 0.7 ? 5 : share >= 0.6 ? 4 : share >= 0.5 ? 3 : share >= 0.4 ? 2 : 1), why: `canvas ${(share * 100).toFixed(0)}% of viewport (≥70% → 5)` };
  } else {
    const share = r.primary.box.area / mainArea;
    out.workSurface = { score: clamp(share >= 0.55 ? 5 : share >= 0.45 ? 4 : share >= 0.35 ? 3 : share >= 0.25 ? 2 : 1), why: `${r.primary.id} ${(share * 100).toFixed(0)}% of shell-main (≥55% → 5)` };
  }
  // 2 above the fold
  if (r.primary === null || r.main === null) out.aboveTheFold = { score: 0, why: "no primary" };
  else {
    const offset = Math.round(r.primary.box.y - r.main.y);
    out.aboveTheFold = { score: clamp(offset <= 240 ? 5 : offset <= 300 ? 4 : offset <= 400 ? 3 : offset <= 500 ? 2 : 1), why: `primary starts ${offset}px below main top (≤240 → 5)` };
  }
  // 3 chrome geometry: the rail, the top bar, and the frame's two slots as `lib/frame.mjs` rules them
  out.chromeGeometry = chromeGeometry({ rail: r.rail ?? null, topbar: r.topbar ?? null, frame: r.frame });
  // 4 control height and kind
  {
    let score = 5;
    const why = [];
    if (r.controls.nativeSelects > 0) { score -= 2; why.push(`${r.controls.nativeSelects} native select`); }
    if (r.controls.dateInputs > 0) { score -= 2; why.push(`${r.controls.dateInputs} date input`); }
    const tall = r.controls.heights.filter((h) => h > 36);
    if (tall.length > 0) { score -= 1; why.push(`controls at ${tall.join("/")}px`); }
    const badToolbar = r.controls.toolbarButtons.filter((h) => h !== 28);
    if (badToolbar.length > 0) { score -= 1; why.push(`toolbar buttons at ${badToolbar.join("/")}px`); }
    out.controlHeight = { score: clamp(score), why: why.length ? why.join(", ") : `heights ${r.controls.heights.join("/")}` };
  }
  // 5 row height and cell discipline
  if (kind === "canvas" || r.rows.count === 0) out.rowHeight = { score: kind === "canvas" ? 5 : 3, why: kind === "canvas" ? "canvas screen, no grid rows" : "no rows found" };
  else {
    let score = 5;
    const why = [`median row ${r.rows.median}px`];
    if (r.rows.median !== 28) { score -= r.rows.median !== null && Math.abs(r.rows.median - 28) <= 4 ? 1 : 2; }
    if (r.rows.wrappingCells > 0) { score -= 1; why.push(`${r.rows.wrappingCells} wrapping cells`); }
    out.rowHeight = { score: clamp(score), why: why.join(", ") };
  }
  // 6 identifier exposure
  {
    const n = r.exposed.length;
    out.identifierExposure = { score: clamp(n === 0 ? 5 : n <= 2 ? 3 : n <= 5 ? 2 : 0), why: n === 0 ? "no raw id in body text" : `${n} raw ids: ${r.exposed.slice(0, 3).map((e) => `${e.in}:${e.text.slice(0, 24)}`).join(" | ")}` };
  }
  // 7 copy diet
  {
    const n = r.paragraphs.length;
    out.copyDiet = { score: clamp(n === 0 ? 5 : n === 1 ? 4 : n === 2 ? 3 : 1), why: n === 0 ? "no multi-line explanatory copy" : `${n} multi-line paragraphs: ${r.paragraphs.slice(0, 2).join(" | ")}` };
  }
  // 8 tokens and grid
  {
    const n = r.inlineColours.length;
    out.tokensAndGrid = { score: clamp(n === 0 ? 5 : n <= 2 ? 4 : 2), why: n === 0 ? "no inline colour literals" : `${n} inline colours: ${r.inlineColours.slice(0, 3).join(",")}` };
  }
  // 9 themes: contrast from axe per theme
  {
    const themes = Object.keys(axeByTheme);
    let score = 5;
    const why = [];
    for (const theme of themes) {
      const contrast = (axeByTheme[theme]?.violations ?? []).filter((v) => v.id === "color-contrast");
      const nodes = contrast.reduce((n, v) => n + v.nodes.length, 0);
      if (nodes > 0) { score -= Math.min(3, nodes); why.push(`${theme}: ${nodes} contrast nodes`); }
    }
    if (themes.length < 2) why.push(`${themes.length} theme(s) measured`);
    out.themes = { score: clamp(score), why: why.length ? why.join(", ") : `${themes.join("+")} clear of contrast findings` };
  }
  // 10 no horizontal scroll
  out.noHorizontalScroll = { score: r.scroll.page || r.scroll.main ? 0 : 5, why: r.scroll.page ? `page scrolls horizontally (${r.scroll.htmlScrollWidth}>${r.scroll.htmlClientWidth})` : r.scroll.main ? "shell-main scrolls horizontally" : "no horizontal scroll" };
  // 11 hierarchy
  {
    let score = 5;
    const why = [];
    if (r.hierarchy.h1 !== 1) { score -= 2; why.push(`${r.hierarchy.h1} h1`); }
    if (r.hierarchy.skips > 0) { score -= 1; why.push(`${r.hierarchy.skips} heading skips`); }
    if (r.hierarchy.offScale.length > 0) { score -= 1; why.push(`off-scale sizes ${r.hierarchy.offScale.join("/")}`); }
    out.hierarchy = { score: clamp(score), why: why.length ? why.join(", ") : `one h1, headings ${r.hierarchy.headings.join("")}` };
  }
  // 12 states
  {
    const s = r.states.rootState;
    out.states = { score: s === null ? 2 : ["", "loading", "pending"].includes(s) ? 1 : 5, why: s === null ? "no data-screen-root data-state" : `root ${r.states.rootId} data-state=${s}` };
  }
  let total = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) total += weight * out[key].score;
  const min = Math.min(...Object.values(out).map((c) => c.score));
  return { criteria: out, total: Math.round((total / 12) * 100) / 100, min };
}
