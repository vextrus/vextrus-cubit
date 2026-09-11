// @vitest-environment node
// N4 gave `goldenRows()` a fixture id. The default must keep every reader of F-RCC6 byte-stable:
// PREMISES §C6 lists them, and each is checked here against the committed bytes themselves — the
// rail's loader, the path constant it exports, the SAMPLE seed's pins, and the cad path that reads
// the same corpus. A second fixture is only lawful if the first one did not move to make room.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_GOLDEN_FIXTURE, GOLDEN_FIXTURE, goldenDocument, goldenFixturePath, goldenRows } from "./support/golden-fixture";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BNBC = "rcc6-bnbc";

function bytes(relative: string): Buffer {
  return readFileSync(join(REPO_ROOT, relative));
}

describe("N4: the fixture id is an addition, not a move", () => {
  it("resolves the default to F-RCC6's committed path, exactly as the constant always spelled it", () => {
    expect(DEFAULT_GOLDEN_FIXTURE).toBe("rcc6");
    expect(goldenFixturePath()).toBe(GOLDEN_FIXTURE);
    expect(GOLDEN_FIXTURE).toBe(join("fixtures", "rcc6", "takeoff.golden.json"));
    expect(goldenFixturePath(BNBC)).toBe(join("fixtures", BNBC, "takeoff.golden.json"));
  });

  it("reads the same rows with no argument, with the default named, and from the file's own bytes", () => {
    const fromFile = JSON.parse(bytes(GOLDEN_FIXTURE).toString("utf8")) as { rows: unknown[] };
    expect(goldenRows()).toEqual(fromFile.rows);
    expect(goldenRows("rcc6")).toEqual(fromFile.rows);
    expect(goldenDocument().fixture).toBe("F-RCC6");
  });

  it("leaves F-RCC6's bytes where the SAMPLE seed pinned them (scripts-data/sample-seed/manifest.json)", () => {
    const seed = JSON.parse(bytes("scripts-data/sample-seed/manifest.json").toString("utf8")) as {
      generator: { path: string; sha256: string };
      files: { path: string; sha256: string }[];
    };
    const pins = [seed.generator, ...seed.files];
    const wrong = pins.filter((pin) => createHash("sha256").update(bytes(pin.path)).digest("hex") !== pin.sha256);
    expect(wrong.map((pin) => pin.path), "a pinned F-RCC6 file no longer hashes to its pin").toEqual([]);
    expect(pins.some((pin) => pin.path === GOLDEN_FIXTURE.split("\\").join("/")), "the golden is not pinned at all").toBe(true);
  });

  it("reads F-RCC6-BNBC as schema 2, with the kinds and the components schema 1 never carried", () => {
    const document = goldenDocument(BNBC);
    expect(document.fixture).toBe("F-RCC6-BNBC");
    expect(document.schema).toBe(2);
    const kinds = new Set(document.rows.map((row) => row.kind));
    for (const kind of ["RCC_CONCRETE", "FORMWORK", "REBAR", "PILE_LENGTH", "PILE_COUNT"]) {
      expect(kinds.has(kind), `schema 2 carries no ${kind} row`).toBe(true);
    }
    const rebar = document.rows.filter((row) => row.kind === "REBAR");
    expect(rebar.length, "schema 2 carries no REBAR rows").toBeGreaterThan(0);
    expect(rebar.every((row) => typeof row.component === "string" && typeof row.diameter_mm === "number"), "a REBAR row lacks its component or its diameter").toBe(true);
    expect(bytes(join("fixtures", BNBC, "bbs.golden.json")).length, "bbs.golden.json does not sit beside the schema-2 golden").toBeGreaterThan(0);
  });

  it("keeps the two fixtures apart: F-RCC6 stays schema 1, with no component or diameter on any row", () => {
    const document = goldenDocument();
    expect(document.schema, "F-RCC6 grew a schema field").toBeUndefined();
    expect(document.rows.every((row) => row.component === undefined && row.diameter_mm === undefined)).toBe(true);
  });
});
