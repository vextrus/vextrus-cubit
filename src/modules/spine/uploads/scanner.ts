// R-SPINE-020's virus-scan hook point. The product ships the hook, its default and its verdicts —
// an actual antivirus is an installation's to wire, and the seam is what it wires into.
//
// The default answers `skipped`, and the verdict is recorded on the stored file: an installation
// with no scanner has not judged its uploads, and a file nobody scanned must never be read back as
// one somebody passed clean (Q-12).
//
// The hook is anchored to the process for the reason the fault sink states (ARCH-02): a bundler that
// compiled this file into two graphs would otherwise leave half the uploads reaching a scanner the
// host swapped out — silence by packaging accident.
import type { ScanVerdict } from "../../../core/uploads";

/** What an installation wires in: bytes and the name they arrived under, judged (R-SPINE-020). */
export interface UploadScanner {
  scan(bytes: Uint8Array, name: string): Promise<{ verdict: ScanVerdict; detail?: string }>;
}

/** The answer a scan gives. `detail` is the scanner's own operator-facing note, never user copy. */
export type ScanAnswer = { verdict: ScanVerdict; detail?: string };

/** The default: nothing was scanned, and the record says so rather than saying "clean". */
const unscanned: UploadScanner = {
  scan: async () => ({ verdict: "skipped" }),
};

const SCANNER_KEY = Symbol.for("vextrus.cubit.modules.spine.uploads.scanner");

const processScope = globalThis as typeof globalThis & { [SCANNER_KEY]?: { current: UploadScanner } };

const held: { current: UploadScanner } = (processScope[SCANNER_KEY] ??= { current: unscanned });

/** Wire a scanner in, or hand the hook back its default with `null` (test contract). */
export function setUploadScanner(scanner: UploadScanner | null): void {
  held.current = scanner ?? unscanned;
}

/** Judge these bytes with whatever scanner the installation wired in. */
export async function scanUpload(bytes: Uint8Array, name: string): Promise<ScanAnswer> {
  return held.current.scan(bytes, name);
}
