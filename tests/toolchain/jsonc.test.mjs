// B-23-JSONC-STRING-SAFE — the lock on the cure for the readJson finding (tests/toolchain/support
// /tree.mjs). Every pin, script and compiler option this suite asserts is read through readJson,
// so a stripper that corrupts string contents would make the whole toolchain acceptance lie
// (B-23). Comments outside strings are stripped; a `//` or `/*` INSIDE a JSON string value — the
// `https://…` of a homepage or registry field, a glob, a Windows path — is content and survives.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readJson } from "./support/tree.mjs";

describe("B-23-JSONC-STRING-SAFE", () => {
  let dir = "";
  const at = (name, body) => {
    const path = join(dir, name);
    writeFileSync(path, body);
    return path;
  };

  beforeAll(() => {
    dir = mkdtempSync(join(process.env.TMPDIR?.trim() || tmpdir(), "toolchain-jsonc-"));
  });

  afterAll(() => dir && rmSync(dir, { recursive: true, force: true }));

  it("B-23-JSONC-STRING-SAFE: a comment sequence inside a string value is content, not a comment", () => {
    const value = {
      homepage: "https://example.invalid/cubit#readme",
      registry: "https://registry.npmjs.org/",
      glob: "src/**/*.ts /* not a comment */",
      trailing: "keep // this",
      escaped: 'a "quoted" // still content',
      windows: "C:\\\\tools\\\\node",
    };
    const parsed = readJson(at("strings.json", JSON.stringify(value, null, 2)));
    expect(parsed, "readJson altered a string value that merely contains a comment sequence").toEqual(value);
  });

  it("B-23-JSONC-STRING-SAFE: genuine line and block comments outside strings are still stripped", () => {
    const body = [
      "// a leading line comment",
      "{",
      '  /* a block comment */ "pin": "1.2.3", // trailing after a value',
      "  /* multi",
      "     line */",
      '  "url": "https://example.invalid/a" // and after a URL',
      "}",
      "// a trailing line comment",
    ].join("\n");
    expect(readJson(at("comments.json", body)), "readJson did not strip a genuine comment").toEqual({
      pin: "1.2.3",
      url: "https://example.invalid/a",
    });
  });

  it("B-23-JSONC-STRING-SAFE: the tree's own configs read back through readJson unchanged", () => {
    // The real payload: no config this suite reads may be corrupted on the way in.
    for (const [name, expected] of [
      ["package.json", (v) => typeof v.packageManager === "string"],
      ["tsconfig.json", (v) => typeof v.compilerOptions === "object" && v.compilerOptions !== null],
      ["scripts/pins.json", (v) => Object.values(v).every((s) => typeof s === "string")],
    ]) {
      const parsed = readJson(join(process.cwd(), name));
      expect(expected(parsed), `${name} did not survive readJson intact`).toBe(true);
    }
  });
});
