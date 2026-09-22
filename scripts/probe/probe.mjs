#!/usr/bin/env node
// THE PROBE. One verdict line per check; pixels only on request.
//
//   node probe.mjs signin <email> <password> [--out cookies.json]
//   node probe.mjs walk [--cookies f] [--themes dark,light] [--viewports 1440x900,1280x800]
//                       [--kind grid|canvas] [--shot] [--out dir] [--name slug] <route> [<route> ...]
//   node probe.mjs run <script.mjs> [--cookies f] [--shot] [--out dir]   (script exports default async (api) => {})
//
// Verdict shapes:
//   OK route=/… state=<root data-state> regions=<n> rows=<…> axe=S/C/M console=<n> net5xx=<n> rail=48/collapsed craft=<total>/min<min> theme=dark 1440x900
//   RED route=/… why=<cause>
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { settled, renderedFacts } from "./lib/settled.mjs";
import { runAxe, axeLine, blocking } from "./lib/axe.mjs";
import { readCraft, scoreCraft } from "./lib/craft.mjs";
import { railState } from "./lib/rail.mjs";
import { sel } from "./lib/testids.mjs";
// The origin server.mjs serves on, from the ports' one home — never a number of server.mjs's own.
// E2E_PORT moves both.
import { originFor } from "../lib/ports.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ORIGIN = originFor("e2e");
const LAUNCH = { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--force-prefers-reduced-motion", "--font-render-hinting=none", "--disable-font-subpixel-positioning", "--disable-lcd-text"] };

/**
 * WHERE THE POINTER RESTS. Chromium starts every page with its pointer at (0, 0) and replays the
 * hover on each layout change; (0, 0) stands inside the 48x900 workspace rail, which opens to 220
 * after a hover-hold — so a capture taken without moving the pointer photographs a rail no customer
 * ever meets, and grades the chrome that was hovered rather than the chrome that ships. The probe
 * rests the pointer OFF the frame instead: the default is one pixel outside the viewport's corner,
 * and `PROBE_POINTER_REST="x,y"` puts it anywhere a session needs it (a hover state the session is
 * deliberately measuring, for instance).
 */
const POINTER_REST = (() => {
  const raw = process.env["PROBE_POINTER_REST"];
  if (raw === undefined || raw.trim() === "") return { x: -1, y: -1 };
  const [x, y] = raw.split(",").map((n) => Number(n.trim()));
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`PROBE_POINTER_REST is "x,y" — read ${JSON.stringify(raw)}`);
  return { x, y };
})();

/** Put the pointer where it rests, so nothing is hovered while the page settles or is read. */
async function restPointer(page) {
  await page.mouse.move(POINTER_REST.x, POINTER_REST.y).catch(() => undefined);
}

function arg(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const flag = (name) => process.argv.includes(name);
const positional = () => {
  const out = [];
  const argv = process.argv.slice(3);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) { if (!["--shot", "--light-shot", "--keyboard", "--json"].includes(a)) i += 1; continue; }
    out.push(a);
  }
  return out;
};

const slug = (s) =>
  s
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (m) => m.slice(0, 8))
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "root";

/** Instrument a page: console errors, page errors, failed/5xx requests, long tasks, WebGL loss. */
export function instrument(page) {
  const facts = { console: [], pageErrors: [], net: [], longTasks: 0, glLost: 0 };
  page.on("console", (m) => { if (m.type() === "error") facts.console.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => facts.pageErrors.push(String(e.message).slice(0, 200)));
  // A router prefetch the navigation abandoned (`?_rsc=` + net::ERR_ABORTED) is not a failure of the
  // product; everything else that failed, and every 4xx/5xx answer, is recorded by name.
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText ?? "";
    if (/favicon/.test(r.url())) return;
    if (why === "net::ERR_ABORTED") return;
    facts.net.push(`FAILED ${r.method()} ${r.url().replace(ORIGIN, "")} ${why}`);
  });
  page.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) facts.net.push(`${r.status()} ${r.request().method()} ${r.url().replace(ORIGIN, "").slice(0, 160)}`); });
  page.addInitScript(() => {
    globalThis.__probe = { longTasks: 0, glLost: 0 };
    try { new PerformanceObserver((list) => { globalThis.__probe.longTasks += list.getEntries().length; }).observe({ entryTypes: ["longtask"] }); } catch { /* no long-task observer on this browser */ }
    globalThis.addEventListener("webglcontextlost", () => { globalThis.__probe.glLost += 1; }, true);
  });
  facts.read = async () => {
    const inPage = await page.evaluate(() => globalThis.__probe ?? { longTasks: 0, glLost: 0 }).catch(() => ({ longTasks: 0, glLost: 0 }));
    facts.longTasks = inPage.longTasks;
    facts.glLost = inPage.glLost;
    return facts;
  };
  facts.reset = () => { facts.console.length = 0; facts.pageErrors.length = 0; facts.net.length = 0; };
  return facts;
}

export async function setTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme });
  // The product persists the preference and reads a `?__theme=` instrument when CUBIT_UI_INSTRUMENT=1;
  // emulateMedia covers the system preference; the instrument covers a stored preference.
}

export async function openContext(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    colorScheme: opts.theme ?? "dark",
    deviceScaleFactor: 1,
    locale: "en-GB",
    timezoneId: "Asia/Dhaka",
    reducedMotion: "reduce",
    baseURL: ORIGIN,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  if (opts.cookies && existsSync(opts.cookies)) await context.addCookies(JSON.parse(readFileSync(opts.cookies, "utf8")));
  return context;
}

/** One check of one route at one theme and viewport. Returns the verdict line and details. */
export async function check(page, facts, route, opts = {}) {
  const started = Date.now();
  facts.reset();
  const url = route.startsWith("http") ? route : `${ORIGIN}${route}${opts.themeParam ? (route.includes("?") ? "&" : "?") + `__theme=${opts.theme}` : ""}`;
  const details = { route, theme: opts.theme, viewport: opts.viewport };
  try {
    const response = await page.goto(url, { waitUntil: "load" });
    details.status = response?.status() ?? null;
    // Twice: once for the document that has just arrived, and again after it has settled — the
    // frame mounts the rail after hydration, and a pointer resting inside its box at that moment is
    // a hover-hold the capture would have photographed.
    await restPointer(page);
    // A streamed document has a shell before it has a screen: wait for the network to go quiet (capped)
    // and for main to hold an element, then settle the way a checkpoint does.
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    await page.waitForFunction((mainSelector) => { const m = globalThis.document.querySelector(mainSelector) ?? globalThis.document.querySelector("main"); return m !== null && m.children.length > 0; }, sel("shell.main"), { timeout: 8_000 }).catch(() => undefined);
    const settle = await settled(page, opts.settleTimeout ?? 15_000);
    details.settle = settle;
    await restPointer(page);
    const rendered = await renderedFacts(page);
    details.rendered = rendered;
    const axe = await runAxe(page);
    details.axe = axe;
    const craftReading = await readCraft(page);
    details.craftReading = craftReading;
    const paint = await page.evaluate(() => {
      const p = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
      return p ? Math.round(p.startTime) : null;
    });
    details.fcp = paint;
    const f = await facts.read();
    details.facts = { console: [...f.console], pageErrors: [...f.pageErrors], net: [...f.net], longTasks: f.longTasks, glLost: f.glLost };
    details.craft = scoreCraft(craftReading, { [opts.theme]: axe }, opts.kind ?? "grid");
    const rootState = rendered.roots.map((r) => `${r.id}=${r.state}`).join(",") || "none";
    const rows = rendered.tables.map((t) => `${t.id}:${t.rows}`).join(",") || "-";
    const problems = [];
    if (!settle.ok) problems.push(`unsettled(${settle.fault})`);
    if (details.status && details.status >= 400) problems.push(`http${details.status}`);
    if (blocking(axe).length > 0) problems.push(`axe-blocking:${blocking(axe).map((v) => v.id).join("+")}`);
    if (f.console.length + f.pageErrors.length > 0) problems.push(`console:${f.console.length + f.pageErrors.length}`);
    if (f.net.length > 0) problems.push(`net:${f.net.length}`);
    if (f.glLost > 0) problems.push(`webgl-lost:${f.glLost}`);
    if (details.craft.total < 4 || details.craft.min < 3) problems.push(`craft:${details.craft.total}/min${details.craft.min}`);
    const line = `${problems.length === 0 ? "OK " : "RED"} route=${route} state=${rootState} regions=${rendered.regions.length} rows=${rows} ${axeLine(axe)} console=${f.console.length + f.pageErrors.length} net5xx=${f.net.length} fcp=${details.fcp}ms long=${f.longTasks} ${railState(craftReading)} craft=${details.craft.total}/min${details.craft.min} theme=${opts.theme} ${opts.viewport.width}x${opts.viewport.height} t=${Date.now() - started}ms${problems.length ? ` why=${problems.join(";")}` : ""}`;
    details.line = line;
    return details;
  } catch (error) {
    details.line = `RED route=${route} why=${String(error?.message ?? error).split("\n")[0].slice(0, 200)}`;
    details.error = String(error?.stack ?? error);
    return details;
  }
}

async function main() {
  const mode = process.argv[2];
  if (!mode) { console.error("usage: probe.mjs signin|walk|run …"); process.exit(2); }
  const out = arg("--out", join(HERE, "out"));
  // `--out` names a DIRECTORY for walk and run and a FILE for signin: making the directory here for
  // every mode once turned signin's cookies.json into a directory and the write into EISDIR
  // (session 5's probes); signin makes the file's own parent below.
  if (mode !== "signin") mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...LAUNCH });
  try {
    if (mode === "signin") {
      const [email, password] = positional();
      const context = await openContext(browser);
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/sign-in`);
      await page.getByTestId("s-auth-email").fill(email);
      await page.getByTestId("s-auth-password").fill(password);
      await page.getByTestId("s-auth-submit").click();
      await page.waitForURL(/\/$/, { timeout: 20_000 }).catch(() => undefined);
      const refusal = await page.getByTestId("s-auth-refusal").count();
      const file = arg("--out", join(HERE, "cookies.json"));
      if (refusal > 0 || !/\/$/.test(page.url())) { console.log(`RED signin ${email} url=${page.url()} refusal=${refusal}`); process.exit(1); }
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(await context.cookies()));
      console.log(`OK signin ${email} cookies=${file}`);
      return;
    }
    if (mode === "walk") {
      const routes = positional();
      const themes = (arg("--themes", "dark")).split(",");
      const viewports = (arg("--viewports", "1440x900")).split(",").map((v) => { const [w, h] = v.split("x").map(Number); return { width: w, height: h }; });
      const kind = arg("--kind", "grid");
      const cookies = arg("--cookies", join(HERE, "cookies.json"));
      const name = arg("--name", null);
      const all = [];
      for (const theme of themes) for (const viewport of viewports) {
        const context = await openContext(browser, { theme, viewport, cookies });
        const page = await context.newPage();
        const facts = instrument(page);
        for (const route of routes) {
          const details = await check(page, facts, route, { theme, viewport, kind, themeParam: true });
          console.log(details.line);
          if (details.facts) for (const c of [...details.facts.console, ...details.facts.pageErrors]) console.log(`  console: ${c}`);
          if (details.facts) for (const n of details.facts.net) console.log(`  net: ${n}`);
          if (details.axe) for (const v of blocking(details.axe)) console.log(`  axe ${v.impact} ${v.id}: ${v.nodes.map((n) => n.target).slice(0, 3).join(" | ")}`);
          const base = `${name ?? slug(route)}.${theme}.${viewport.width}x${viewport.height}`;
          if (flag("--shot") && !details.error) await page.screenshot({ path: join(out, `${base}.png`), fullPage: false });
          writeFileSync(join(out, `${base}.json`), JSON.stringify(details, null, 1));
          all.push(details);
        }
        await context.close();
      }
      if (flag("--json")) writeFileSync(join(out, `walk.${Date.now()}.json`), JSON.stringify(all, null, 1));
      return;
    }
    if (mode === "run") {
      const [script] = positional();
      const cookies = arg("--cookies", join(HERE, "cookies.json"));
      const mod = await import(resolve(script));
      const api = { browser, openContext: (o) => openContext(browser, { cookies, ...o }), instrument, check, settled, renderedFacts, runAxe, blocking, axeLine, readCraft, scoreCraft, out, ORIGIN, shot: flag("--shot"), slug };
      await mod.default(api);
      return;
    }
    console.error(`unknown mode ${mode}`);
    process.exit(2);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.log(`RED probe why=${String(error?.stack ?? error).split("\n").slice(0, 3).join(" / ")}`); process.exit(1); });
