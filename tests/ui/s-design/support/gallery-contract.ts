/**
 * Support for the S-Design acceptance (AC-1, AC-2): the filesystem scan the barrel roster is
 * derived from, a string-aware comment stripper, the import/colour scans AC-2 names, and the jsdom
 * stubs a page full of live primitives needs before it will mount.
 *
 * Nothing here transcribes today's tree (B-19). The barrel roster is read off disk with the two
 * globs AC-1 spells; the entry roster comes from the product's own derivation; the scans are
 * predicates over whatever files the increment ships.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { expect, vi } from "vitest";

/** The checkout root — this file sits at tests/ui/s-design/support/. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * Read a file the increment owes, failing by name when it is not there yet. Every scan below goes
 * through this, so a missing module reds as the missing module rather than as an ENOENT.
 */
export function readRepoFile(file: string): string {
  const path = join(REPO_ROOT, file);
  expect(existsSync(path), `${file} is missing from the checkout — the increment owes it`).toBe(true);
  return readFileSync(path, "utf8");
}

/** The two barrel groups AC-1's scan reads, plus the shell barrel a later increment may grow. */
const BARREL_GROUPS = ["primitives", "patterns"] as const;

/** The index-file spellings AC-1 admits for a barrel. */
const INDEX_FILES = ["index.ts", "index.tsx"] as const;

/** The barrel directory's index file, or null when the directory is not a barrel. */
function indexOf(dir: string): string | null {
  for (const name of INDEX_FILES) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Every barrel the tree publishes, as `<path relative to src/ui>`: `primitives/core`,
 * `patterns/refusal-state`, and `shell` when `src/ui/shell/index.ts{,x}` arrives. This is AC-1's
 * completeness surface — a scan, never a list, so a barrel added later joins it by existing.
 */
export function barrelDirsOnDisk(): { id: string; dir: string; index: string }[] {
  const uiDir = join(REPO_ROOT, "src/ui");
  expect(existsSync(uiDir), "src/ui holds the barrels the gallery's completeness surface is derived from").toBe(true);
  const found: { id: string; dir: string; index: string }[] = [];

  for (const group of BARREL_GROUPS) {
    const groupDir = join(uiDir, group);
    if (!existsSync(groupDir)) continue;
    for (const name of readdirSync(groupDir).sort()) {
      const dir = join(groupDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const index = indexOf(dir);
      if (index !== null) found.push({ id: `${group}/${name}`, dir, index });
    }
  }

  const shellDir = join(uiDir, "shell");
  const shellIndex = existsSync(shellDir) && statSync(shellDir).isDirectory() ? indexOf(shellDir) : null;
  if (shellIndex !== null) found.push({ id: "shell", dir: shellDir, index: shellIndex });

  return found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The barrel ids alone, code-point sorted. */
export function barrelIdsOnDisk(): string[] {
  return barrelDirsOnDisk().map((barrel) => barrel.id);
}

/* ------------------------------------------------------------------ source scans */

type StripState = "code" | "line" | "block" | "single" | "double" | "template";

/**
 * Strip comments without eating strings. A naive block-comment regex treats the slash-star inside
 * a glob such as a Playwright testMatch entry as a comment opener and swallows everything to the
 * next star-slash, which silently deletes the very lines a scan is looking for — so this walks the
 * text and only leaves code when it is in code. Regex literals are not tracked: a regex cannot
 * open with a second slash or a star, so neither comment opener can be one.
 */
export function stripComments(source: string): string {
  let state: StripState = "code";
  let out = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        index += 1;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block";
        index += 1;
        continue;
      }
      if (char === "'") state = "single";
      else if (char === '"') state = "double";
      else if (char === "`") state = "template";
      out += char;
      continue;
    }
    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      }
      continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") {
        state = "code";
        index += 1;
      } else if (char === "\n") {
        out += char;
      }
      continue;
    }
    // Inside a string of some kind: copy it through, honouring escapes and its own terminator.
    out += char;
    if (char === "\\") {
      out += next;
      index += 1;
      continue;
    }
    if ((state === "single" && char === "'") || (state === "double" && char === '"') || (state === "template" && char === "`")) {
      state = "code";
    }
  }
  return out;
}

/** Every file under `dir`, recursively, repo-relative and code-point sorted. */
export function filesUnder(dir: string): string[] {
  const absolute = join(REPO_ROOT, dir);
  if (!existsSync(absolute)) return [];
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const child = join(current, name);
      if (statSync(child).isDirectory()) walk(child);
      else out.push(relative(REPO_ROOT, child).split(sep).join("/"));
    }
  };
  walk(absolute);
  return out.sort();
}

/** Every module specifier a file imports — `from "x"`, a bare side-effect `import "x"`, `import("x")`. */
export function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  const patterns = [
    /\bfrom\s*(["'])((?:\\.|(?!\1).)*)\1/g,
    /\bimport\s*(["'])((?:\\.|(?!\1).)*)\1/g,
    /\bimport\s*\(\s*(["'])((?:\\.|(?!\1).)*)\1/g,
    /\brequire\s*\(\s*(["'])((?:\\.|(?!\1).)*)\1/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) specifiers.push(match[2] ?? "");
  }
  return specifiers;
}

/**
 * The barrel-internal imports a file commits (B-17, R-UI-011): a relative specifier that lands
 * inside a barrel directory on anything but that barrel's own index. Importing the barrel
 * directory itself, or its index by name, is the sanctioned door.
 *
 * Stylesheets are not module paths and are not offences: a stylesheet has one home and importing
 * it directly is the reuse B-17 asks for, not a way past the barrel — `src/app/(auth)/layout.tsx`
 * already pulls the reticle's single home that way. The ban is on reaching a *component* module
 * behind its barrel.
 */
export function barrelInternalImports(file: string): string[] {
  const source = readRepoFile(file);
  const fileDir = dirname(join(REPO_ROOT, file));
  const barrels = barrelDirsOnDisk();
  const offences: string[] = [];

  for (const specifier of importSpecifiers(source)) {
    if (!specifier.startsWith(".")) continue;
    if (/\.(css|svg|png|woff2?|json)$/.test(specifier)) continue;
    const resolved = resolve(fileDir, specifier);
    for (const barrel of barrels) {
      if (resolved === barrel.dir) continue; // the barrel directory itself
      if (!resolved.startsWith(barrel.dir + sep)) continue;
      const inside = relative(barrel.dir, resolved).split(sep).join("/");
      const isIndex = inside === "index" || inside === "index.ts" || inside === "index.tsx";
      if (!isIndex) offences.push(`${file} → ${specifier} (inside the ${barrel.id} barrel)`);
    }
  }
  return offences;
}

/**
 * The colour-literal shapes R-UI-001 bans, built from parts so this scanner's own text carries
 * none of them: every name below is followed by a quote, never by an opening parenthesis, and the
 * hex shape opens with a character class rather than a hex digit.
 */
const COLOUR_FUNCTIONS = ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color-mix"];

const COLOUR_SHAPES: { name: string; pattern: RegExp }[] = [
  { name: "a hex colour", pattern: new RegExp("#[0-9a-fA-F]{3,8}\\b", "g") },
  { name: "a packed hex colour", pattern: new RegExp("\\b0x[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\\b", "g") },
  { name: "a colour function", pattern: new RegExp(`\\b(?:${COLOUR_FUNCTIONS.join("|")})\\s*\\(`, "g") },
];

/** The colour literals a file spells outside the token source (R-UI-001). */
export function colourLiterals(file: string): string[] {
  const text = stripComments(readRepoFile(file));
  const offences: string[] = [];
  for (const shape of COLOUR_SHAPES) {
    for (const match of text.matchAll(shape.pattern)) offences.push(`${file}: ${shape.name} at index ${match.index}`);
  }
  return offences;
}

/* ------------------------------------------------------------------ jsdom stubs */

let installed = false;

/**
 * jsdom performs no layout and ships no ResizeObserver; the gallery mounts a virtualiser, Radix
 * overlays and a toaster, all of which ask for one or the other. These stubs answer, and nothing
 * else about the document is touched — the acceptance judges structure, never geometry.
 */
export function installGalleryDomStubs(): void {
  if (installed) return;
  installed = true;

  const scope = globalThis as unknown as { ResizeObserver?: unknown; matchMedia?: unknown; IntersectionObserver?: unknown };

  if (typeof scope.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      readonly callback: (entries: unknown[], observer: unknown) => void;
      constructor(callback: (entries: unknown[], observer: unknown) => void) {
        this.callback = callback;
      }
      observe(target: Element): void {
        this.callback([{ target, contentRect: target.getBoundingClientRect() }], this);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    scope.ResizeObserver = ResizeObserverStub;
  }

  if (typeof scope.IntersectionObserver === "undefined") {
    class IntersectionObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): unknown[] {
        return [];
      }
    }
    scope.IntersectionObserver = IntersectionObserverStub;
  }

  if (typeof scope.matchMedia !== "function") {
    scope.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (typeof proto.scrollIntoView !== "function") proto.scrollIntoView = function scrollIntoView(): void {};
  if (typeof proto.scrollTo !== "function") proto.scrollTo = function scrollTo(): void {};
  if (typeof proto.hasPointerCapture !== "function")
    proto.hasPointerCapture = function hasPointerCapture(): boolean {
      return false;
    };
  if (typeof proto.setPointerCapture !== "function") proto.setPointerCapture = function setPointerCapture(): void {};
  if (typeof proto.releasePointerCapture !== "function") proto.releasePointerCapture = function releasePointerCapture(): void {};
}

/* ------------------------------------------------- the component a state actually renders (AC-1) */

/**
 * Every identity a component wears: itself, and — for `memo` and `forwardRef` — whatever it wraps.
 * A barrel that publishes `memo(Button)` and an entry that renders `<Button/>` are the same
 * component, and neither spelling may be the difference between a bound test and a hollow one.
 */
function componentIdentities(value: unknown, depth = 0): unknown[] {
  const found: unknown[] = [value];
  if (depth > 4 || typeof value !== "object" || value === null) return found;
  const wrapper = value as { type?: unknown; render?: unknown };
  if (wrapper.type !== undefined && wrapper.type !== null) found.push(...componentIdentities(wrapper.type, depth + 1));
  if (typeof wrapper.render === "function") found.push(...componentIdentities(wrapper.render, depth + 1));
  return found;
}

/** Are these two values the same component, through any number of memo/forwardRef wrappers? */
export function sameComponent(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return false;
  if (a === b) return true;
  const left = componentIdentities(a);
  return componentIdentities(b).some((identity) => identity !== undefined && left.includes(identity));
}

/**
 * Does this ReactNode actually put `target` on the screen (R-UI-011: the gallery renders the
 * component, and a state whose sample is a bare string shows nothing of it)?
 *
 * The node is walked as React built it: arrays and fragments, `props.children`, and element-valued
 * props (a `trigger`, a `content`, an `icon`). A state that wraps its component in a local demo
 * component is met by calling that wrapper once and walking what it produced — guarded, because a
 * component that needs a real renderer throws instead, and that is not this predicate's business.
 */
export function rendersComponent(node: unknown, target: unknown, depth = 0): boolean {
  if (node === null || node === undefined || depth > 6) return false;
  if (Array.isArray(node)) return node.some((child) => rendersComponent(child, target, depth + 1));
  if (typeof node !== "object") return false;
  if (sameComponent(node, target)) return true;

  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === undefined) return false;
  if (sameComponent(element.type, target)) return true;

  const props = element.props ?? {};
  for (const value of Object.values(props)) {
    if (rendersComponent(value, target, depth + 1)) return true;
  }

  if (typeof element.type === "function" && depth < 3) {
    try {
      const produced = (element.type as (props: unknown) => unknown)(props);
      if (rendersComponent(produced, target, depth + 1)) return true;
    } catch {
      /* a component that needs a renderer cannot be unwrapped by calling it */
    }
  }
  return false;
}

/* ------------------------------------------------------ mounting /design over a derivation (AC-2) */

/** One named state of a gallery entry, as the interfaces line declares it. */
export interface StateShape {
  readonly name: string;
  readonly render: () => unknown;
}

/** The derivation module's public surface — what `/design` may read, and all it may read. */
export interface DerivationShape {
  galleryBarrels: Record<string, Record<string, unknown>>;
  componentExports: (namespace: Record<string, unknown>) => string[];
  galleryEntries: Record<string, { states: readonly StateShape[] }>;
  missingEntries: (entries?: Record<string, { states: readonly StateShape[] }>) => string[];
}

/** The derivation module the page renders, as the interfaces line spells it. */
export function derivationPath(): string {
  const dir = join(REPO_ROOT, "src/ui/gallery-derivation");
  return indexOf(dir) ?? join(dir, "index.ts");
}

/** The `/design` route's page module, as the test contract spells it. */
export function pagePath(): string {
  return join(REPO_ROOT, "src/app/(app)/design/page.tsx");
}

/**
 * A derivation that no hand-written page could be carrying: two barrels and three entries that
 * exist nowhere in the tree. Mounting the page over this is how "renders the derivation" is told
 * apart from "transcribes what the derivation happens to hold today" — the second renders the real
 * keys whatever the module says, and the first renders these (B-19).
 */
export function syntheticDerivation(): DerivationShape {
  const cell = (label: string): unknown => React.createElement("output", null, label);
  const Alpha = (): unknown => cell("alpha");
  const Beta = (): unknown => cell("beta");
  const Gamma = (): unknown => cell("gamma");

  const galleryBarrels: Record<string, Record<string, unknown>> = {
    "probe/first": { Alpha, Beta },
    "probe/second": { Gamma },
  };
  const galleryEntries: Record<string, { states: readonly StateShape[] }> = {
    "probe/first/Alpha": {
      states: [
        { name: "resting", render: () => React.createElement(Alpha as never) },
        { name: "busy", render: () => React.createElement(Alpha as never) },
      ],
    },
    "probe/first/Beta": { states: [{ name: "resting", render: () => React.createElement(Beta as never) }] },
    "probe/second/Gamma": {
      states: [
        { name: "resting", render: () => React.createElement(Gamma as never) },
        { name: "empty", render: () => React.createElement(Gamma as never) },
        { name: "refused", render: () => React.createElement(Gamma as never) },
      ],
    },
  };

  const componentExports = (namespace: Record<string, unknown>): string[] =>
    Object.keys(namespace)
      .filter((name) => /^[A-Z]/.test(name) && typeof namespace[name] === "function")
      .sort();
  const missingEntries = (entries: Record<string, { states: readonly StateShape[] }> = galleryEntries): string[] =>
    Object.keys(galleryBarrels)
      .flatMap((id) => componentExports(galleryBarrels[id] ?? {}).map((name) => `${id}/${name}`))
      .filter((key) => !(key in entries))
      .sort();

  return { galleryBarrels, componentExports, galleryEntries, missingEntries };
}

/** A mounted `/design`, with the cleanup of the very renderer that mounted it. */
export interface MountedPage {
  container: HTMLElement;
  cleanup: () => void;
}

/**
 * Mount `/design`'s default export, optionally over a derivation of the caller's choosing.
 *
 * The page module is imported fresh for every mount, after the mock is registered, so a page that
 * reads the derivation once at module scope is judged the same way as one that reads it per render.
 * React and the renderer are re-imported through the same registry the page came from, so there is
 * only ever one React in the graph that is rendering.
 */
export async function mountDesignPage(derivation?: DerivationShape): Promise<MountedPage> {
  vi.resetModules();
  if (derivation === undefined) vi.doUnmock(derivationPath());
  else vi.doMock(derivationPath(), () => derivation);

  const react = (await import("react")) as unknown as typeof React;
  const renderer = (await import("@testing-library/react")) as unknown as {
    render: (node: unknown) => { container: HTMLElement };
    cleanup: () => void;
  };

  const path = pagePath();
  expect(existsSync(path), "src/app/(app)/design/page.tsx is missing — the /design route is not there yet").toBe(true);
  const module = (await import(path)) as { default?: unknown };
  const component = module.default;
  const mountable =
    typeof component === "function" ||
    (typeof component === "object" && component !== null && typeof (component as { $$typeof?: unknown }).$$typeof === "symbol");
  expect(mountable, "src/app/(app)/design/page.tsx default-exports a component jsdom can mount").toBe(true);

  installGalleryDomStubs();
  const { container } = renderer.render(react.createElement(component as never));
  return { container, cleanup: () => renderer.cleanup() };
}
