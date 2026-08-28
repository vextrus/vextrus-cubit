/**
 * Acceptance support for inc-015 (the immutable rule-set edition store and its M0 surfaces).
 *
 * Everything here observes the product through the names the increment declares — the module
 * homes from its interfaces, the seed roster from L-MEA-01, the route, test ids and view shape
 * from the committed Design Decision `docs/design/s-settings-ruleset.md`. No product source is
 * read: a module the Builder has not written yet fails as an assertion naming the file.
 *
 * NOTE FOR THE BUILDER: product modules are loaded by absolute path, so the `@/*` tsconfig alias
 * is never resolved inside them — keep imports between `src/` files relative, as `src/core/db.ts`
 * does.
 */
import { expect } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";

export { REPO_ROOT, productModule };

/* ------------------------------------------------------------------ the declared homes */

/** The edition module's barrel (increment interfaces: `src/core/rulesets/editions`). */
export const EDITIONS_MODULE = "src/core/rulesets/editions/index.ts";

/** The seed's barrel (increment interfaces: `src/core/rulesets/seed`). */
export const SEED_MODULE = "src/core/rulesets/seed/index.ts";

/** The pin inc-011 will call inside its project-creation transaction. */
export const PIN_MODULE = "src/modules/spine/projects/ruleset-pin.ts";

/** The screen's route directory (Design Decision §1; the risk note's guarded `p/[project]` base). */
export const ROUTE_DIR = "src/app/(app)/t/[tenant]/p/[project]/settings/ruleset";

/** The files the Design Decision §1 rules into that directory. */
export const PAGE_MODULE = `${ROUTE_DIR}/page.tsx`;
export const SECTION_MODULE = `${ROUTE_DIR}/ruleset-settings-section.tsx`;
export const STATES_MODULE = `${ROUTE_DIR}/states.ts`;

/** The Design Decision this screen is implemented against (AC-4). */
export const DESIGN_DECISION = "docs/design/s-settings-ruleset.md";

/* ------------------------------------------------------- the contract's names and rosters */

/** The route the test contract introduces, as a template over its two segments. */
export const ROUTE_TEMPLATE = "/t/{tenantId}/p/{projectId}/settings/ruleset";

/** The seven test ids of the closed contract (Design Decision §7). */
export const TESTID_IDENTITY = "ruleset-edition-identity";
export const TESTID_DIGEST = "ruleset-edition-digest";
export const TESTID_LINEAGE = "ruleset-lineage";
export const TESTID_LINEAGE_STEP = "ruleset-lineage-step";
export const TESTID_PARAMETER_TABLE = "ruleset-parameter-table";
export const TESTID_PARAMETER_ROW = "ruleset-parameter-row";
export const TESTID_UNPINNED = "ruleset-unpinned";

/** Edition identity is (scope, name, version), and the fork chain runs platform → tenant → project. */
export const LINEAGE_SCOPES: readonly ["platform", "tenant", "project"] = ["platform", "tenant", "project"];

/** The seed edition's identity (L-MEA-01: `IS1200_IN @ 2026.08`). */
export const SEED_NAME = "IS1200_IN";
export const SEED_VERSION = "2026.08";

/**
 * The seed's parameters, verbatim from L-MEA-01 and the Design Decision §3 table — the closed 17
 * the increment's interfaces name. The value is compared as a quantity, never as a spelling: a
 * store that writes `0.10` holds the same allowance as one that writes `0.1`, and acceptance that
 * failed on that would be grading a decimal rendering, not the law.
 */
export const SEED_PARAMETERS: readonly { key: string; value: number; unit: string }[] = [
  { key: "openingDeductionMinM2", value: 0.1, unit: "m²" },
  { key: "memberEndNoDeductMaxCm2", value: 500, unit: "cm²" },
  { key: "embeddedDuctNoDeductMaxCm2", value: 100, unit: "cm²" },
  { key: "finishOpeningDeductionMinM2", value: 0.1, unit: "m²" },
  { key: "finishMinOutlineArea", value: 0.2, unit: "sft" },
  { key: "finishMaxOutlineArea", value: 20000, unit: "sft" },
  { key: "scaleVerificationTolerance", value: 0.01, unit: "ratio" },
  { key: "scaleAnisotropyTolerance", value: 0.01, unit: "ratio" },
  { key: "earthworkWorkingAllowance", value: 1.5, unit: "ft" },
  { key: "earthworkDepthExtra", value: 0.5, unit: "ft" },
  { key: "blindingProjection", value: 3, unit: "in" },
  { key: "blindingThickness", value: 3, unit: "in" },
  { key: "placementContainmentMerge", value: 0.08, unit: "ratio" },
  { key: "placementNearAnchor", value: 0.9, unit: "ratio" },
  { key: "placementFootprintMin", value: 0.6, unit: "ratio" },
  { key: "placementFootprintMax", value: 2.5, unit: "ratio" },
  { key: "placementHumanSnap", value: 0.5, unit: "ratio" },
];

/** The keys alone, in the Design Decision's render order. */
export const SEED_PARAMETER_KEYS: readonly string[] = SEED_PARAMETERS.map((parameter) => parameter.key);

/* ------------------------------------------------------------- the shapes, as seen by a caller */

/** One method in force, enumerated by (rule id, version) — L-MEA-01. */
export interface MethodPair {
  ruleId: string;
  version: string;
}

/** What `editionDigest` is handed: parameter values × the method pairs in force. */
export interface EditionContentLike {
  parameters: Record<string, unknown>;
  methods: MethodPair[];
}

/** Edition identity, carried separately from the digest (L-MEA-01). */
export interface IdentityLike {
  scope: string;
  name: string;
  version: string;
}

/** One step of the lineage the view answers. */
export interface LineageStepLike extends IdentityLike {
  digest: string;
}

/** The pinned answer of `projectRulesetView`; the no-pin answer is `{ pinned: false, tenantId }`. */
export interface PinnedViewLike {
  pinned: true;
  identity: IdentityLike;
  digest: string;
  parameters: Record<string, unknown>;
  lineage: LineageStepLike[];
}

/** The honest absence the view answers for an address that names no pin (Design Decision I-28). */
export interface UnpinnedViewLike {
  pinned: false;
  tenantId: string;
}

export type RulesetViewLike = PinnedViewLike | UnpinnedViewLike;

/** The editions module, as its callers use it. */
export interface EditionsModule {
  editionDigest?: (content: EditionContentLike) => string;
  projectRulesetView?: (input: { tenantId: string; projectId: string }) => Promise<RulesetViewLike>;
}

/** The pin, as inc-011 will call it. */
export interface PinModule {
  pinRulesetForProject?: (tx: unknown, input: { tenantId: string; projectId: string }) => Promise<unknown>;
}

/* --------------------------------------------------------------------------------- the loaders */

/** The editions barrel, with `editionDigest` proven to be there. */
export async function loadEditionDigest(): Promise<(content: EditionContentLike) => string> {
  const module = await productModule<EditionsModule>(EDITIONS_MODULE);
  expect(typeof module.editionDigest, `${EDITIONS_MODULE} must export editionDigest(content) — the content digest L-MEA-01 keys an edition by`).toBe("function");
  return module.editionDigest as (content: EditionContentLike) => string;
}

/** The editions barrel, with `projectRulesetView` proven to be there. */
export async function loadProjectRulesetView(): Promise<(input: { tenantId: string; projectId: string }) => Promise<RulesetViewLike>> {
  const module = await productModule<EditionsModule>(EDITIONS_MODULE);
  expect(typeof module.projectRulesetView, `${EDITIONS_MODULE} must export projectRulesetView({ tenantId, projectId })`).toBe("function");
  return module.projectRulesetView as (input: { tenantId: string; projectId: string }) => Promise<RulesetViewLike>;
}

/** `pinRulesetForProject`, proven to be there. */
export async function loadPinRulesetForProject(): Promise<(tx: unknown, input: { tenantId: string; projectId: string }) => Promise<unknown>> {
  const module = await productModule<PinModule>(PIN_MODULE);
  expect(typeof module.pinRulesetForProject, `${PIN_MODULE} must export pinRulesetForProject(tx, { tenantId, projectId }) — the file inc-011 calls inside its project-creation transaction`).toBe("function");
  return module.pinRulesetForProject as (tx: unknown, input: { tenantId: string; projectId: string }) => Promise<unknown>;
}

/** Is this the shape `editionDigest` takes — parameters and the method roster? */
export function isEditionContent(value: unknown): value is EditionContentLike {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const parameters = record["parameters"];
  return typeof parameters === "object" && parameters !== null && Array.isArray(record["methods"]);
}

/** Is this an edition identity — (scope, name, version)? */
export function isIdentity(value: unknown): value is IdentityLike {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["scope"] === "string" && typeof record["name"] === "string" && typeof record["version"] === "string";
}

/**
 * The exported seed content, found by its shape rather than by one blessed export name — the
 * increment's interfaces name the module and what it exports ("exported seed content and identity
 * for IS1200_IN @ 2026.08") but not the identifiers, so the module is asked what it holds.
 */
export async function loadSeedContent(): Promise<EditionContentLike> {
  const module = await productModule<Record<string, unknown>>(SEED_MODULE);
  const found = Object.values(module).find(isEditionContent);
  expect(
    found,
    `${SEED_MODULE} must export the seed edition's content — an object { parameters, methods } (methods empty at M0, since no method is enumerated in the tree yet). Exports seen: ${Object.keys(module).join(", ") || "none"}`,
  ).toBeTruthy();
  return found as EditionContentLike;
}

/** The exported seed identity, found the same way. */
export async function loadSeedIdentity(): Promise<IdentityLike> {
  const module = await productModule<Record<string, unknown>>(SEED_MODULE);
  const found = Object.values(module).find(isIdentity);
  expect(
    found,
    `${SEED_MODULE} must export the seed edition's identity — { scope, name, version } naming ${SEED_NAME} @ ${SEED_VERSION}. Exports seen: ${Object.keys(module).join(", ") || "none"}`,
  ).toBeTruthy();
  return found as IdentityLike;
}

/* ------------------------------------------------------------------ reading a parameter value */

/**
 * The quantity a parameter denotes, however the edition spells it: `{ value, unit }` per the
 * Design Decision I-27, or a bare decimal string or number. A shape nothing can be read out of
 * fails loudly — an unreadable parameter is a gap in the proof, not something to pass over.
 */
export function parameterNumber(key: string, value: unknown): number {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>)["value"] : value;
  const asNumber = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  expect(Number.isFinite(asNumber), `the parameter ${key} must carry a readable decimal value; got ${JSON.stringify(value)}`).toBe(true);
  return asNumber;
}

/**
 * The parameter's value exactly as the edition spells it — the string `formatUserFigure` is handed,
 * so the precision compared against the screen is the edition's own and never this file's rounding.
 */
export function parameterRaw(key: string, value: unknown): string {
  const raw = typeof value === "object" && value !== null ? (value as Record<string, unknown>)["value"] : value;
  expect(typeof raw === "string" || typeof raw === "number", `the parameter ${key} must carry a decimal value; got ${JSON.stringify(value)}`).toBe(true);
  return String(raw);
}

/** The unit a parameter carries, when it carries one (Design Decision I-27: unit is edition data). */
export function parameterUnit(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const unit = (value as Record<string, unknown>)["unit"];
  return typeof unit === "string" ? unit : undefined;
}

/**
 * The same parameter with a different quantity — used to prove the digest moves when a value does.
 * The spelling of the mutant does not matter, only that it denotes something else.
 */
export function withDifferentValue(value: unknown): unknown {
  if (typeof value === "number") return value + 1;
  if (typeof value === "string") return `${Number(value) + 1}`;
  if (typeof value === "object" && value !== null) {
    const record = { ...(value as Record<string, unknown>) };
    record["value"] = withDifferentValue(record["value"]);
    return record;
  }
  return "1";
}

/* ------------------------------------------------------------------------------- the fixtures */

/** Two method pairs, so "reordering the method pairs" and "bumping a version" have something to move. */
export const PROBE_METHODS: readonly MethodPair[] = [
  { ruleId: "probe.method.alpha", version: "1.0.0" },
  { ruleId: "probe.method.beta", version: "2.4.1" },
];

/** A content object over the seed's parameters and a non-empty method roster (L-MEA-01's product). */
export function contentWithMethods(seed: EditionContentLike, methods: readonly MethodPair[] = PROBE_METHODS): EditionContentLike {
  return { parameters: structuredClone(seed.parameters), methods: methods.map((pair) => ({ ...pair })) };
}

/** The same content with its parameter keys in the opposite order — the same edition, spelled backwards. */
export function reversedParameters(content: EditionContentLike): EditionContentLike {
  const reversed: Record<string, unknown> = {};
  for (const key of Object.keys(content.parameters).reverse()) reversed[key] = structuredClone(content.parameters[key]);
  return { parameters: reversed, methods: content.methods.map((pair) => ({ ...pair })) };
}

/**
 * A pinned view over the given content and digest — the shape `projectRulesetView` answers and the
 * shape `RulesetSettingsSection` takes, per the Design Decision. The lineage's three steps share
 * the digest, because a verbatim fork shares its parent's by construction.
 */
export function pinnedView(content: EditionContentLike, digest: string, tenantName = "acme-workspace", projectName = "acme-tower"): PinnedViewLike {
  const identity = { scope: "project", name: projectName, version: SEED_VERSION };
  return {
    pinned: true,
    identity,
    digest,
    parameters: structuredClone(content.parameters),
    lineage: [
      { scope: "platform", name: SEED_NAME, version: SEED_VERSION, digest },
      { scope: "tenant", name: tenantName, version: SEED_VERSION, digest },
      { scope: "project", name: projectName, version: SEED_VERSION, digest },
    ],
  };
}

/** The no-pin answer, carrying the workspace it was asked about (Design Decision I-28). */
export function unpinnedView(tenantId: string): UnpinnedViewLike {
  return { pinned: false, tenantId };
}
