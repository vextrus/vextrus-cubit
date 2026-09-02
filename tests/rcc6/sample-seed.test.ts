// @vitest-environment node
// AC-8 — the hand-written SAMPLE seed package (R-UI-033's fixture set, as data the SAMPLE offer's
// seam will consume once the drawings tables exist). Everything here is read as data: the manifest,
// the files it names, and their bytes hashed with node:crypto. No product source is read.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The checkout root — this file sits at tests/rcc6/. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const MANIFEST_REL = "scripts-data/sample-seed/manifest.json";
const GENERATOR_REL = "fixtures/gen/rcc6.py";

/** The closed format vocabulary the contract states for `files[].format`. */
const FORMATS = ["DXF", "DWG", "VECTOR_PDF", "RASTER_PDF", "RASTER_PNG", "GOLDEN", "INPUTS", "SANITY", "MANIFEST"] as const;
/** The formats AC-8 requires the package to include. */
const REQUIRED_FORMATS = ["DXF", "DWG", "VECTOR_PDF", "RASTER_PDF", "GOLDEN"] as const;

interface SeedFile {
  readonly path: string;
  readonly format: string;
  readonly sha256: string;
}

interface SeedManifest {
  readonly label: string;
  readonly fixture: string;
  readonly project: { readonly name: string; readonly code: string; readonly buildingType: string; readonly storeys: number };
  readonly generator: { readonly path: string; readonly sha256: string };
  readonly files: readonly SeedFile[];
}

function sha256Of(absolute: string): string {
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

function manifest(): SeedManifest {
  const abs = join(REPO_ROOT, MANIFEST_REL);
  expect(existsSync(abs), `${MANIFEST_REL} is missing — the SAMPLE seed package does not exist yet`).toBe(true);
  const parsed = JSON.parse(readFileSync(abs, "utf8")) as SeedManifest;
  expect(Array.isArray(parsed.files), `${MANIFEST_REL} has no files[] array`).toBe(true);
  return parsed;
}

describe("AC-8: the SAMPLE seed package", () => {
  it("AC-8: labels itself SAMPLE over the F-RCC6 fixture with a six-storey residential project", () => {
    const seed = manifest();
    expect(seed.label).toBe("SAMPLE");
    expect(seed.fixture).toBe("F-RCC6");
    expect(seed.project.name, "project.name must carry the SAMPLE label").toContain("SAMPLE");
    expect(typeof seed.project.code, "project.code").toBe("string");
    expect(seed.project.code.length, "project.code is blank").toBeGreaterThan(0);
    expect(seed.project.buildingType).toBe("residential");
    expect(seed.project.storeys).toBe(6);
  });

  it("AC-8: names the committed generator by path and by its sha256", () => {
    const seed = manifest();
    expect(seed.generator.path).toBe(GENERATOR_REL);
    const generator = join(REPO_ROOT, GENERATOR_REL);
    expect(existsSync(generator), `${GENERATOR_REL} is missing — the generator does not exist yet`).toBe(true);
    expect(seed.generator.sha256, "generator.sha256 is not the committed generator's sha256").toBe(sha256Of(generator));
  });

  it("AC-8: every listed file exists at its repo-relative path with a matching sha256 and a known format", () => {
    const seed = manifest();
    expect(seed.files.length, "files[] is empty").toBeGreaterThan(0);
    const offences: string[] = [];
    const seen = new Set<string>();
    for (const file of seed.files) {
      if (seen.has(file.path)) offences.push(`${file.path}: listed twice`);
      seen.add(file.path);
      if (!(FORMATS as readonly string[]).includes(file.format)) offences.push(`${file.path}: format ${file.format} is not in the contract's vocabulary`);
      const abs = join(REPO_ROOT, file.path);
      if (!existsSync(abs)) {
        offences.push(`${file.path}: no such committed file`);
        continue;
      }
      if (!/^[0-9a-f]{64}$/.test(file.sha256)) {
        offences.push(`${file.path}: sha256 ${file.sha256} is not 64 hex digits`);
        continue;
      }
      if (sha256Of(abs) !== file.sha256) offences.push(`${file.path}: sha256 does not match the committed bytes`);
    }
    expect(offences, offences.join("\n")).toEqual([]);
  });

  it("AC-8: the package covers the DXF, DWG, vector PDF, raster PDF and golden formats", () => {
    const seed = manifest();
    const present = new Set(seed.files.map((file) => file.format));
    const missing = REQUIRED_FORMATS.filter((format) => !present.has(format));
    expect(missing, `formats the package lacks: ${missing.join(", ")}`).toEqual([]);
  });
});
