// A lawful re-take (scripts/e2e-retake.mjs; B-20, AM-09 §4). What is worth proving: the mapping from a
// failed comparison's capture to the baseline it belongs to follows capture-geometry.ts's template,
// a capture with no expected picture beside it is not a moved picture, the dry run copies nothing,
// `--write` copies exactly the moved captures over their baselines, and the bands name where a diff
// picture differs. Driven over a temporary tree with PNGs the probe's own encoder writes.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { baselineFor, movedPictures, retake } from "../../scripts/e2e-retake.mjs";
import { encodeRgb } from "../../scripts/probe/lib/png.mjs";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A flat picture, w×h, of one colour. */
function picture(w: number, h: number, rgb: [number, number, number]): Buffer {
  const data = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 3] = rgb[0];
    data[i * 3 + 1] = rgb[1];
    data[i * 3 + 2] = rgb[2];
  }
  return encodeRgb(w, h, data);
}

/** A diff picture: grey, with a red band of rows `y0..y1` across `x0..x1`. */
function diffPicture(w: number, h: number, band: { y0: number; y1: number; x0: number; x1: number }): Buffer {
  const data = Buffer.alloc(w * h * 3, 40);
  for (let y = band.y0; y <= band.y1; y += 1) {
    for (let x = band.x0; x <= band.x1; x += 1) {
      const o = (y * w + x) * 3;
      data[o] = 255;
      data[o + 1] = 0;
      data[o + 2] = 0;
    }
  }
  return encodeRgb(w, h, data);
}

function stage(): string {
  const root = mkdtempSync(join(tmpdir(), "e2e-retake-"));
  roots.push(root);
  const results = join(root, "test-results", "audit-J-003-the-project-dark", "s-audit");
  mkdirSync(results, { recursive: true });
  writeFileSync(join(results, "explorer-expected.png"), picture(8, 8, [0, 0, 0]));
  writeFileSync(join(results, "explorer-actual.png"), picture(8, 8, [9, 9, 9]));
  writeFileSync(join(results, "explorer-diff.png"), diffPicture(8, 8, { y0: 1, y1: 2, x0: 3, x1: 6 }));
  // A capture with no expected picture beside it: a checkpoint's attachment, not a failed comparison.
  const attachments = join(root, "test-results", "journeys-j-000-m0-smoke-dark");
  mkdirSync(attachments, { recursive: true });
  writeFileSync(join(attachments, "smoke-actual.png"), picture(4, 4, [1, 1, 1]));
  // The baseline the moved picture belongs to.
  const baselines = join(root, "tests", "e2e", "baselines", "design-dark", "s-audit");
  mkdirSync(baselines, { recursive: true });
  writeFileSync(join(baselines, "explorer.png"), picture(8, 8, [0, 0, 0]));
  return root;
}

describe("the capture's baseline", () => {
  test("follows the snapshot path template: design-<project>/<sub>/<name>.png", () => {
    const exists = (path: string) => path.endsWith("-expected.png");
    expect(baselineFor("audit-J-003-dark/s-audit/explorer-actual.png", exists)?.baseline).toBe("tests/e2e/baselines/design-dark/s-audit/explorer.png");
    expect(baselineFor("shell-J-004-light/shell-user-menu-open-actual.png", exists)?.baseline).toBe("tests/e2e/baselines/design-light/shell-user-menu-open.png");
  });

  test("a capture with no expected picture beside it, or under no project's directory, is not a moved picture", () => {
    expect(baselineFor("journeys-j-000-m0-smoke-dark/smoke-actual.png", () => false)).toBeNull();
    expect(baselineFor("some-dir/explorer-actual.png", () => true)).toBeNull();
    expect(baselineFor("audit-J-003-dark/s-audit/explorer.png", () => true)).toBeNull();
  });
});

describe("the command", () => {
  test("the dry run names the moved picture and its bands, and copies nothing", () => {
    const root = stage();
    const lines: string[] = [];
    const count = retake({ root, out: (line) => lines.push(line.trimEnd()) });
    expect(count).toBe(1);
    expect(lines[0]).toBe("tests/e2e/baselines/design-dark/s-audit/explorer.png");
    expect(lines[1]).toBe("  y 1-2  x 3-6  px=8");
    expect(lines[lines.length - 1]).toMatch(/^e2e:retake — 1 moved picture\(s\); re-run with --write/);
    expect(readFileSync(join(root, "tests/e2e/baselines/design-dark/s-audit/explorer.png")).equals(picture(8, 8, [0, 0, 0])), "the baseline stands as it was").toBe(true);
    expect(movedPictures(root).map((moved) => moved.baseline)).toEqual(["tests/e2e/baselines/design-dark/s-audit/explorer.png"]);
  });

  test("--write copies the run's capture over its baseline, and only that", () => {
    const root = stage();
    const lines: string[] = [];
    retake({ root, write: true, out: (line) => lines.push(line.trimEnd()) });
    expect(readFileSync(join(root, "tests/e2e/baselines/design-dark/s-audit/explorer.png")).equals(picture(8, 8, [9, 9, 9])), "the baseline is the capture now").toBe(true);
    expect(existsSync(join(root, "tests/e2e/baselines/design-dark/smoke.png")), "an attachment is never minted as a baseline").toBe(false);
    expect(lines.some((line) => line === "  written from explorer-actual.png")).toBe(true);
    expect(lines[lines.length - 1]).toMatch(/^e2e:retake — 1 picture\(s\) written; commit them in a `baseline:` commit/);
  });

  test("a baseline directory that does not exist is refused: a picture is re-taken where it stood, never minted", () => {
    const root = stage();
    rmSync(join(root, "tests/e2e/baselines/design-dark/s-audit"), { recursive: true, force: true });
    const lines: string[] = [];
    retake({ root, write: true, out: (line) => lines.push(line.trimEnd()) });
    expect(lines.some((line) => line.startsWith("  REFUSED — tests/e2e/baselines/design-dark/s-audit does not exist"))).toBe(true);
    expect(existsSync(join(root, "tests/e2e/baselines/design-dark/s-audit/explorer.png"))).toBe(false);
  });

  test("with nothing moved it says so", () => {
    const root = mkdtempSync(join(tmpdir(), "e2e-retake-empty-"));
    roots.push(root);
    const lines: string[] = [];
    expect(retake({ root, out: (line) => lines.push(line.trimEnd()) })).toBe(0);
    expect(lines[0]).toMatch(/^e2e:retake — no moved picture under test-results/);
  });
});
