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
  "BLINDING_PLAN_DEFERRED",
  "BOQ_NO_CAMPAIGN",
  "BOQ_NO_PUBLISHED_LINE",
  "BOQ_TAXONOMY_VERSION_MOVED",
  "CAMPAIGN_NOT_FOUND",
  "CAPTION_UNCLASSIFIABLE",
  "CELL_NOT_IN_RESIDUE",
  "CHARACTER_NOT_COVERED",
  "CONSEQUENCES_NOT_CARRIED",
  "CONVENTION_ROLE_UNRESOLVED",
  "CREDENTIALS_NOT_VALID",
  "DETAILING_ROW_NOT_IN_EDITION",
  "DIGEST_MISMATCH",
  "DIMENSION_MISMATCH",
  "DOCUMENT_KIND_UNKNOWN",
  "DOCUMENT_NOT_FOUND",
  "DOCUMENT_NOT_RENDERED",
  "DOCUMENT_PAYLOAD_MALFORMED",
  "DOCUMENT_URL_EXPIRED",
  "DOCUMENT_URL_INVALID",
  "DOWNLOAD_NOT_SIGNABLE",
  "DUPLICATE_IDENTITY",
  "EARTHWORK_PARAMETER_UNSTATED",
  "EARTHWORK_PLAN_DEFERRED",
  // inc-304a re-baseline: `src/core/errors/rulesets.ts` registers the one code AM-04's authoring act
  // is refused by when the version it states is already held (L-MEA-01's edition identity).
  "EDITION_VERSION_TAKEN",
  "EXPORT_NOT_FOUND",
  "EXPORT_URL_EXPIRED",
  "EXPORT_URL_INVALID",
  "FILE_TOO_LARGE",
  "FINISH_GROSS_UNSTATED",
  "FINISH_SELECTOR_UNSTATED",
  "FIXTURE_MISSING",
  "FORMAT_NOT_ACCEPTED",
  "FORMULA_DIVISOR_ZERO",
  "FOUNDATION_DEPTH_UNSTATED",
  "FOUNDATION_PLAN_UNSTATED",
  "FOUNDING_LEVEL_UNSTATED",
  "GRID_NO_BUBBLE_EVIDENCE",
  "GROUND_LEVEL_UNSTATED",
  "GROUP_NOT_OFFERED",
  "INGESTION_TRUNCATED",
  "INTERPRETED_UNCORROBORATED",
  "INVITATION_NOT_CLAIMABLE",
  "KIND_NOT_YET_SEEDED",
  "LEVEL_ORDINAL_UNMAPPED",
  "LEVEL_RANGE_ENDPOINT_UNMAPPED",
  "LINK_NOT_SENDABLE",
  "LINTEL_SOURCE_ABSENT",
  "MALFORMED",
  "MANIFEST_NOT_RENDERABLE",
  "MEMBER_HAS_ACTS",
  "MEMBER_TYPE_UNKNOWN",
  "METHOD_IMPLEMENTATION_MISSING",
  "METHOD_NOT_IN_EDITION",
  "NOTATION_UNREAD",
  "NOTES_NONE_PROPOSED",
  "NOTE_READING_CONTESTED",
  "NOTE_SOURCE_NOT_ON_SHEET",
  "NOT_ESTABLISHED",
  "NOT_IN_PROJECT_SCOPE",
  "NOT_IN_THIS_BILL",
  "NO_BEARER_SIGHTED",
  "OFFER_NOT_TO_CONTRACT",
  "OPENING_FLOOR_UNJUDGEABLE",
  "OPENING_NOT_AREABLE",
  "OPENING_SCHEDULE_ABSENT",
  "ORIGIN_NOT_VERIFIED",
  "PARTITION_NOT_AVAILABLE",
  "PERMISSION_NOT_HELD",
  "PILE_DIAMETER_UNSTATED",
  "PILE_LENGTH_UNSTATED",
  "PIN_STALE",
  "PLACEMENT_UNHELD",
  "PRECISION_NOT_APPLIED",
  "PRODUCT_FACTOR_MISSING",
  "PROJECT_WOULD_HAVE_NO_PRINCIPAL",
  "RASTER_NOT_AVAILABLE",
  "RATE_LIMITED",
  "READING_NOT_NUMERIC",
  "REBAR_SCHEDULE_UNREAD",
  "REBAR_STOREY_RUN_UNSTATED",
  "REBAR_TIE_ZONE_UNSTATED",
  "REQUEST_MALFORMED",
  "RUN_UNREAD",
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
  "SITE_FACT_SOURCE_UNSTATED",
  "SITE_FACT_UNKNOWN",
  "SLAB_THICKNESS_UNSTATED",
  "SOURCE_UNRESOLVED",
  "STOREY_HEIGHT_CONTESTED",
  "STOREY_HEIGHT_UNCITED",
  "STOREY_HEIGHT_UNSTATED",
  "SURFACE_NOT_CLOSED",
  "TOKEN_NOT_VALID",
  "TYPICAL_RANGE_UNSTATED",
  "UNIT_UNMAPPED",
  "UNSOURCED",
  "UPLOAD_NOT_RESUMABLE",
  "VIEW_SCALE_UNAFFIRMED",
  "WALL_HEIGHT_UNSTATED",
  "WALL_LENGTH_UNSTATED",
  "WALL_THICKNESS_UNSTATED",
  "WORKSPACE_PERMISSION_NOT_HELD",
  "WORKSPACE_WOULD_HAVE_NO_OWNER",
]);

/**
 * The sha-256 over every entry's own five fields, in code-point order of the key — the copy half of
 * the same baseline. Re-baselined with CODES_BEFORE, and never on its own.
 *
 * Re-baselined for FOUR ADDED entries and nothing else, all of them the REBAR leaf's (./rebar.ts):
 * `DETAILING_ROW_NOT_IN_EDITION`, which a grade or a mix the applied detailing edition holds no
 * development-length row for is disclosed under rather than scaled off a neighbouring row
 * (AM-03(f)); `REBAR_SCHEDULE_UNREAD`, which a member whose bar schedule nobody has read stands
 * under rather than being billed at zero; `REBAR_TIE_ZONE_UNSTATED`, which a zone stating a spacing
 * and no length to run it over leaves the confinement steel omitted by name under; and
 * `REBAR_STOREY_RUN_UNSTATED`, which a vertical with no storey run leaves its bars undeclared under
 * (L-FRM-05, L-QTY-02). The roster grew by those four keys — 111 codes to 115 — and not one existing
 * entry's code, message, remedy, severity or surface moved with them; the previous digest was
 * f0994ec06d7e42442917eb1616dc4927f726c7f3458b39531cc6834f2ce6963a.
 *
 * Re-baselined before that for SIX ADDED entries and nothing else, all of them `./docs.ts`'s and all of them
 * about one document (R-SPINE-040): `DOCUMENT_KIND_UNKNOWN` and `DOCUMENT_PAYLOAD_MALFORMED`, which a
 * render refuses a kind nobody registered and a payload its schema will not read by;
 * `DOCUMENT_NOT_RENDERED`, which a renderer that fell over is answered with, carrying the id of the
 * fault it was recorded as (ARCH-03); and `DOCUMENT_NOT_FOUND`, `DOCUMENT_URL_INVALID` and
 * `DOCUMENT_URL_EXPIRED`, the three answers `GET /api/documents/[id]` gives a signed download link it
 * will not serve (R-SPINE-021, Q-12). The roster grew by those six keys — 105 codes to 111 — and not
 * one existing entry's code, message, remedy, severity or surface moved with them; the previous
 * digest was 32df92f233d23f6d676ee51d208364ba75c57da271b4854ee1170a61a0da791c.
 *
 * Re-baselined before that for TEN ADDED entries and nothing else, all of them the FOUNDATIONS leaf's
 * (./foundations.ts): the six readings a foundation rail reports rather than guess when the drawing
 * did not state them — `FOUNDATION_PLAN_UNSTATED`, `FOUNDATION_DEPTH_UNSTATED`,
 * `PILE_DIAMETER_UNSTATED`, `PILE_LENGTH_UNSTATED`, `FOUNDING_LEVEL_UNSTATED` and
 * `GROUND_LEVEL_UNSTATED` (L-FRM-04, L-QTY-02); the two deferrals a polygon plan leaves a
 * rectangular pit and its blinding under, `EARTHWORK_PLAN_DEFERRED` and `BLINDING_PLAN_DEFERRED`;
 * and the two a SITE-fact entry is refused by, `SITE_FACT_UNKNOWN` and `SITE_FACT_SOURCE_UNSTATED`
 * (L-MEA-06, AM-06 §1). The roster grew by those ten keys — 86 codes to 96 — and not one existing
 * entry's code, message, remedy, severity or surface moved with them; the previous digest was
 * 9b3547b60626ffa04e8cb3060c1bb88787578bda65dd9288db20cb4f0942e567.
 *
 * Re-baselined before that for THREE ADDED entries and nothing else: `RUN_UNREAD`, `SLAB_THICKNESS_UNSTATED` and
 * `LINTEL_SOURCE_ABSENT` (./frame.ts), the three readings the frame rails report rather than guess
 * when the drawing did not state them (L-MEA-09, L-QTY-02). The roster grew by those three keys — 83
 * codes to 86 — and not one existing entry's code, message, remedy, severity or surface moved with
 * them; the previous digest was
 * 2643de99a05bdaa3fe31d11862def6bcabbebd4fcb4dad079f2d510b20eebc8a.
 *
 * Re-baselined before that for THREE ADDED entries and nothing else, all of them `./takeoff-schedules.ts`'s and
 * all of them about a general note a person reads off a sheet (R-TO-034): `NOTE_READING_CONTESTED`,
 * which two readings of one note that disagree leave the kind standing under; `NOTE_SOURCE_NOT_ON_SHEET`,
 * which a reading citing text the sheet does not carry is refused by; and `NOTES_NONE_PROPOSED`,
 * which a sheet whose words state no figure says its silence under. The roster grew by those three
 * keys — 80 codes to 83 — and not one existing entry's code, message, remedy, severity or surface
 * moved with them; the previous digest was
 * 542ac68e04c93e60a7c2020d05c39a30d67b437be99d88f5d700bbc511221599.
 *
 * Re-baselined before that for THREE ADDED entries and nothing else: `EXPORT_NOT_FOUND`, `EXPORT_URL_EXPIRED`
 * and `EXPORT_URL_INVALID` (./exports.ts), the three answers `GET /api/exports/[id]` gives a signed
 * download link it will not serve — an address nothing is stored at, a link whose hour has passed,
 * and a link this workspace never issued (R-SPINE-041, R-SPINE-021, Q-12). The roster grew by those
 * three keys — 77 codes to 80 — and not one existing entry's code, message, remedy, severity or
 * surface moved with it; the previous digest was
 * 5dd4c6123c2799b2ce03adf26b6c7620e8976b0c69ce77be5ad3dc7be42eb46f.
 *
 * Re-baselined before that for ONE ADDED entry and nothing else: `FORMULA_DIVISOR_ZERO` (./gate.ts), the code
 * the gate answers an offer with whose formula the readings make a divisor of zero. It threw before,
 * and a throw inside `evaluateOffers` takes every other offer of that batch down with it; a
 * registered refusal is an answer the batch can carry (ARCH-03, L-QTY-02). The roster grew by that
 * one key — 76 codes to 77 — and not one existing entry's code, message, remedy, severity or
 * surface moved with it; the previous digest was
 * 34384c64873975d63d66571200e81882ed48188e035a4865482c2d5a69d4bf86.
 *
 * Re-baselined a second time for ONE ADDED entry and nothing else: `NOTATION_UNREAD`
 * (./takeoff-schedules.ts), the code R-TO-031's notation grammar answers a cell no form of it reads
 * with — naming the token, because a person shown the glyphs can add the form and a person shown
 * `null` cannot. The roster grew by that one key — 75 codes to 76 — and not one existing entry's
 * code, message, remedy, severity or surface moved with it; the previous digest was
 * 63fd5a229882783d7cf3cae49a3feaef136fa14ae194e4673dae6bab2e31f32f.
 *
 * Re-baselined once before that, for ONE ADDED entry and nothing else: `REQUEST_MALFORMED`
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
/*
 * Re-baselined for THREE ADDED entries and nothing else: `BOQ_NO_CAMPAIGN`,
 * `BOQ_NO_PUBLISHED_LINE` and `BOQ_TAXONOMY_VERSION_MOVED` (./boq.ts), the codes the draft BOQ's
 * export door and its render answer with — a project with no register to draft from, a campaign
 * that published no line, and a draft issued under a taxonomy that has since moved. The roster grew
 * by those three keys — 115 codes to 118 — and not one existing entry's code, message, remedy,
 * severity or surface moved with them; the previous digest was
 * 9bc34ffa33026d33a92931d1f913e7b7808ad05fcbd06a83048d8b9324ea1d7b.
 */
/*
 * Re-baselined for THREE ADDED entries and nothing else: `PLACEMENT_UNHELD` (./frame.ts), what a
 * register row whose setup holds no placement is refused by; `STOREY_HEIGHT_UNCITED`
 * (./takeoff-levels.ts), what an agreed storey height citing no source is refused by; and
 * `EARTHWORK_PARAMETER_UNSTATED` (./foundations.ts), what a working allowance, a depth extra, a
 * blinding projection or a blinding thickness neither the edition nor the site states is omitted
 * under. Each says what its own absence is, where the code standing in its place sent a reader to a
 * reading that was never missing (Q-07, L-QTY-02). The roster grew by those three keys — 118 codes
 * to 121 — and not one existing entry's code, message, remedy, severity or surface moved with them;
 * the previous digest was 8bb7fc6ed15553923a99ff0d2f7369558eb7292bcee4db3f0c3575ddcbaedb12.
 *
 * Re-baselined again for ONE added entry and nothing else: `EDITION_VERSION_TAKEN`
 * (./rulesets.ts), what authoring a rule-set edition under a version this project's rule set
 * already carries is refused by — L-MEA-01 makes identity (scope, name, version), so the version
 * stated has to be one the project has not used. The roster grew by that one key — 121 codes to 122
 * — and not one existing entry's code, message, remedy, severity or surface moved with it; the
 * previous digest was 9d774bd9957e6d3f38c50d1e032675a3eca5d5dd282f122a983b4ab286c0aac6.
 */
const ENTRIES_DIGEST_BEFORE = "b1ba966929afd25a96283f6e707a47c5129015ad3a05b0c6b6c339b4c27ceee8";

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
