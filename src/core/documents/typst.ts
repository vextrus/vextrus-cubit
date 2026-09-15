// SEAM-DOC: the tree's ONE path to the pinned Typst subprocess (R-SPINE-040, AM-08).
//
// No other file in this repository hands `typst` to `child_process`, and a scan of the source says so
// rather than a run of it (src/core/documents/__tests__/sole-path.test.ts): a second spawn somewhere
// else would be a second set of flags, and the flags are what make a document deterministic.
//
// Determinism is the whole of this file's job, and it is bought with four things:
//   * `--ignore-system-fonts` — the machine's own font directories are not the document's (B-24), so
//     a box with Helvetica installed renders exactly what a box without it renders;
//   * `--font-path` at the tree's vendored faces — every artefact a document needs is in this
//     repository (B-24), and the faces are pinned by the sha256 of their bytes (`./fonts.ts`);
//   * `--creation-timestamp 0` and `TZ=UTC` — a PDF carries a creation date, and a clock in the
//     output is a document that does not render to the same bytes twice (R-SPINE-040);
//   * `--root` at a staging directory of this invocation's own, so the template can reach the payload
//     and the base frame and NOTHING else on the volume — the same input stages the same tree.
//
// AM-08's pin and the paths this seam's artefacts stand at are `./tree.ts`'s — read there, once, so
// the runner, the faces and the kind registry cannot disagree about where the checkout is.
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { documentBasePath, documentFontPath, documentMarkFile, pinnedRenderer } from "./tree";

/** Where a render is staged: the directory Typst is rooted at, its main file and its output. */
export interface StagedRender {
  /** The staging directory — `--root`, and the whole of what the template may read. */
  readonly dir: string;
  /** The entry Typst compiles: the kind's own template, copied in as `main.typ`. */
  readonly main: string;
  /** Where the PDF is written, inside the staging directory. */
  readonly out: string;
}

/** What one staged render is assembled from: the kind's template, the frame and the payload bytes. */
export interface StageRequest {
  /** The kind's `.typ`, which becomes `main.typ` in the staging directory. */
  readonly template: string;
  /** The canonical payload bytes, laid down as `payload.json` for the template's `json()` to read. */
  readonly payload: Uint8Array;
}

/** How long one document may take to render before the run is abandoned as an outage (ARCH-03). */
const COMPILE_TIMEOUT_MS = 120_000;

/** How much of the renderer's own account of a failure is carried into the fault record. */
const STDERR_TAIL_CHARS = 4000;

/** The pinned renderer's command. The one `typst` literal this tree admits (`compileTypst` below). */
const BINARY = "typst";

/**
 * The renderer pin a document carries: the command and both halves AM-08 names, in one string.
 *
 * Read from the manifest on every call rather than memoised — the manifest is the pin's one home, and
 * a value cached at import would survive a pin move within a process that outlived it.
 */
export function rendererPin(): string {
  const pin = pinnedRenderer();
  return `${BINARY} ${pin.version} ${pin.sha256}`;
}

/**
 * The argv every compile carries, in the order it is given. Nothing about one document is here:
 * these are the determinism guarantees above, stated once as a constant so that no caller can render
 * under different ones — and so that the acceptance can read them without running anything.
 *
 * `--font-path` and `--root` stand here as the flags they are and take their values at the call
 * (`argvFor`), because each is a path of this particular machine and neither is a fact about the
 * pin. The two font flags are a pair: `--ignore-system-fonts` excludes what the BOX has installed,
 * and `--ignore-embedded-fonts` excludes what the RENDERER ships inside itself. Without the second,
 * a glyph the vendored faces lack would be set silently in one of Typst's own built-in families —
 * which is a document embedding a face nobody vendored, licensed, or pinned by hash (B-24, L-FMT-03).
 */
export const TYPST_ARGS: readonly string[] = Object.freeze([
  "compile",
  "--ignore-system-fonts",
  "--ignore-embedded-fonts",
  "--creation-timestamp",
  "0",
  "--font-path",
  "--root",
  "--format",
  "pdf",
]);

/** The argv above with this machine's two paths filled in where the flags that take them stand. */
function argvFor(staged: StagedRender): string[] {
  const filled = TYPST_ARGS.flatMap((arg) => {
    if (arg === "--font-path") return [arg, documentFontPath()];
    if (arg === "--root") return [arg, staged.dir];
    return [arg];
  });
  return [...filled, staged.main, staged.out];
}

/**
 * Lays one render's whole world down in a directory of its own and hands the caller what to compile.
 *
 * The staging directory IS the sandbox: Typst is rooted at it, so `/payload.json` and `/base/frame.typ`
 * resolve inside it and an absolute path in a template can reach nothing else on the volume. Every
 * file is copied in rather than read in place, which is what lets the root be this narrow.
 *
 * The caller removes the directory — `renderDocument` does it in a `finally`, so a compile that threw
 * leaves nothing behind.
 */
export async function stageRender(request: StageRequest): Promise<StagedRender> {
  const dir = await mkdtemp(join(tmpdir(), "cubit-document-"));
  const main = join(dir, "main.typ");
  const base = join(dir, "base");
  await cp(documentBasePath(), base, { recursive: true });
  // The mark is staged UNDER the frame that draws it, at the one name every template knows it by.
  // It is copied from `src/ui/brand` rather than kept beside the frame, so this product's mark has
  // one drawing and the templates have one name for it (B-17).
  await cp(documentMarkFile(), join(base, "mark.svg"));
  await cp(request.template, main);
  await writeFile(join(dir, "payload.json"), request.payload);
  return { dir, main, out: join(dir, "out.pdf") };
}

/**
 * Runs the pinned renderer over a staged document and answers the PDF it wrote.
 *
 * This is the one `typst` subprocess in the tree. `opts.binary` exists for the lane that proves the
 * pin is honoured, not for a caller that wants a different renderer; production passes nothing and
 * gets the pinned command from the path `pnpm checkup` verifies.
 *
 * A failure here is an OUTAGE and is raised as one — the renderer's own account travels in the
 * error's message so it lands in the fault record, and `renderDocument` is what turns it into the
 * registered refusal a person reads (ARCH-03, B-21).
 */
export async function compileTypst(staged: StagedRender, opts?: { binary?: string }): Promise<Uint8Array> {
  const args = argvFor(staged);

  await new Promise<void>((settle, fail) => {
    execFile(
      opts?.binary ?? "typst",
      args,
      {
        cwd: staged.dir,
        // A clock in the environment is a clock in the document: the renderer is given one zone and
        // one only, so the same payload renders the same bytes wherever it is asked for.
        env: { ...process.env, TZ: "UTC" },
        timeout: COMPILE_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        encoding: "utf8",
      },
      (failure, _stdout, stderr) => {
        if (failure === null) {
          settle();
          return;
        }
        fail(new Error(`the pinned renderer did not produce a document: ${failure.message}\n${String(stderr).slice(-STDERR_TAIL_CHARS)}`, { cause: failure }));
      },
    );
  });

  // The exit status is not the artefact: a run that exits 0 having written nothing has rendered
  // nothing, and that is an outage like any other (the judgement L-CAD-04 records for the other
  // subprocess this product spawns).
  const pdf = await readFile(staged.out);
  if (pdf.byteLength === 0) throw new Error("the pinned renderer exited cleanly and wrote an empty document");
  return new Uint8Array(pdf);
}

/** Takes a staging directory away. Safe to call on a directory a failed stage never finished. */
export async function discardRender(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
