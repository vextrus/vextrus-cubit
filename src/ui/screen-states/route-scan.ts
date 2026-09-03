/**
 * Where "a screen" is defined, once (B-17). R-UI-050's matrix is closed against the tree rather than
 * against a list: the roster is every `page.tsx` the app router holds, derived by a scan, so a screen
 * added later joins the required set by existing (B-19). A rule with two implementations can drift
 * until no roster satisfies both, so the rule lives here and `screenStates`' completeness suite calls
 * it rather than restating it.
 *
 * The rule is the Next app router's own: a `page.tsx` is routable at the directory it sits in, and a
 * `(group)` directory names no path segment. The root page is `/`.
 *
 * Node-only, like `gallery-derivation/barrel-scan.ts`: nothing a page bundles imports this file.
 */
import { readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `src/app` — this module sits at `src/ui/screen-states/`. */
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "app");

/** The file that makes a directory routable. */
const PAGE_FILE = "page.tsx";

/** Code point order, never a locale's — `localeCompare` is banned tree-wide (no-raw-intl). */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A route-group segment — `(app)`, `(auth)` — organises files and contributes no path segment. */
const isGroup = (segment: string): boolean => segment.startsWith("(") && segment.endsWith(")");

/** The route key of a page reached through these directory segments below the app dir. */
function routeKeyOf(segments: readonly string[]): string {
  const kept = segments.filter((segment) => !isGroup(segment));
  return kept.length === 0 ? "/" : `/${kept.join("/")}`;
}

/**
 * Every `page.tsx` under an app directory, as route keys, code-point sorted. A directory that holds
 * no page contributes nothing, and an app directory that does not exist holds no screens — that is
 * an empty roster, not a fault, so a caller scanning a tree without routes is answered rather than
 * thrown at (the `barrelsOnDisk` precedent).
 */
export function routesOnDisk(appDir: string = APP_DIR): string[] {
  // A set, because two route groups can hold the same segment — `(a)/x` and `(b)/x` are one address
  // and must be one entry: a roster that answered it twice would ask a screen to declare its seven
  // states twice over (R-UI-050, B-19). Which of the two files serves it is `next build`'s question.
  const found = new Set<string>();

  const walk = (dir: string, segments: readonly string[]): void => {
    // A path that vanished between the read and the stat is not a screen; nothing is invented for it.
    const entries = statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true ? readdirSync(dir) : [];
    for (const name of entries) {
      const child = join(dir, name);
      const stats = statSync(child, { throwIfNoEntry: false });
      if (stats === undefined) continue;
      if (stats.isDirectory()) walk(child, [...segments, name]);
      else if (name === PAGE_FILE) found.add(routeKeyOf(segments));
    }
  };

  walk(resolve(appDir), []);
  return [...found].sort(byCodePoint);
}
