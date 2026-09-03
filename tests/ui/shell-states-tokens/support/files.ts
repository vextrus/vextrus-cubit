/**
 * The recursive walk the source-reading criteria in this suite need. A scan that reads one directory
 * level is hollow — it passes because it never looked — so every roster here is derived by walking
 * the tree it is given (B-19), and a path that does not exist contributes nothing rather than
 * throwing.
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** Every file under a directory (or the file itself), recursively, absolute, code-point sorted. */
export function filesUnder(root: string): string[] {
  const start = resolve(root);
  const stats = statSync(start, { throwIfNoEntry: false });
  if (stats === undefined) return [];
  if (stats.isFile()) return [start];
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules") continue;
      const child = join(dir, name);
      const childStats = statSync(child, { throwIfNoEntry: false });
      if (childStats === undefined) continue;
      if (childStats.isDirectory()) walk(child);
      else found.push(child);
    }
  };
  walk(start);
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The same walk, kept to the extensions a dialect can be read in. */
export function sourceFilesUnder(root: string, extensions: readonly string[]): string[] {
  return filesUnder(root).filter((file) => extensions.some((extension) => file.endsWith(extension)));
}
