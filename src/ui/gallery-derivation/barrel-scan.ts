/**
 * Where "a barrel" is defined, once (B-17). The gallery's completeness surface (R-UI-011, B-19) is
 * a filesystem scan and never a list — but a scan is a rule, and a rule with two implementations
 * can drift until no roster satisfies both. So the rule lives here, in one function, and the
 * product suite that binds `galleryBarrels` to the tree calls it rather than restating it.
 *
 * The rule is the one the Design Decision and the acceptance spell: a barrel is a directory with an
 * index file at `src/ui/primitives/<name>/`, `src/ui/patterns/<name>/`, or `src/ui/shell/` — the
 * groups the gallery consumes. `src/ui`'s other directories (`strings`, `theme`, this module) hold
 * helpers and tokens, not mountable components, and owe no entry.
 *
 * Node-only: nothing the page bundles imports this file.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `src/ui` — this module sits at `src/ui/gallery-derivation/`. */
const UI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The groups whose every child directory is a barrel. */
const BARREL_GROUPS = ["primitives", "patterns"] as const;

/** The group-less barrel, named by its own directory rather than by a group above it. */
const SHELL_BARREL = "shell";

/** The index-file spellings a barrel may carry. */
const INDEX_FILES = ["index.ts", "index.tsx"] as const;

/** A barrel on disk: its id (the path under `src/ui`) and the index file that publishes it. */
export interface BarrelOnDisk {
  id: string;
  index: string;
}

/** The directory's index file, or null when the directory publishes none. */
function indexOf(dir: string): string | null {
  for (const name of INDEX_FILES) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** The barrels the tree publishes today, code-point sorted by id. */
export function barrelsOnDisk(uiDir: string = UI_DIR): BarrelOnDisk[] {
  const found: BarrelOnDisk[] = [];

  for (const group of BARREL_GROUPS) {
    const groupDir = join(uiDir, group);
    if (!existsSync(groupDir) || !statSync(groupDir).isDirectory()) continue;
    for (const name of readdirSync(groupDir)) {
      const dir = join(groupDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const index = indexOf(dir);
      if (index !== null) found.push({ id: `${group}/${name}`, index });
    }
  }

  const shellDir = join(uiDir, SHELL_BARREL);
  if (existsSync(shellDir) && statSync(shellDir).isDirectory()) {
    const index = indexOf(shellDir);
    if (index !== null) found.push({ id: SHELL_BARREL, index });
  }

  return found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The barrel ids alone, code-point sorted — the roster `galleryBarrels`' keys must equal. */
export function barrelIdsOnDisk(uiDir: string = UI_DIR): string[] {
  return barrelsOnDisk(uiDir).map((barrel) => barrel.id);
}
