// Where this seam's artefacts stand, and what the manifest pins the renderer at (B-24, AM-08, C-06).
//
// B-24: every artefact a document needs is vendored in this repository — the faces, the brand mark,
// the page frame, each kind's template. So the seam needs one honest answer to "where is the
// checkout", and this file is it. The runner, the fonts and the kind registry all ask HERE; three
// resolutions of one path would be three ways for a deployment to find two of them and miss the third.
//
// AM-08 pins Typst by version AND sha256, and both halves live in package.json's C-06 toolchain
// block, where `pnpm checkup` refuses drift. They are READ from there and never spelled in this seam:
// a constant copied into a module would answer every render exactly as the read does, and the two
// would part company on the day the pin moved — stamping every document with a pin the machine no
// longer runs. The digest is recorded in prose in docs/toolchain/typst.md, beside the install recipe.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** What names a directory as this checkout: the manifest carrying this product's own toolchain block. */
const MANIFEST = "package.json";

/** The two halves AM-08 pins the renderer by. */
export interface RendererPin {
  readonly version: string;
  readonly sha256: string;
}

/**
 * The checkout this seam's assets stand in, resolved on first use rather than at import.
 *
 * It is a WALK for a marker rather than a count of directory levels, for the reason
 * `src/modules/takeoff/ingest/cli.ts` records about the other subprocess this product spawns: under a
 * bundler `import.meta.url` names a chunk somewhere under `.next/server/`, and a fixed number of `..`
 * segments from there lands nowhere. The marker is the manifest that carries `cubit.tools.typst`, so
 * a parent checkout's `package.json` is never mistaken for this product's.
 */
let resolvedRoot: string | undefined;
export function documentTreeRoot(): string {
  return (resolvedRoot ??= rootAmong([dirname(fileURLToPath(/* turbopackIgnore: true */ import.meta.url)), process.cwd()]));
}

/** The first directory at or above one of the candidates whose manifest carries this product's pins. */
function rootAmong(candidates: readonly string[]): string {
  for (const candidate of candidates) {
    for (let dir = resolve(/* turbopackIgnore: true */ candidate); ; dir = dirname(dir)) {
      if (pinnedAt(join(/* turbopackIgnore: true */ dir, MANIFEST)) !== null) return dir;
      if (dirname(dir) === dir) break;
    }
  }
  throw new Error(`the document seam has no checkout to render in: no ${MANIFEST} carrying cubit.tools.typst stands at or above ${candidates.join(", ")}`);
}

/** The pin this manifest states, or null when it is not this product's manifest at all. */
function pinnedAt(manifest: string): RendererPin | null {
  if (!existsSync(manifest)) return null;
  let read: unknown;
  try {
    read = JSON.parse(readFileSync(manifest, "utf8"));
  } catch {
    // A manifest that is not JSON is not this product's; the walk goes on rather than stopping here.
    return null;
  }
  const pin = (read as { cubit?: { tools?: { typst?: { version?: unknown; sha256?: unknown } } } }).cubit?.tools?.typst;
  return typeof pin?.version === "string" && typeof pin.sha256 === "string" ? Object.freeze({ version: pin.version, sha256: pin.sha256 }) : null;
}

/**
 * The renderer's pin as the manifest states it. Read on every call rather than memoised: the manifest
 * is the pin's one home, and a value cached at import would outlive a pin move inside a process.
 */
export function pinnedRenderer(): RendererPin {
  const pin = pinnedAt(join(documentTreeRoot(), MANIFEST));
  if (pin === null) throw new Error(`${MANIFEST} states no cubit.tools.typst pin — AM-08 pins the renderer by version and sha256`);
  return pin;
}

/** The vendored faces' directory — the only place `--ignore-system-fonts` leaves the renderer to look. */
export function documentFontPath(): string {
  return join(documentTreeRoot(), "src", "ui", "fonts");
}

/** The page frame, the draft banner and the brand mark every document of this product is set in. */
export function documentBasePath(): string {
  return join(documentTreeRoot(), "documents", "base");
}

/** The directory each kind's file and its template stand in, side by side (SEAM-DOC). */
export function documentKindsPath(): string {
  return join(documentTreeRoot(), "src", "core", "documents", "kinds");
}

/**
 * The brand mark a document is stamped with: the NO-SPARK mark, which is the one this product's
 * documents use — the spark never stands beside a draft (the document seam's Design Decision).
 *
 * It is read from `src/ui/brand`, where the asset lives, rather than copied into `documents/base`: a
 * second file holding the same drawing would be a second answer to what this product's mark is, and
 * the day the mark was redrawn one of them would be stale (B-17). ARCH-01 is untouched — this is a
 * path to a vendored ASSET, not an import of anything the UI tier declares.
 */
export function documentMarkFile(): string {
  return join(documentTreeRoot(), "src", "ui", "brand", "vextrus-mark-nospark.svg");
}
