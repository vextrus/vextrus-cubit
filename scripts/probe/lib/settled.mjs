// A port of tests/e2e/support/settled.ts's RULES (not its guesses): fonts loaded, nothing aria-busy,
// every screen root past loading, every virtualised table with a numeric data-rows-rendered, every
// <img> decoded, no finite animation running. Polled, never slept.
export const SETTLE_CONTRACT = Object.freeze({
  busy: '[aria-busy="true"]',
  screenRoot: "[data-screen-root]",
  screenState: "data-state",
  region: "[data-rendered-region]",
  virtualTable: "[data-virtualised]",
  rowsRendered: "data-rows-rendered",
});
export const UNSETTLED_STATES = ["", "loading", "pending"];

export async function readSettle(page, within) {
  return await page.evaluate(async ({ contract, within: scope }) => {
    const root = (scope === undefined ? null : globalThis.document.querySelector(scope)) ?? globalThis.document;
    await new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve())));
    const images = [...root.querySelectorAll("img")];
    const loading = images.filter((image) => !image.complete);
    await Promise.all(images.filter((image) => image.complete).map(async (image) => image.decode().catch(() => undefined)));
    const animations = globalThis.document.getAnimations();
    const live = animations.filter((animation) => animation.playState === "running");
    const endless = live.filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return timing === undefined || timing.iterations === Infinity || timing.endTime === Infinity;
    });
    return {
      fontsStatus: globalThis.document.fonts.status,
      busy: globalThis.document.querySelectorAll(contract.busy).length,
      imagesLoading: loading.length,
      screenRoots: [...root.querySelectorAll(contract.screenRoot)].map((element) => element.getAttribute(contract.screenState)),
      tables: [...root.querySelectorAll(contract.virtualTable)].map((element) => element.getAttribute(contract.rowsRendered)),
      running: live.length - endless.length,
      endless: endless.length,
    };
  }, { contract: SETTLE_CONTRACT, within });
}

export function settleFault(reading) {
  if (reading.fontsStatus !== "loaded") return `fonts ${reading.fontsStatus}`;
  if (reading.busy > 0) return `${reading.busy} aria-busy`;
  const blank = reading.screenRoots.filter((state) => state === null || UNSETTLED_STATES.includes(state));
  if (blank.length > 0) return `${blank.length}/${reading.screenRoots.length} screen roots unsettled (${blank.map((s) => (s === null ? "absent" : JSON.stringify(s))).join(",")})`;
  const unpainted = reading.tables.filter((rows) => rows === null || !/^\d+$/.test(rows));
  if (unpainted.length > 0) return `${unpainted.length}/${reading.tables.length} virtual tables unpainted`;
  if (reading.imagesLoading > 0) return `${reading.imagesLoading} images loading`;
  if (reading.running > 0) return `${reading.running} animations running`;
  return null;
}

export async function settled(page, timeout = 15_000, within) {
  await page.evaluate(() => globalThis.document.fonts.ready.then(() => undefined));
  const started = Date.now();
  for (;;) {
    const reading = await readSettle(page, within);
    const fault = settleFault(reading);
    if (fault === null) return { ok: true, reading };
    if (Date.now() - started > timeout) return { ok: false, fault, reading };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The screen-root states and rendered regions after settle — what the verdict line prints. */
export async function renderedFacts(page) {
  return await page.evaluate((contract) => {
    const roots = [...globalThis.document.querySelectorAll(contract.screenRoot)].map((element) => ({
      id: element.getAttribute("data-testid") ?? element.tagName.toLowerCase(),
      state: element.getAttribute(contract.screenState),
    }));
    const regions = [...globalThis.document.querySelectorAll(contract.region)].map((element) => ({
      id: element.getAttribute("data-testid") ?? element.tagName.toLowerCase(),
      state: element.getAttribute(contract.screenState),
    }));
    const tables = [...globalThis.document.querySelectorAll(contract.virtualTable)].map((element) => ({
      id: element.getAttribute("data-testid") ?? element.tagName.toLowerCase(),
      rows: element.getAttribute(contract.rowsRendered),
    }));
    return { roots, regions, tables };
  }, SETTLE_CONTRACT);
}
