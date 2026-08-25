// The one reading of ARCH-01's geography (ARCH-02): which layer a file belongs to, and which layer
// a module specifier points at. Every boundary rule asks these two questions and no other.
import { dirname, join, posix, resolve } from "node:path";

/** The layers ARCH-01 names, in the order it names them. */
export const LAYERS = Object.freeze(["core", "modules", "server", "app", "ui", "worker"]);

/**
 * @typedef {{layer: string, module: string | null, path: string}} Site
 */

/**
 * Which layer does this file live in? Paths are read from their last `src/` segment, so a fixture
 * standing in for `src/core/x.ts` is judged as core wherever it physically sits.
 * @param {string} filePath
 * @returns {Site | null} null when the file is outside the layered tree
 */
export function layerOf(filePath) {
  const normalised = filePath.replace(/\\/g, "/");
  const marker = normalised.lastIndexOf("/src/");
  const tail = marker === -1 ? (normalised.startsWith("src/") ? normalised.slice(4) : null) : normalised.slice(marker + 5);
  if (tail === null) return null;
  const segments = tail.split("/").filter((segment) => segment.length > 0);
  const layer = segments[0];
  if (layer === undefined || !LAYERS.includes(layer)) return null;
  return { layer, module: layer === "modules" ? (segments[1] ?? null) : null, path: tail };
}

/**
 * Which layer does this specifier point at? Package specifiers point outside the tree and are not
 * this rule's business.
 * @param {string} specifier
 * @param {string} fromFile absolute or repo-relative path of the importing file
 * @returns {Site | null}
 */
export function targetOf(specifier, fromFile) {
  if (specifier.startsWith(".")) {
    const resolved = posix.normalize(posix.join(dirname(fromFile.replace(/\\/g, "/")), specifier));
    return layerOf(resolved);
  }
  if (specifier.startsWith("@/")) return layerOf(`src/${specifier.slice(2)}`);
  if (specifier.startsWith("src/")) return layerOf(specifier);
  return null;
}

/**
 * Resolve an internal specifier to the file it names. A specifier that names no file on disk still
 * resolves — to the `.ts` the tree would have to create — so a cycle is visible before both of its
 * halves exist.
 * @param {string} specifier
 * @param {string} fromFile absolute path
 * @param {string} rootDir absolute repo root
 * @param {(path: string) => boolean} exists
 * @returns {string | null} absolute path, or null for a package specifier
 */
export function resolveInternal(specifier, fromFile, rootDir, exists) {
  /** @type {string | null} */
  let base = null;
  if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else if (specifier.startsWith("@/")) base = resolve(rootDir, "src", specifier.slice(2));
  else if (specifier.startsWith("src/")) base = resolve(rootDir, specifier);
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.js`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (exists(candidate) && !candidate.endsWith("/")) return candidate;
  }
  return `${base}.ts`;
}
