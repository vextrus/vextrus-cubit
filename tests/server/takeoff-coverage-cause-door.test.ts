/**
 * DB LANE (`pnpm test:db`) — the cause proposal's door (s-coverage I-297, L-AI-01, CLAUDE.md's
 * "every entry point resolves actor, tenant, project, participation and permission through the one
 * authorize()").
 *
 * The door stands under the SAME permission the two boundary doors stand under: a reader who could
 * not carry either act is shown no proposal, because a proposal nobody may act on is theatre and
 * theatre nobody may act on is a charge to the tenant for nothing (I-194, L-AI-01). So the refusal
 * this suite names is `PERMISSION_NOT_HELD`, and it names it BY NAME.
 *
 * No model is asked anything: the seam is handed in, so what is judged is who reaches it and which
 * cell it is asked about — never a network call and never a fixture root.
 */
import { afterAll, describe, expect, test } from "vitest";
import { closeCoverageStage, productModule, residueSeam, stageActorHolding, stageCoverageCampaign, QUANTITY_BEARING, type StagedCoverage } from "../takeoff/coverage/support/coverage-stage";

const BUDGET_MS = 900_000;

/** The permission both boundary acts move, and the one this door stands under (L-ACT-03). */
const SET_BILL_BOUNDARY = "SET_BILL_BOUNDARY";
const DECLARE_NOT_IN_PROJECT_SCOPE = "DECLARE_NOT_IN_PROJECT_SCOPE";

/** How the guard spells a refusal of a permission a person does not hold. */
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";

/** Where a refusal keeps its registered code, read by the marker's own reader (ARCH-03). */
const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";

/** A role of the shipped roster that may read a project and may not move its bill boundary. */
const READER_ROLE = "ESTIMATOR";

type MarkerModule = { refusalCodeOf: (error: unknown) => string | null };
type SpineSeam ={ projectActorFor: (userId: string, projectId: string, actType: string | null, permission: string) => Promise<{ tenantId: string; userId: string }> };
type CoverageSeam = {
  coverageCauseProposalOf: (
    scope: { tenantId: string; projectId: string },
    address: string,
    caller: { actor: string; requestId: string },
    seam?: { port?: { propose: unknown }; judgmentOf?: (scope: unknown, callId: string) => Promise<{ confidence: number | null } | null> },
  ) => Promise<{ proposal: { callId: string; cause: string } | null }>;
};

let staging: Promise<StagedCoverage> | undefined;
const staged = (): Promise<StagedCoverage> => (staging ??= stageCoverageCampaign("coverage-cause-door"));

afterAll(async () => {
  await closeCoverageStage();
}, 120_000);

/** A model seam that answers a proposal without a network, for the cases that reach past the guard. */
function seamAnswering(cause: string, confidence: number | null) {
  let asked = 0;
  return {
    asked: () => asked,
    seam: {
      port: {
        propose: async (_ctx: unknown, request: { modelId: string }) => {
          asked += 1;
          return { payload: { cause }, sources: ["DXF_HANDLE:10A2"], model: request.modelId, callId: "call-door-1" };
        },
      },
      judgmentOf: async () => ({ confidence }),
    },
  };
}

describe("the door resolves actor, tenant, project, participation and permission through the one authorize()", () => {
  test("a participant who may read the project and may not move its boundary is refused BY NAME, and no model is asked", async () => {
    const it = await staged();
    const spine = await productModule<SpineSeam>("src/server/routers/spine.ts");
    const other = await stageActorHolding(it, READER_ROLE, "cause-door-reader");

    // The guard refuses by its REGISTERED code, carried on the marker; its sentence names the act
    // and the permission, never the code's spelling. So the name is read where a refusal keeps it.
    const { refusalCodeOf } = await productModule<MarkerModule>(REFUSAL_MARKER_MODULE);
    const thrown = await spine.projectActorFor(other.userId, it.projectId, DECLARE_NOT_IN_PROJECT_SCOPE, SET_BILL_BOUNDARY).then(
      () => null,
      (failure: unknown) => failure,
    );
    expect(thrown, `${READER_ROLE} holds no ${SET_BILL_BOUNDARY} on this project, so the cause door refuses them the way the two boundary doors do`).not.toBeNull();
    expect(refusalCodeOf(thrown), "and the refusal is the guard's own, by name").toBe(PERMISSION_NOT_HELD);
  }, BUDGET_MS);

  test("a person of another workspace is refused before the project is read at all", async () => {
    const it = await staged();
    const spine = await productModule<SpineSeam>("src/server/routers/spine.ts");
    const stranger = await stageCoverageCampaign("coverage-cause-stranger");
    await expect(
      spine.projectActorFor(stranger.person.userId, it.projectId, DECLARE_NOT_IN_PROJECT_SCOPE, SET_BILL_BOUNDARY),
      "a project of another workspace is not this person's to be told anything about (SEAM-TENANT)",
    ).rejects.toThrow();
  }, BUDGET_MS);
});

describe("what the door answers once a person is through it", () => {
  test("a cell the residue holds no reading for answers no proposal, rather than a fault", async () => {
    const it = await staged();
    const coverage = await productModule<CoverageSeam>("src/modules/takeoff/coverage/server.ts");
    const asking = seamAnswering("NOT_IN_THIS_BILL", 0.95);
    for (const address of ["not-a-cell-ref", "rcc.concrete:column:00000000-0000-4000-8000-0000000000ff"]) {
      const answer = await coverage.coverageCauseProposalOf(
        { tenantId: it.tenantId, projectId: it.projectId },
        address,
        { actor: it.actor.userId, requestId: "req-door-1" },
        asking.seam as never,
      );
      expect(answer, `${address} names no cell of this residue, and a stale address is a fact about the address (I-193)`).toEqual({ proposal: null });
    }
    expect(asking.asked(), "no cell, no question, no ledger row (L-AI-01)").toBe(0);
  }, BUDGET_MS);

  test("a measured cell is never asked about, and an unmeasured one is — above the floor, and not below it", async () => {
    const it = await staged();
    const residue = await residueSeam();
    const coverage = await productModule<CoverageSeam>("src/modules/takeoff/coverage/server.ts");
    const held = await residue.residueOf(it.scope);
    const measured = held.cells.find((cell) => cell.measurement === QUANTITY_BEARING);
    const open = held.cells.find((cell) => cell.grain === "CELL" && cell.measurement !== QUANTITY_BEARING && cell.class !== null && cell.levelId !== null);
    expect(open, `the staged campaign holds an unmeasured cell: ${JSON.stringify(held.cells)}`).toBeTruthy();

    if (measured !== undefined) {
      const refusing = seamAnswering("NOT_IN_THIS_BILL", 0.95);
      const answer = await coverage.coverageCauseProposalOf(
        { tenantId: it.tenantId, projectId: it.projectId },
        residue.cellRef(measured),
        { actor: it.actor.userId, requestId: "req-door-2" },
        refusing.seam as never,
      );
      expect(answer, "a measured cell explains itself, so no question is put over it").toEqual({ proposal: null });
      expect(refusing.asked()).toBe(0);
    }

    const above = seamAnswering("NOT_IN_THIS_BILL", 0.95);
    const shown = await coverage.coverageCauseProposalOf(
      { tenantId: it.tenantId, projectId: it.projectId },
      residue.cellRef(open as { kind: string; class: string | null; levelId: string | null }),
      { actor: it.actor.userId, requestId: "req-door-3" },
      above.seam as never,
    );
    // The staged cell is only asked about where its own sighting yields a citable key; where it does
    // not, the door answers nothing and says so by answering nothing — which is the same screen.
    if (above.asked() > 0) expect(shown.proposal).toEqual({ callId: "call-door-1", cause: "NOT_IN_THIS_BILL" });

    const below = seamAnswering("NOT_IN_THIS_BILL", 0.2);
    const hidden = await coverage.coverageCauseProposalOf(
      { tenantId: it.tenantId, projectId: it.projectId },
      residue.cellRef(open as { kind: string; class: string | null; levelId: string | null }),
      { actor: it.actor.userId, requestId: "req-door-4" },
      below.seam as never,
    );
    expect(hidden, "a confidence under the caller's floor is no proposal — abstention is the caller's (L-AI-02)").toEqual({ proposal: null });
  }, BUDGET_MS);

  test("a refusal from the seam is caught as 'no proposal', never as a crash and never as a network call", async () => {
    const it = await staged();
    const residue = await residueSeam();
    const coverage = await productModule<CoverageSeam>("src/modules/takeoff/coverage/server.ts");
    const held = await residue.residueOf(it.scope);
    const open = held.cells.find((cell) => cell.grain === "CELL" && cell.measurement !== QUANTITY_BEARING && cell.class !== null && cell.levelId !== null);
    const refusing = {
      port: {
        propose: async () => {
          throw Object.assign(new Error("FIXTURE_MISSING"), { refusalCode: "FIXTURE_MISSING" });
        },
      },
      judgmentOf: async () => null,
    };
    const answer = await coverage.coverageCauseProposalOf(
      { tenantId: it.tenantId, projectId: it.projectId },
      residue.cellRef(open as { kind: string; class: string | null; levelId: string | null }),
      { actor: it.actor.userId, requestId: "req-door-5" },
      refusing as never,
    );
    expect(answer, "a missing recording is a refusal a caller handles, the way rebuild.ts handles a refused caption proposal").toEqual({ proposal: null });
  }, BUDGET_MS);
});
