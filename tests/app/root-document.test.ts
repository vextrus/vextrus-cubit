// @vitest-environment jsdom
/**
 * Public acceptance for the root document — AC-2 (the Datum theme resolves on the document) and
 * AC-4 (`pnpm e2e --journey J-000` runs a journey instead of recording the missing-roster skip).
 *
 * What only a browser can answer is answered in a browser: tests/e2e/j-000-golden-path.e2e.ts
 * loads `/`, compares the light and dark captures and runs axe. What this lane can judge without
 * one is judged here — the element the root layout returns, the pre-paint theme resolver it ships
 * (executed against both OS preferences), the journey runner's derived roster, and the journey
 * config that must build and serve the product on the e2e port.
 *
 * Nothing here reads product source: the layout is invoked and its returned element inspected, the
 * journey config is imported for its exported value, and Playwright itself is asked what it
 * collects.
 */
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { deriveStage } from "../../scripts/lib/lanes.mjs";
import { portFor } from "../../scripts/lib/ports.mjs";
import { REPO_ROOT, loadStrings, productModule } from "../server/support/wire";
import playwrightConfig from "../../playwright.config";

const LAYOUT_MODULE = "src/app/layout.tsx";
const JOURNEY_DIR = "tests/e2e/";
const JOURNEY_SPEC = `${JOURNEY_DIR}j-000-golden-path.e2e.ts`;
const JOURNEY_ID = "J-000";

/**
 * A file Playwright reported, as this checkout names it: the report's paths are relative to its own
 * `config.rootDir`, so that is what resolves them — never an assumption about where testDir points.
 */
function repoRelative(file: string, rootDir: string): string {
  const absolute = resolve(rootDir, file).replace(/\\/g, "/");
  const root = REPO_ROOT.replace(/\\/g, "/");
  return absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : absolute;
}

/** A React element, seen through the only surface these assertions need. */
interface ElementLike {
  type: unknown;
  props: Record<string, unknown>;
}

interface LayoutModule {
  default?: unknown;
  metadata?: { title?: unknown };
}

function isElement(value: unknown): value is ElementLike {
  return typeof value === "object" && value !== null && "type" in value && "props" in value && typeof (value as ElementLike).props === "object";
}

/** Every element in the tree the layout returned, depth first — children may be arrays or scalars. */
function walk(node: unknown, seen: ElementLike[] = []): ElementLike[] {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, seen);
    return seen;
  }
  if (!isElement(node)) return seen;
  seen.push(node);
  walk(node.props["children"], seen);
  return seen;
}

/** The layout's rendered root element, with the assertions that make it one. */
async function rootElement(): Promise<ElementLike> {
  const layout = await productModule<LayoutModule>(LAYOUT_MODULE);
  expect(typeof layout.default, `${LAYOUT_MODULE} must default-export RootLayout — Next renders the default export`).toBe("function");
  const RootLayout = layout.default as (props: { children: unknown }) => unknown;
  const rendered = RootLayout({ children: null });
  expect(rendered, "RootLayout is synchronous: it returns an element, never a promise").not.toBeInstanceOf(Promise);
  expect(isElement(rendered), "RootLayout must return an element").toBe(true);
  return rendered as ElementLike;
}

/** The code of every inline script the layout renders — the pre-paint resolver lives in one of them. */
function inlineScripts(root: ElementLike): string[] {
  const code: string[] = [];
  for (const element of walk(root)) {
    if (element.type !== "script") continue;
    const html = (element.props["dangerouslySetInnerHTML"] as { __html?: unknown } | undefined)?.__html;
    if (typeof html === "string" && html.trim().length > 0) code.push(html);
  }
  return code;
}

/**
 * Run the document's inline scripts the way the parser does — against a document whose
 * `data-theme` is the server-rendered one — while the OS preference is `prefersDark`, and answer
 * with the attribute they leave behind. `matchMedia` is stubbed for the query R-UI-001's dark
 * theme keys off and restored afterwards, so the OS this suite runs on is never consulted.
 */
function resolveTheme(scripts: string[], serverRendered: string, prefersDark: boolean): string | null {
  const root = document.documentElement;
  root.setAttribute("data-theme", serverRendered);
  const original = window.matchMedia;
  const stub = (query: string): MediaQueryList =>
    ({
      matches: prefersDark && /prefers-color-scheme\s*:\s*dark/i.test(query),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
  window.matchMedia = stub as typeof window.matchMedia;
  try {
    for (const code of scripts) new Function(code)();
  } finally {
    window.matchMedia = original;
  }
  return root.getAttribute("data-theme");
}

describe("AC-2: the Datum theme resolves on the document", () => {
  test("AC-2: the root layout renders <html lang=\"en\"> with a server-rendered data-theme", async () => {
    const root = await rootElement();
    expect(root.type, "the root layout owns the document element").toBe("html");
    expect(root.props["lang"], "R-UI-001's ground is served to a document that declares its language").toBe("en");
    expect(root.props["data-theme"], "the server renders the light theme; the client only ever resolves dark over it").toBe("light");
  });

  test("AC-2: the document carries a pre-paint resolver that answers the OS preference both ways", async () => {
    const root = await rootElement();
    const scripts = inlineScripts(root);
    expect(scripts.length, `the root document must ship the pre-paint theme resolver docs/design/root-document.md records — an inline script that resolves ${JSON.stringify("dark")} before first paint`).toBeGreaterThan(0);

    const serverRendered = String(root.props["data-theme"]);
    expect(resolveTheme(scripts, serverRendered, true), "under a dark OS preference the resolver must set data-theme to dark before first paint").toBe("dark");
    expect(resolveTheme(scripts, serverRendered, false), "under a light OS preference the server-rendered attribute stands untouched").toBe(serverRendered);
  });

  test("AC-2: the root layout exports metadata whose title is the string table's app_title", async () => {
    // The document title is a user-facing string, so R-SPINE-060 / C-SPINE-PLATFORM puts it in the
    // typed table like every other word in the product. Neither of that clause's named enforcers
    // reaches a `metadata` export — it is not JSX and not a key lookup the compiler can miss — so
    // this assertion is the only instrument that holds the title to the table. AC-4's checkpoint
    // reads `document.title` at `/`; it is non-empty only because the table entry is.
    const layout = await productModule<LayoutModule>(LAYOUT_MODULE);
    expect(layout.metadata, `${LAYOUT_MODULE} must export Next \`metadata\``).toBeTypeOf("object");
    const title = layout.metadata?.title;
    expect(title, "metadata.title must be a string — the document title the journey reads").toBeTypeOf("string");

    const { strings } = await loadStrings();
    const appTitle = strings["app_title"];
    expect(appTitle, "strings.app_title must be declared — the document title is a user-facing string and lives in the table (C-SPINE-PLATFORM)").toBeTypeOf("string");
    expect(String(appTitle).trim().length, "strings.app_title must not be empty, or the equality below would hold vacuously").toBeGreaterThan(0);
    expect(title, `metadata.title must be strings.app_title itself, not a literal spelled in ${LAYOUT_MODULE} — every user-facing string lives in the table (R-SPINE-060)`).toBe(appTitle);
  });
});

describe("AC-4: the J-000 journey runs", () => {
  test("AC-4: the e2e stage is armed — the runner no longer records the missing-roster skip", () => {
    const stage = deriveStage(REPO_ROOT, "e2e");
    expect(stage.status, `the journey stage is armed by the presence of ${stage.probe}; while it is absent \`pnpm e2e --journey ${JOURNEY_ID}\` exits 0 without running anything`).toBe("armed");
  });

  test("AC-4: playwright.config.ts builds and serves the product on the e2e port, never `next dev`", () => {
    const declared = playwrightConfig.webServer;
    const servers: { command?: string; url?: string; port?: number }[] = declared === undefined ? [] : Array.isArray(declared) ? declared : [declared];
    expect(servers.length, "playwright.config.ts must declare a webServer — the journeys cannot drive a product nothing started").toBeGreaterThan(0);

    const port = portFor("e2e");
    const server = servers[0] as { command?: string; url?: string; port?: number };
    const command = String(server.command ?? "");
    expect(/\bnext\b[\s\S]*\bbuild\b/.test(command), `the webServer command must build the product before serving it (got: ${command})`).toBe(true);
    expect(/\bnext\b[\s\S]*\bstart\b/.test(command), `the webServer command must serve the built product with \`next start\` (got: ${command})`).toBe(true);
    expect(/\bdev\b/.test(command), `the webServer command must never run the dev server (got: ${command})`).toBe(false);

    const targeted = server.port === port || String(server.url ?? "").includes(`:${port}`);
    expect(targeted, `the webServer must be the one the journeys drive — port ${port} (portFor("e2e")), got port=${String(server.port)} url=${String(server.url)}`).toBe(true);
    expect(String(playwrightConfig.use?.baseURL ?? ""), "the journeys' baseURL and the served port are the same number, from the same home").toContain(`:${port}`);
  });

  test(
    `AC-4: Playwright collects a ${JOURNEY_ID}-titled spec from ${JOURNEY_SPEC}`,
    () => {
      // The runner's own question, asked the runner's own way: `--grep J-000` is what
      // `pnpm e2e --journey J-000` appends, and a grep that matches nothing exits non-zero.
      const listed = spawnSync(process.execPath, [join(REPO_ROOT, "node_modules/@playwright/test/cli.js"), "test", "--list", "--reporter=json", "--grep", JOURNEY_ID], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 90_000,
      });
      const output = `${listed.stdout ?? ""}\n${listed.stderr ?? ""}`;
      expect(listed.status, `playwright found no ${JOURNEY_ID} journey to run:\n${output.slice(-1200)}`).toBe(0);

      const start = (listed.stdout ?? "").indexOf("{");
      expect(start, `playwright --list printed no JSON report:\n${output.slice(-1200)}`).toBeGreaterThanOrEqual(0);
      const report = JSON.parse((listed.stdout ?? "").slice(start)) as ListReport;

      // The outermost suite of the JSON report is the file itself; its title is the file name, and
      // AC-4 asks for the id in a describe or test title, so the file level is left out of the trail.
      const collected: { file: string; title: string }[] = [];
      const flatten = (suites: ListSuite[] | undefined, file: string, trail: string[], depth: number): void => {
        for (const suite of suites ?? []) {
          const here = suite.file ?? file;
          const titles = suite.title === undefined || depth === 0 ? trail : [...trail, suite.title];
          for (const spec of suite.specs ?? []) collected.push({ file: spec.file ?? here, title: [...titles, spec.title].join(" ") });
          flatten(suite.suites, here, titles, depth + 1);
        }
      };
      flatten(report.suites, "", [], 0);

      const journeys = collected.filter((spec) => spec.title.includes(JOURNEY_ID));
      expect(journeys.length, `at least one collected spec must carry ${JOURNEY_ID} in its title — the runner selects the journey by title, not by file name (collected: ${JSON.stringify(collected)})`).toBeGreaterThan(0);

      // J-000 is "extended per milestone", so the set of specs carrying its id is open: what this
      // increment owes is that the golden-path spec is among them and that every journey lives in
      // the journeys' home. Which further files later milestones add there is theirs to decide.
      const rootDir = report.config?.rootDir;
      expect(rootDir, "playwright --list must report the rootDir its spec paths are relative to").toBeTypeOf("string");
      const homes = [...new Set(journeys.map((journey) => repoRelative(journey.file, String(rootDir))))].sort();
      expect(homes, `${JOURNEY_SPEC} must be among the collected ${JOURNEY_ID} journeys — it is this increment's golden-path smoke`).toContain(JOURNEY_SPEC);
      for (const home of homes) {
        expect(home.startsWith(JOURNEY_DIR), `every ${JOURNEY_ID} journey lives under ${JOURNEY_DIR}, and this one is at ${home}`).toBe(true);
      }
    },
    120_000,
  );
});

/** Playwright's `--list --reporter=json` shape, only as deep as this file reads it. */
interface ListSpec {
  title: string;
  file?: string;
}

interface ListSuite {
  title?: string;
  file?: string;
  specs?: ListSpec[];
  suites?: ListSuite[];
}

interface ListReport {
  config?: { rootDir?: string };
  suites?: ListSuite[];
}
