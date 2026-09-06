// The one home for the environment the product reads (ARCH-02, B-17).
//
// Every name a tier reads is declared here once, with the shape its value must take, the tiers that
// cannot start without it, and whether an installation outside dev owes it a value. Nothing else in
// the product spells `process.env`: a seam that needs the machine's answer asks `envValue`, and a
// boot root asks `validateEnv` for the whole declaration at once.
//
// Two properties this file is built around:
//
//   - `envValue` reads LIVE from its source on every call and holds no memo. The seams' own
//     defaults are unchanged, and a suite that repoints `DATABASE_URL`, `CUBIT_PUBLIC_ORIGIN` or
//     `CUBIT_CAD_COMMAND` between cases is answered with what it just set. "Read once at start" is
//     the boot roots' behaviour, not the accessor's.
//   - `validateEnv` answers a verdict and never throws, so the boot root that called it owns the
//     fault-seam crossing under its own route (ARCH-03). `envErrorOf` turns a failed verdict into
//     the error whose message names every offending variable literally, which is what an operator
//     reads off the fault record.
//
// The transport vocabulary (src/core/errors/transport-vocabulary.ts) lists the environment names a
// message may spell; it is a vocabulary, not a declaration. These seven are the subset the tiers
// actually read, and their shapes and tiers live only here.
import { z } from "zod";

/** The tiers that boot: the web tier's `register()` and the worker's `main()`. */
export type Tier = "web" | "worker";

/** Where a read comes from: the process's environment, or a record a caller states instead. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** A postgres connection URL, which is the only thing the database seam can dial. */
const postgresUrl = z.string().refine((value) => {
  const parsed = URL.parse(value);
  return parsed !== null && (parsed.protocol === "postgres:" || parsed.protocol === "postgresql:");
}, "must be a postgres:// or postgresql:// URL");

/** An absolute http(s) origin, which is what a mailed link is built on (R-SPINE-007). */
const absoluteHttpUrl = z.string().refine((value) => {
  const parsed = URL.parse(value);
  return parsed !== null && (parsed.protocol === "http:" || parsed.protocol === "https:");
}, "must be an absolute http:// or https:// URL");

/** A path or a secret: anything the machine states, as long as it states something. */
const statedText = z.string().min(1);

/** A TCP port, as the machine can only ever state it — a string coerced to the number it names. */
const portNumber = z.coerce.number().int().min(0).max(65_535);

/**
 * The declaration, with its literal types kept so the value types and the per-tier requirements
 * below are derived from it rather than restated (B-17). `ENV_DECLARATION` is the same list, read
 * through the published interface.
 */
const DECLARED = [
  { name: "DATABASE_URL", shape: postgresUrl, requiredBy: ["web", "worker"], requiredOutsideDev: true },
  { name: "STORAGE_ROOT", shape: statedText, requiredBy: [], requiredOutsideDev: true },
  { name: "CUBIT_PUBLIC_ORIGIN", shape: absoluteHttpUrl, requiredBy: [], requiredOutsideDev: true },
  { name: "WORKER_HEALTH_PORT", shape: portNumber, requiredBy: ["worker"], requiredOutsideDev: true },
  { name: "CUBIT_MODEL_FIXTURE_ROOT", shape: statedText, requiredBy: [], requiredOutsideDev: false },
  { name: "CUBIT_STORAGE_SIGNING_SECRET", shape: statedText, requiredBy: [], requiredOutsideDev: true },
  { name: "CUBIT_CAD_COMMAND", shape: statedText, requiredBy: [], requiredOutsideDev: false },
] as const satisfies readonly { name: string; shape: z.ZodType; requiredBy: readonly Tier[]; requiredOutsideDev: boolean }[];

/** Every environment name the product reads. */
export type EnvName = (typeof DECLARED)[number]["name"];

type Declared<N extends EnvName> = Extract<(typeof DECLARED)[number], { name: N }>;

/** What each name's value is once it has been parsed — the health port is a number, the rest text. */
export type EnvTypes = { [N in EnvName]: z.infer<Declared<N>["shape"]> };

/** The names the given tier is declared not to start without, at the type level. */
type RequiredFor<T extends Tier> = { [N in EnvName]: T extends Declared<N>["requiredBy"][number] ? N : never }[EnvName];

/** One declared name, as the boot roots and the acceptance read it. */
export interface EnvEntry {
  name: EnvName;
  shape: z.ZodType;
  requiredBy: readonly Tier[];
  requiredOutsideDev: boolean;
}

/** The roster: exactly the names the tiers read, frozen so no caller can extend the product's own. */
export const ENV_NAMES: readonly EnvName[] = Object.freeze(DECLARED.map((entry) => entry.name));

/** The declaration itself: one entry per name in `ENV_NAMES`. */
export const ENV_DECLARATION: readonly EnvEntry[] = Object.freeze(DECLARED.map((entry) => Object.freeze({ ...entry })));

/**
 * The parsed environment a tier booted on. Every name is optional here in general, and the names
 * that tier requires are present — `validateEnv` only answers `ok` once it has them.
 */
export type EnvValues<T extends Tier = Tier> = { readonly [N in EnvName]?: EnvTypes[N] } & { readonly [N in RequiredFor<T>]: EnvTypes[N] };

/**
 * What `validateEnv` answers. A verdict, never a throw: the caller owns what a failure means.
 *
 * `ok` says whether THIS tier may start, so a name it does not require is never what stops it. Such
 * a name is still reported — the `ok` arm carries the same `invalid` list — because a value the
 * machine got wrong is wrong for whoever reads it later, and the tier that saw it is the one that
 * can tell the operator (C-05, AS-01).
 */
export type EnvVerdict<T extends Tier = Tier> =
  | { ok: true; env: EnvValues<T>; invalid: readonly EnvName[] }
  | { ok: false; missing: readonly EnvName[]; invalid: readonly EnvName[] };

/** An environment verdict as an error whose message names every variable that failed. */
export class EnvError extends Error {
  readonly tier: Tier;
  readonly missing: readonly EnvName[];
  readonly invalid: readonly EnvName[];

  constructor(message: string, tier: Tier, missing: readonly EnvName[], invalid: readonly EnvName[]) {
    super(message);
    this.name = "EnvError";
    this.tier = tier;
    this.missing = missing;
    this.invalid = invalid;
  }
}

/**
 * The offenders, as one clause an operator can act on: which names were not set and which were
 * given something unusable. Each clause is present only when it has names, and every name is
 * spelled literally — a message that summarised would leave the operator guessing which variable to
 * go and set (B-21).
 */
function offendersOf(missing: readonly EnvName[], invalid: readonly EnvName[]): string {
  const clauses: string[] = [];
  if (missing.length > 0) clauses.push(`not set: ${missing.join(", ")}`);
  if (invalid.length > 0) clauses.push(`malformed: ${invalid.join(", ")}`);
  return clauses.join("; ");
}

/** The error a boot root records and refuses with when its tier's environment does not hold up. */
export function envErrorOf(tier: Tier, verdict: { missing: readonly EnvName[]; invalid: readonly EnvName[] }): EnvError {
  const message = `the ${tier} tier cannot start with the environment as it stands — ${offendersOf(verdict.missing, verdict.invalid)} (AS-01)`;
  return new EnvError(message, tier, verdict.missing, verdict.invalid);
}

/**
 * The outage a boot root records for a name it started WITHOUT: the machine stated something the
 * shape cannot use, this tier does not require the name, so the seam that reads it falls back to
 * its own default and the tier comes up. An operator still owns the mistake, and a tier that swallowed
 * it would be the one log line B-21 rules out (ARCH-03).
 */
export function envUnusableOf(tier: Tier, invalid: readonly EnvName[]): EnvError {
  const message = `the ${tier} tier started on its own defaults for names it does not require — ${offendersOf([], invalid)} (AS-01)`;
  return new EnvError(message, tier, [], invalid);
}

/**
 * What the machine says a name is, right now: trimmed, with blank read as absent.
 *
 * A blank value is treated as "not stated" everywhere in this product — an exported variable with
 * an empty value is how a shell says nothing, not how it says the empty string — so a seam that
 * falls back to a default gets its default, and a tier that requires the name reports it missing.
 */
export function envValue(name: EnvName, source: EnvSource = process.env): string | undefined {
  const stated = source[name]?.trim();
  if (stated === undefined || stated === "") return undefined;
  return stated;
}

/** How the platform states the mode it is running in. Read here, spelled nowhere else (ARCH-02). */
const MODE_VAR = "NODE_ENV";

/** The one mode in which a seam may stand in for something an installation owes it (Q-12). */
const DEVELOPMENT = "development";

/**
 * Is this process running as a developer's own machine rather than as an installation?
 *
 * `NODE_ENV` is the platform's name, not the product's: it is declared foreign in the transport
 * vocabulary and is deliberately NOT in the declaration above, because nothing in the product
 * requires it, no tier fails to start without it and no shape of ours governs what a runtime writes
 * there. It is still the environment, so the one home for the environment is where it is read.
 *
 * Exactly `development` is development. Anything else — `production`, `test`, a value nobody set —
 * is an installation, so a seam that stands in for a missing secret only in development fails closed
 * wherever the mode is not stated (Q-12).
 */
export function isDevelopment(source: EnvSource = process.env): boolean {
  return source[MODE_VAR]?.trim() === DEVELOPMENT;
}

/**
 * Read the whole declaration once, for one tier, and answer what it amounts to.
 *
 * A name the tier requires and the source does not state is `missing`; a name the source states and
 * the shape rejects is `invalid`, whether or not that tier requires it — a value the machine got
 * wrong is wrong for whoever reads it later. What makes the verdict not `ok` is narrower than what
 * it reports: only a name this tier is declared to require. `requiredOutsideDev` is not enforced here: it is
 * declared for the operator and for `pnpm checkup` to read (V-CHECKUP), and enforcing it would need
 * a deployment-mode signal this tier does not have.
 */
export function validateEnv<T extends Tier>(tier: T, source: EnvSource = process.env): EnvVerdict<T> {
  const values: Record<string, unknown> = {};
  const missing: EnvName[] = [];
  const invalid: EnvName[] = [];
  const requiredNames = new Set(ENV_DECLARATION.filter((entry) => entry.requiredBy.includes(tier)).map((entry) => entry.name));

  for (const entry of ENV_DECLARATION) {
    const stated = envValue(entry.name, source);
    if (stated === undefined) {
      if (requiredNames.has(entry.name)) missing.push(entry.name);
      continue;
    }
    const parsed = entry.shape.safeParse(stated);
    if (parsed.success) values[entry.name] = parsed.data;
    else invalid.push(entry.name);
  }

  const blocking = invalid.filter((name) => requiredNames.has(name));
  if (missing.length > 0 || blocking.length > 0) return { ok: false, missing, invalid };
  // Each entry parses its own name's value to that name's declared type, which is what `DECLARED`
  // being read with its literal types makes true; the loop above cannot carry that per-name fact in
  // its own types, and this is the whole of the assertion.
  return { ok: true, env: values as EnvValues<T>, invalid };
}
