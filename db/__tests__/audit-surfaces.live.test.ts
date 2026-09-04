// Live public acceptance for AC-3 (and AC-1's "the route renders that answer"), against a
// self-provisioned, migrated scratch database — the same harness every other live suite runs on.
//
// AC-3's claim is about the schema AS MIGRATED: `getAuditSurfaces` answers both panels
// `{ armed: false }`, and the page renders that as a truthful not-armed-yet state rather than an
// error, a fault or an empty table pretending the ledger exists. Only a migrated database can say
// whether that answer is true, which is why this half of AC-3 lives in the db lane and not beside
// the other S-Audit unit tests.
//
// The assertion is the RULE, not the day's snapshot: a panel is armed exactly when the catalogue
// holds the table AUDIT_PANEL_TABLES names for it, and each posture is judged against what the
// migrated catalogue actually holds — so the increment that ships `model_calls` moves the panel from
// one branch of the rule to the other without the rule itself changing (B-19).
//
// Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file like the
// rest of the tree. Product modules are loaded by absolute path, so a module the Builder has not
// written yet fails as an assertion naming the file instead of killing collection at transform time.
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, test } from "vitest";
import { provisionScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, SEED_REASON, TENANT_ALPHA, TENANT_COLUMN } from "./support/fixtures";
import { ident, isTrue, lit, scalar, seedTenants, withSession } from "./support/live-sql";

/** The table a project's row lives in, named once beside the tenant column it carries. */
const PROJECTS_TABLE = "projects";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The homes the Increment Spec's interfaces name. */
const AUDIT_MODULE = "src/modules/spine/audit/index.ts";
const PAGE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/audit/page.tsx";
const STRINGS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/audit/strings.ts";

/** The hooks AC-3 and the test contract fix on the two panels. */
const PANEL_TESTID: Readonly<Record<string, string>> = { modelLedger: "audit-panel-model-ledger", jobs: "audit-panel-jobs" };

/** The string keys the Design Decision §3 rules for each panel's disarmed body line. */
const DISARMED_KEY: Readonly<Record<string, string>> = { modelLedger: "audit_ledger_disarmed", jobs: "audit_jobs_disarmed" };

/** The hooks the explorer region shows on a project with no acts (Decision §1, I-33). */
const EXPLORER_TESTIDS = ["audit-filter-type", "audit-filter-actor", "audit-filter-subject", "audit-acts-empty"] as const;

type AuditPanel = { armed: false } | { armed: true; rowCount: number };
type AuditSurfaces = { acts: readonly unknown[]; modelLedger: AuditPanel; jobs: AuditPanel };
type GetAuditSurfaces = (ctx: { tenantId: string }, projectId: string) => Promise<AuditSurfaces>;

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** Does the migrated database hold this table? The catalogue's own answer, asked as the owner. */
function tableExists(url: string, table: string): boolean {
  return isTrue(scalar(url, `select (to_regclass(${lit(table)}) is not null)::text;`));
}

/* ------------------------------------------------------------------ staging */

type Scratch = { urlMigrate: string; urlApp: string; drop(): Promise<void> };
let scratch: Scratch | undefined;

afterAll(async () => {
  await scratch?.drop();
});

interface Stage {
  urlMigrate: string;
  tenantId: string;
  projectId: string;
  getAuditSurfaces: GetAuditSurfaces;
  panelTables: Readonly<Record<string, string>>;
}

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    const tenantId = seedTenants(provisioned.urlMigrate)[TENANT_ALPHA] ?? "";
    expect(tenantId, `the scenario seeded no ${TENANT_ALPHA}`).not.toBe("");

    // The product opens its pool from this, so it is repointed before the module is imported.
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const module = await productModule<{ getAuditSurfaces?: GetAuditSurfaces; AUDIT_PANEL_TABLES?: Record<string, string> }>(AUDIT_MODULE);

    const door = module.getAuditSurfaces;
    expect(typeof door, `${AUDIT_MODULE} must export getAuditSurfaces(ctx, projectId) — S-Audit's sole read door`).toBe("function");
    const tables = module.AUDIT_PANEL_TABLES;
    expect(typeof tables, `${AUDIT_MODULE} must export AUDIT_PANEL_TABLES — the names the panels probe`).toBe("object");

    // A project this workspace actually holds. The address the page is rendered at has to name one:
    // a segment naming no project of the workspace is an address that does not exist, and the screen
    // answers it as absent rather than drawing a confident, empty act log over it. Every claim below
    // is about the panels' posture and the explorer's own empty leg, and a project with a row and no
    // acts is exactly the scene those claims were always about.
    const projectId = scalar(
      provisioned.urlMigrate,
      withSession(
        { [GUC_SYSTEM_REASON]: SEED_REASON },
        `insert into ${ident(PROJECTS_TABLE)} (${ident(TENANT_COLUMN)}, name) values (${lit(tenantId)}, 'Audit surfaces acceptance') returning project_id::text;`,
      ),
    );

    return {
      urlMigrate: provisioned.urlMigrate,
      tenantId,
      projectId,
      getAuditSurfaces: door as GetAuditSurfaces,
      panelTables: tables as Record<string, string>,
    };
  })());

/* ------------------------------------------------------------------ the cases */

describe("AC-3 — on the schema as migrated today, both panels answer that they are not armed", () => {
  test("AC-3: getAuditSurfaces answers a panel for the model ledger and one for jobs", async () => {
    const stage = await staged();
    const surfaces = await stage.getAuditSurfaces({ tenantId: stage.tenantId }, stage.projectId);

    expect(Array.isArray(surfaces.acts), "AuditSurfaces carries the project's acts as a list — a fresh project's is empty, never absent").toBe(true);
    expect(surfaces.acts, "a project with no acts committed on it has no acts to show").toEqual([]);
    for (const panel of Object.keys(PANEL_TESTID)) {
      expect(typeof (surfaces as unknown as Record<string, AuditPanel>)[panel]?.armed, `AuditSurfaces.${panel} must state its armed posture`).toBe("boolean");
    }
  });

  test("AC-3: a panel is armed exactly when the catalogue holds the table AUDIT_PANEL_TABLES names", async () => {
    const stage = await staged();
    const surfaces = (await stage.getAuditSurfaces({ tenantId: stage.tenantId }, stage.projectId)) as unknown as Record<string, AuditPanel>;

    for (const [panel, table] of Object.entries(stage.panelTables)) {
      const holds = tableExists(stage.urlMigrate, table);
      expect(
        surfaces[panel]?.armed,
        `the ${panel} panel says armed=${String(surfaces[panel]?.armed)} while the migrated database ${holds ? "holds" : "does not hold"} "${table}" — the posture is a live probe of that table, never a frozen roster (I-35)`,
      ).toBe(holds);
    }
  });

  test("AC-3: a panel with no table answers exactly { armed: false }, and one with a table counts rows", async () => {
    const stage = await staged();
    const surfaces = (await stage.getAuditSurfaces({ tenantId: stage.tenantId }, stage.projectId)) as unknown as Record<string, AuditPanel>;

    for (const [panel, table] of Object.entries(stage.panelTables)) {
      const answer = surfaces[panel];
      if (!tableExists(stage.urlMigrate, table)) {
        expect(answer, `the ${panel} panel answers exactly { armed: false } while its table does not exist — not an error, not a fault, not an empty table pretending the ledger exists`).toEqual({ armed: false });
        continue;
      }
      expect(answer?.armed, `"${table}" is in the migrated schema, so the ${panel} panel answers armed rather than disarmed`).toBe(true);
      const rowCount = (answer as { armed: true; rowCount: number }).rowCount;
      expect(
        Number.isSafeInteger(rowCount) && rowCount >= 0,
        `an armed ${panel} panel answers a whole count of the rows this project may see, not ${String(rowCount)}`,
      ).toBe(true);
    }
  });
});

describe("AC-1/AC-3 — the route renders that answer", () => {
  test("AC-3: the page renders each panel's data-armed posture and, where disarmed, the Decision's copy", async () => {
    const stage = await staged();
    const page = await productModule<{ default?: (props: { params: Promise<{ tenant: string; project: string }> }) => Promise<unknown> }>(PAGE_MODULE);
    expect(typeof page.default, `${PAGE_MODULE} must default-export the server component that renders this screen`).toBe("function");

    const element = await (page.default as (props: { params: Promise<{ tenant: string; project: string }> }) => Promise<unknown>)({
      params: Promise.resolve({ tenant: stage.tenantId, project: stage.projectId }),
    });
    const markup = renderToStaticMarkup(element as never);

    const strings = await productModule<Record<string, unknown>>(STRINGS_MODULE);
    const copy: Record<string, string> = Object.assign({}, ...Object.values(strings).filter((value) => typeof value === "object" && value !== null && !Array.isArray(value)));

    for (const [panel, testId] of Object.entries(PANEL_TESTID)) {
      const armed = tableExists(stage.urlMigrate, stage.panelTables[panel] ?? "");
      const tag = new RegExp(`<[a-zA-Z]+[^>]*${testId}[^>]*>`).exec(markup)?.[0] ?? "";
      expect(tag, `the page must render [data-testid="${testId}"] — the panel's hook in the test contract`).not.toBe("");
      expect(
        new RegExp(`data-armed="${String(armed)}"`).test(tag),
        `[data-testid="${testId}"] must carry data-armed="${String(armed)}" while its table ${armed ? "is in" : "is not in"} the migrated schema. The tag rendered was: ${tag}`,
      ).toBe(true);

      const disarmed = copy[DISARMED_KEY[panel] ?? ""] ?? "";
      expect(disarmed, `${STRINGS_MODULE} must hold ${DISARMED_KEY[panel]} — the Decision §3 rules the disarmed body line`).not.toBe("");
      if (armed) continue;
      expect(markup.includes(escaped(disarmed)), `the ${panel} panel must say, in the Decision's own words, that this installation records none yet — a disarmed panel is a state, not a failure (I-35)`).toBe(true);
    }
  });

  test("AC-1: the page renders the act-log explorer with its filters and, on a project with no acts, the empty state", async () => {
    const stage = await staged();
    const page = await productModule<{ default?: (props: { params: Promise<{ tenant: string; project: string }> }) => Promise<unknown> }>(PAGE_MODULE);
    const element = await (page.default as (props: { params: Promise<{ tenant: string; project: string }> }) => Promise<unknown>)({
      params: Promise.resolve({ tenant: stage.tenantId, project: stage.projectId }),
    });
    const markup = renderToStaticMarkup(element as never);

    for (const testId of EXPLORER_TESTIDS) {
      expect(markup.includes(testId), `the page must render [data-testid="${testId}"] — the explorer's filter controls stay the screen's content, and the empty answer renders in the list's place (I-33)`).toBe(true);
    }
    expect(markup.includes("audit-act-row"), "a project with no acts renders no act row").toBe(false);
  });

  test("AC-1: a segment naming no project of this workspace is answered as an address that does not exist", async () => {
    const stage = await staged();
    const page = await productModule<{ default?: (props: { params: Promise<{ tenant: string; project: string }> }) => Promise<unknown> }>(PAGE_MODULE);

    // An id of the shape a project's is, that this database holds no project under — asked of the
    // migrated schema rather than assumed, so the case is about an absent project and not about a
    // malformed segment the roster read would have refused anyway.
    const unheld = scalar(stage.urlMigrate, "select gen_random_uuid()::text;");
    const holds = isTrue(
      scalar(
        stage.urlMigrate,
        withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, `select exists (select 1 from ${ident(PROJECTS_TABLE)} where project_id = ${lit(unheld)})::text;`),
      ),
    );
    expect(holds, `this case needs an id no project answers to, and ${unheld} is one the database holds`).toBe(false);

    // The framework's own answer for an address that does not exist, read from the framework rather
    // than transcribed (B-19): whatever `notFound()` raises is what the page must raise.
    const { notFound } = await import("next/navigation");
    const absent = await Promise.resolve()
      .then(() => notFound())
      .then(
        () => undefined,
        (thrown: unknown) => (thrown as { digest?: unknown }).digest,
      );
    expect(typeof absent, "next/navigation's notFound() answers by raising, and its digest is what marks that answer").toBe("string");

    const answered = await (page.default as (props: { params: Promise<{ tenant: string; project: string }> }) => Promise<unknown>)({
      params: Promise.resolve({ tenant: stage.tenantId, project: unheld }),
    }).then(
      () => null,
      (failure: unknown) => failure,
    );

    expect(answered, "an address naming no project of the workspace renders nothing — a confident, empty act log would say the project exists").not.toBeNull();
    expect(
      (answered as { digest?: unknown }).digest,
      "the page answers an unknown project with the framework's not-found, against the real roster read: the address is absent, not empty",
    ).toBe(absent);
  });
});

/** React escapes the text it renders; the Decision's copy is compared as it lands in the markup. */
function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
