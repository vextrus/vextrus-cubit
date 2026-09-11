// @vitest-environment node
/**
 * The split proof for the refusal taxonomy (AM-11, R-SPINE-062, B-19).
 *
 * AM-11 moves the registered codes out of one 800-line file and into one file per area, with
 * `src/core/errors.ts` left as the register that ENUMERATES those files and merges them. The whole
 * claim of that move is that the aggregate did not change: the same codes, under the same keys, with
 * the same copy, severity and surface — byte for byte the set the tree held before a line was moved.
 * This file is that claim, written down.
 *
 * CODES_BEFORE is the roster as it stood before the split, frozen here on purpose: it is a BASELINE,
 * not a derivation, because a derivation cannot catch a code the split dropped. A later increment
 * that registers a code re-baselines this list and the digest below in its own commit, and says so —
 * which is exactly the event this file exists to make loud (B-19, B-20).
 *
 * The copy is held to by DIGEST rather than by transcription: the sha-256 over every entry's code,
 * message, remedy, severity and surface in code-point order of the key. A moved entry whose sentence
 * was reflowed, retyped or summarised on the way changes it, and a split that changed nothing does
 * not. The areas are not listed here either — they are read off the directory, so an area file the
 * register forgot to enumerate shows up as a code the union holds and the register does not.
 *
 * Every module is loaded by absolute path rather than by a static specifier — the contract
 * `src/core/errors/taxonomy.test.ts` uses: a module the product does not provide yet must fail as an
 * assertion naming the file, never as an unreadable resolution error.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The register: the one path every importer in the tree names. */
const REGISTER = "src/core/errors.ts";

/** Where the areas keep their own groups. */
const AREA_DIR = "src/core/errors";

/** One registered refusal, as this file reads one — the five fields R-SPINE-062 fixes. */
interface Entry {
  code: string;
  message: string;
  remedy: string;
  severity: string;
  surface: string;
}

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * Every code the taxonomy held before AM-11 moved a line, in code-point order. A baseline,
 * deliberately transcribed: the split must not change it, and an increment that registers a code
 * re-baselines it.
 */
const CODES_BEFORE: readonly string[] = Object.freeze([
  "ACCOUNT_ALREADY_EXISTS",
  "ACTOR_NOT_HUMAN",
  "ACT_CHANGES_NOTHING",
  "CAMPAIGN_NOT_FOUND",
  "CAPTION_UNCLASSIFIABLE",
  "CELL_NOT_IN_RESIDUE",
  "CHARACTER_NOT_COVERED",
  "CONSEQUENCES_NOT_CARRIED",
  "CONVENTION_ROLE_UNRESOLVED",
  "CREDENTIALS_NOT_VALID",
  "DIGEST_MISMATCH",
  "DIMENSION_MISMATCH",
  "DOWNLOAD_NOT_SIGNABLE",
  "DUPLICATE_IDENTITY",
  "FILE_TOO_LARGE",
  "FIXTURE_MISSING",
  "FORMAT_NOT_ACCEPTED",
  "GRID_NO_BUBBLE_EVIDENCE",
  "GROUP_NOT_OFFERED",
  "INGESTION_TRUNCATED",
  "INTERPRETED_UNCORROBORATED",
  "INVITATION_NOT_CLAIMABLE",
  "KIND_NOT_YET_SEEDED",
  "LEVEL_ORDINAL_UNMAPPED",
  "LEVEL_RANGE_ENDPOINT_UNMAPPED",
  "LINK_NOT_SENDABLE",
  "MALFORMED",
  "MANIFEST_NOT_RENDERABLE",
  "MEMBER_HAS_ACTS",
  "MEMBER_TYPE_UNKNOWN",
  "METHOD_IMPLEMENTATION_MISSING",
  "METHOD_NOT_IN_EDITION",
  "NOT_ESTABLISHED",
  "NOT_IN_PROJECT_SCOPE",
  "NOT_IN_THIS_BILL",
  "NO_BEARER_SIGHTED",
  "OFFER_NOT_TO_CONTRACT",
  "ORIGIN_NOT_VERIFIED",
  "PARTITION_NOT_AVAILABLE",
  "PERMISSION_NOT_HELD",
  "PIN_STALE",
  "PRECISION_NOT_APPLIED",
  "PRODUCT_FACTOR_MISSING",
  "PROJECT_WOULD_HAVE_NO_PRINCIPAL",
  "RASTER_NOT_AVAILABLE",
  "RATE_LIMITED",
  "READING_NOT_NUMERIC",
  "REQUEST_MALFORMED",
  "SCALE_NO_EVIDENCE",
  "SCALE_OBSERVATION_OBLIQUE",
  "SCALE_OBSERVATION_UNCITED",
  "SCALE_OBSERVATION_UNVERIFIED",
  "SCALE_UNIT_UNMAPPED",
  "SCAN_REJECTED",
  "SCHEDULE_NONE_RECONSTRUCTED",
  "SCHEDULE_VIEW_CONTRIBUTED_NOTHING",
  "SECTION_BAND_UNCOVERED",
  "SECTION_UNIT_UNSTATED",
  "SELF_REMOVAL_NOT_ALLOWED",
  "SET_MEMBER_NOT_IN_PROJECT",
  "SET_NAME_NOT_USABLE",
  "SET_NOT_PINNABLE",
  "SHEET_NOT_INGESTABLE",
  "SIGNED_OUT",
  "SOURCE_UNRESOLVED",
  "STOREY_HEIGHT_CONTESTED",
  "STOREY_HEIGHT_UNSTATED",
  "TOKEN_NOT_VALID",
  "TYPICAL_RANGE_UNSTATED",
  "UNIT_UNMAPPED",
  "UNSOURCED",
  "UPLOAD_NOT_RESUMABLE",
  "VIEW_SCALE_UNAFFIRMED",
  "WORKSPACE_PERMISSION_NOT_HELD",
  "WORKSPACE_WOULD_HAVE_NO_OWNER",
]);

/**
 * The sha-256 over every entry's own five fields, in code-point order of the key — the copy half of
 * the same baseline. Re-baselined with CODES_BEFORE, and never on its own.
 *
 * Re-baselined once since the split, for ONE ADDED entry and nothing else: `REQUEST_MALFORMED`
 * (./server.ts), the code `src/server/call.ts` answers a statement no door could read with. The
 * roster above grew by that one key — 74 codes to 75 — and not one existing entry's code, message,
 * remedy, severity or surface moved with it.
 *
 * `MALFORMED` in particular did not. It was briefly generalised to cover the transports' doors as
 * well as the model's, which is precisely what R-SPINE-062's one-code-one-meaning rule forbids: a
 * message vague enough for both tells neither caller what happened. It keeps L-AI-01's fixed copy
 * byte for byte — it is the MODEL transport's code and says what a proposal is not — and the
 * transports register their own beside it. So the digest's previous value is the split's own,
 * dc764ce9b86989de722c1bcc304aab1f0a2e8204ef92dc00071bb0a1cd683628, and the value below differs
 * from it by the one added entry.
 */
const ENTRIES_DIGEST_BEFORE = "63fd5a229882783d7cf3cae49a3feaef136fa14ae194e4673dae6bab2e31f32f";

/** The canonical text a digest is taken over: nothing about layout, only what each entry says. */
function canonical(entries: Readonly<Record<string, Entry>>): string {
  return JSON.stringify(
    Object.keys(entries)
      .sort(byCodePoint)
      .map((code) => {
        const entry = entries[code] as Entry;
        return [code, entry.code, entry.message, entry.remedy, entry.severity, entry.surface];
      }),
  );
}

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the split does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Record<string, unknown>;
}

/** Every area file of the directory, read off the disk rather than listed (B-19). */
function areaFiles(): string[] {
  const abs = join(REPO_ROOT, AREA_DIR);
  expect(existsSync(abs), `${AREA_DIR} is missing — AM-11 puts each area's codes in its own file there`).toBe(true);
  return readdirSync(abs)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "law.ts")
    .sort(byCodePoint)
    .map((name) => `${AREA_DIR}/${name}`);
}

/** The groups the areas publish: one `*_REFUSALS` per file that has one. */
async function areaGroups(): Promise<{ file: string; group: Readonly<Record<string, Entry>> }[]> {
  const found: { file: string; group: Readonly<Record<string, Entry>> }[] = [];
  for (const file of areaFiles()) {
    const mod = await moduleAt(file);
    for (const name of Object.keys(mod).sort(byCodePoint)) {
      if (!name.endsWith("_REFUSALS")) continue;
      found.push({ file, group: mod[name] as Readonly<Record<string, Entry>> });
    }
  }
  return found;
}

describe("AM-11: the register is the areas, enumerated — and the aggregate did not move", () => {
  test("the register holds exactly the codes it held before the split", async () => {
    const mod = await moduleAt(REGISTER);
    const refusals = mod["REFUSALS"] as Readonly<Record<string, Entry>>;
    expect(
      Object.keys(refusals).sort(byCodePoint),
      "a code was dropped or minted by the split — the taxonomy is closed, and this move was to change nothing (R-SPINE-062, AM-11)",
    ).toEqual([...CODES_BEFORE]);
  });

  test("every entry says exactly what it said before the split", async () => {
    const mod = await moduleAt(REGISTER);
    const refusals = mod["REFUSALS"] as Readonly<Record<string, Entry>>;
    const digest = createHash("sha256").update(canonical(refusals)).digest("hex");
    expect(
      digest,
      "an entry's code, message, remedy, severity or surface changed on its way into an area file — the copy is fixed by docs/design/refusal-state.md § 3 and a move does not edit it",
    ).toBe(ENTRIES_DIGEST_BEFORE);
  });

  test("the areas partition the taxonomy: no code twice, and none the register does not hold", async () => {
    const groups = await areaGroups();
    expect(groups.length, `${AREA_DIR} publishes no area group — the split owes one \`*_REFUSALS\` per area`).toBeGreaterThan(0);
    const claimedBy = new Map<string, string>();
    const twice: string[] = [];
    for (const { file, group } of groups) {
      for (const code of Object.keys(group)) {
        const held = claimedBy.get(code);
        if (held !== undefined) twice.push(`${code}: ${held} and ${file}`);
        else claimedBy.set(code, file);
      }
    }
    expect(twice, "two areas register one code — a code has one home, and the merge would silently pick a winner (ARCH-02, B-17)").toEqual([]);
    expect(
      [...claimedBy.keys()].sort(byCodePoint),
      "the areas together register a different set than the taxonomy held — an area file the register forgot to enumerate reads exactly like this (B-19)",
    ).toEqual([...CODES_BEFORE]);
  });

  test("the register merges the areas' own entries rather than re-spelling them", async () => {
    const mod = await moduleAt(REGISTER);
    const refusals = mod["REFUSALS"] as Readonly<Record<string, Entry>>;
    const copies: string[] = [];
    for (const { file, group } of await areaGroups()) {
      for (const [code, entry] of Object.entries(group)) {
        if (refusals[code] !== entry) copies.push(`${code} (${file})`);
      }
    }
    expect(copies, "the register hands out an entry that is not the very object its area registered — a second copy is a second home (ARCH-02, B-17)").toEqual([]);
  });
});
