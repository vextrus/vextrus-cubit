// C-06 + AM-08: Typst is "pinned by version + sha256 … in package.json's C-06 toolchain block and
// refused by pnpm checkup on drift". Until this test existed the sha256 lived in prose only:
// `package.json` held `"typst": "0.15.1"`, `checkup` ran `pinnedTool("typst", ["--version"])`, and
// NOTHING in either repository compared a digest to anything. A rebuilt binary reporting the same
// version passed the gate — which is precisely the failure R-SPINE-040 cannot survive, because
// byte-identical document output is a promise about a renderer build, not about a version string.
//
// So this test holds three things to each other: the pin in package.json, the digest recorded with
// the install recipe in docs/toolchain/typst.md, and checkup's refusal on drift. It reads no
// machine: the verdict function is pure, so the law is provable on any host.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fileDigest, toolPin, toolVerdict } from "../../scripts/lib/tools.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const read = (relative: string): string => readFileSync(resolve(REPO_ROOT, relative), "utf8");
const manifest = JSON.parse(read("package.json")) as unknown;

interface ToolPin {
  readonly version: string;
  readonly sha256: string | null;
}

const typst = toolPin(manifest, "typst") as ToolPin;

describe("C-06/AM-08: the Typst pin is a version AND a digest, and checkup refuses drift in either", () => {
  it("package.json carries the sha256 beside the version", () => {
    expect(typst.version, "the version the binary is asked for").toBe("0.15.1");
    expect(typst.sha256, "the sha256 of the bytes that version must BE — the half of the pin nothing compared before").toMatch(/^[0-9a-f]{64}$/);
  });

  it("the digest in package.json is the binary digest docs/toolchain/typst.md's recipe installs", () => {
    const doc = read("docs/toolchain/typst.md");
    const recorded = /\|\s*binary sha256\s*\|\s*`([0-9a-f]{64})`\s*\|/.exec(doc);
    expect(recorded, "docs/toolchain/typst.md records the binary sha256 in its pin table").not.toBeNull();
    expect(typst.sha256, "one digest, two homes — the pin and the recipe cannot disagree (ARCH-02)").toBe((recorded as RegExpExecArray)[1]);
    expect(doc, "the recipe checks that digest before anything is put on PATH").toContain(`BINARY_SHA256=${typst.sha256}`);
  });

  it("a matching version and a matching digest pass", () => {
    const verdict = toolVerdict({ tool: "typst", pin: typst, version: "0.15.1", path: "/usr/local/bin/typst", digest: typst.sha256 }) as { ok: boolean; detail: string };
    expect(verdict.ok).toBe(true);
    expect(verdict.detail).toContain("/usr/local/bin/typst");
  });

  it("the right version with the WRONG BYTES is refused, and the refusal says DRIFT", () => {
    const other = "61f743dccaaf7d763072ae046ad71f2303752e78d499d319043248f894602f45"; // the superseded 0.13.1 binary
    const verdict = toolVerdict({ tool: "typst", pin: typst, version: "0.15.1", path: "/usr/local/bin/typst", digest: other }) as { ok: boolean; detail: string };
    expect(verdict.ok, "a version string is what a different build keeps; the digest is what it cannot").toBe(false);
    expect(verdict.detail).toContain("DRIFT");
  });

  it("a tool that is not on PATH, or whose bytes cannot be read, is refused rather than skipped", () => {
    const absent = toolVerdict({ tool: "typst", pin: typst, version: null, path: null, digest: null }) as { ok: boolean; detail: string };
    expect(absent.ok).toBe(false);
    expect(absent.detail).toContain("not on PATH");
    expect(fileDigest(resolve(REPO_ROOT, "no-such-binary")), "an unreadable file yields null, never a thrown checkup").toBeNull();
  });

  it("a bare version pin (uv) still passes on version alone — the digest half is opt-in per tool", () => {
    const uv = toolPin(manifest, "uv") as ToolPin;
    expect(uv.sha256, "nothing downstream depends on uv's bytes, so C-06 pins its version only").toBeNull();
    expect((toolVerdict({ tool: "uv", pin: uv, version: uv.version }) as { ok: boolean }).ok).toBe(true);
    expect((toolVerdict({ tool: "uv", pin: uv, version: "0.0.1" }) as { ok: boolean }).ok).toBe(false);
  });

  it("checkup is what compares them — the pin is not enforced by this test alone", () => {
    const checkup = read("scripts/checkup.mjs");
    expect(checkup, "checkup imports the digest comparison").toMatch(/from "\.\/lib\/tools\.mjs"/);
    expect(checkup, "checkup resolves the binary on PATH and digests it").toContain("fileDigest(path)");
    expect(read("scripts/lib/tools.mjs"), "the comparison is the whole point of the module").toContain("digest === pin.sha256");
  });
});
