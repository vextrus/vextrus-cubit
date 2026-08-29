// Live acceptance for AC-2 of inc-014-density-prefs: SEAM-PREFS' two functions, observed through
// the `src/core/prefs` barrel and nowhere else (R-UI-005), against a self-provisioned, migrated
// scratch database — the same harness every other live suite runs on.
//
// The barrel is loaded by absolute path rather than by a literal specifier, exactly as the act-seam
// suites load theirs, so a module the Builder has not written yet fails as an assertion naming the
// file instead of killing collection at transform time.
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file too. The
// store is read back only to answer "how many rows does this account own?" — the answers themselves
// come from the seam, because the seam is what every consumer will call.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb } from "./harness";
import {
  COMFORTABLE,
  COMPACT,
  DEFAULT_DENSITY,
  DENSITY_COLUMN,
  DENSITY_MODES,
  PREFS_MODULE,
  PREFS_TABLE,
  USER_ID_COLUMN,
  address,
  bootstrapUrlFor,
  seedUser,
} from "./density-prefs-fixtures";
import { ident, lit, run, scalar } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/* ------------------------------------------------------------------ *
 * The seam, as its callers see it.
 * ------------------------------------------------------------------ */

interface PrefsSeam {
  DENSITIES?: readonly string[];
  densityFor?: (userId: string) => Promise<string>;
  setDensity?: (userId: string, density: string) => Promise<void>;
}

async function loadPrefsSeam(databaseUrl: string): Promise<PrefsSeam> {
  // The seam reaches the database when it is first loaded, so the scratch deployment is named first.
  process.env["DATABASE_URL"] = databaseUrl;
  const abs = join(REPO_ROOT, PREFS_MODULE);
  expect(
    existsSync(abs) && statSync(abs).isFile(),
    `${PREFS_MODULE} is missing from the checkout — SEAM-PREFS names it the sole entry point of the per-user preference seam`,
  ).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as PrefsSeam;
}

function densityFor(seam: PrefsSeam): NonNullable<PrefsSeam["densityFor"]> {
  const fn = seam.densityFor;
  if (typeof fn !== "function") throw new Error(`${PREFS_MODULE} exports no densityFor(userId) — it is the seam's read (interfaces line)`);
  return fn;
}

function setDensity(seam: PrefsSeam): NonNullable<PrefsSeam["setDensity"]> {
  const fn = seam.setDensity;
  if (typeof fn !== "function") throw new Error(`${PREFS_MODULE} exports no setDensity(userId, density) — it is the seam's write (interfaces line)`);
  return fn;
}

/* ------------------------------------------------------------------ *
 * Staging: one scratch database; every case mints its own account.
 * ------------------------------------------------------------------ */

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };
let scratch: Scratch | undefined;

afterAll(async () => {
  // Let the seam's pooled connections settle before the database goes away: a drop that races an
  // open connection surfaces as an unhandled CONNECTION_CLOSED the runner counts as an error.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await scratch?.drop();
});

type Stage = { bootstrapUrl: string; seam: PrefsSeam };

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    return { bootstrapUrl: bootstrapUrlFor(provisioned.urlMigrate), seam: await loadPrefsSeam(provisioned.urlApp) };
  })());

/** An account of this suite's own, so no case can pass or fail on another's rows. */
async function account(label: string): Promise<{ userId: string; bootstrapUrl: string; seam: PrefsSeam }> {
  const { bootstrapUrl, seam } = await staged();
  return { userId: seedUser(bootstrapUrl, address(label)), bootstrapUrl, seam };
}

/** The rows the store really holds for one account, counted where no policy can hide one. */
function storedRows(bootstrapUrl: string, userId: string): string[] {
  return run(
    bootstrapUrl,
    `select ${ident(DENSITY_COLUMN)} from public.${ident(PREFS_TABLE)} where ${ident(USER_ID_COLUMN)} = ${lit(userId)};`,
  ).map((row) => row[0] ?? "");
}

/* ------------------------------------------------------------------ *
 * AC-2 — the seam's answers.
 * ------------------------------------------------------------------ */

describe("AC-2: SEAM-PREFS answers a density for every account and stores the one it is given", () => {
  it("AC-2: an account with no stored row reads as comfortable", async () => {
    const { userId, bootstrapUrl, seam } = await account("unset");
    expect(storedRows(bootstrapUrl, userId).length, "this case's account must start with no preference row").toBe(0);
    expect(
      await densityFor(seam)(userId),
      `densityFor must answer ${DEFAULT_DENSITY} for an account that never chose — R-UI-005's default is the seam's answer, never an absence a screen has to handle`,
    ).toBe(DEFAULT_DENSITY);
  });

  it("AC-2: a stored mode is what a fresh read answers", async () => {
    const { userId, seam } = await account("stored");
    await setDensity(seam)(userId, COMPACT);
    expect(await densityFor(seam)(userId), `after setDensity(${COMPACT}) the seam must answer ${COMPACT} — the preference is persisted, not held in the caller`).toBe(COMPACT);
  });

  it("AC-2: a second write overwrites in place — one account, one row", async () => {
    const { userId, bootstrapUrl, seam } = await account("upsert");
    await setDensity(seam)(userId, COMPACT);
    await setDensity(seam)(userId, COMFORTABLE);

    expect(await densityFor(seam)(userId), `the second setDensity must win — a preference is a value, not a history`).toBe(COMFORTABLE);
    expect(
      storedRows(bootstrapUrl, userId),
      `${PREFS_TABLE} must hold exactly one row for the account after two writes — setDensity upserts (interfaces: user_id is the primary key)`,
    ).toStrictEqual([COMFORTABLE]);
  });

  it("AC-2: every mode the seam publishes is a mode the seam can store and read back", async () => {
    const { userId, seam } = await account("roundtrip");
    const modes = seam.DENSITIES;
    expect(Array.isArray(modes), `${PREFS_MODULE} must export DENSITIES — the enumerable roster a consumer offers (interfaces line)`).toBe(true);
    for (const mode of modes as readonly string[]) {
      await setDensity(seam)(userId, mode);
      expect(await densityFor(seam)(userId), `DENSITIES publishes ${mode}, so the seam must be able to store it and answer it`).toBe(mode);
    }
  });

  it("AC-2: DENSITIES is exactly R-UI-005's two modes", async () => {
    const { seam } = await staged();
    expect(
      [...((seam.DENSITIES ?? []) as readonly string[])],
      `R-UI-005 gives density two modes and the test contract fixes their order — comfortable first, because it is the default a screen reads first`,
    ).toStrictEqual([...DENSITY_MODES]);
  });

  it("AC-2: the store's own column agrees with the seam — nothing is answered from a cache", async () => {
    const { userId, bootstrapUrl, seam } = await account("agree");
    await setDensity(seam)(userId, COMPACT);
    expect(
      scalar(bootstrapUrl, `select ${ident(DENSITY_COLUMN)} from public.${ident(PREFS_TABLE)} where ${ident(USER_ID_COLUMN)} = ${lit(userId)};`),
      `${PREFS_TABLE}.${DENSITY_COLUMN} must hold what the seam was told — the table is where the preference lives`,
    ).toBe(COMPACT);
  });
});
