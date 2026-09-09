/**
 * BREAKER — the freshness gate, asked about an address that is not one (L-REG-07, ARCH-02/ARCH-03).
 *
 * Every other door of this increment judges its address before it reaches the store: `campaignOf`
 * and `campaignsOf` answer `null`/`[]` for a segment that is not a uuid, and the gate refuses
 * CAMPAIGN_NOT_FOUND per offer. The reason is stated in the campaign core itself — "a segment that
 * is not a uuid would reach the database as a cast error rather than as a row that is not there, so
 * it is judged here first".
 *
 * `freshnessOf` judges only the campaign id. Its project id goes to the store as written, so an
 * address a URL segment could carry fails as a database fault instead of being answered in the
 * closed taxonomy — a fault a caller cannot tell from a store that is down (B-21, R-SPINE-062).
 *
 * The well-formed-but-unheld address is the control: whatever the door answers there is what the
 * malformed one owes too.
 */
import { afterAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { campaignsSeam, closeStage, stageCampaign, type StagedCampaign } from "../gate/support/gate-stage";

/** A project id no workspace holds, spelled as a project id is spelled. */
const UNHELD = randomUUID();

/** A project id a URL segment could carry and no store can cast. */
const MALFORMED = "not-a-uuid";

let staged: Promise<StagedCampaign> | undefined;
const campaign = (): Promise<StagedCampaign> => (staged ??= stageCampaign("freshness-breaker"));

afterAll(async () => {
  await closeStage();
});

/** What one call answered, or the fault it raised and the registered code that fault carries. */
type Asked = { answered: true; value: unknown } | { answered: false; code: string | null; said: string };

async function askFreshness(scope: { tenantId: string; projectId: string }, campaignId: string): Promise<Asked> {
  const campaigns = await campaignsSeam();
  return campaigns.freshnessOf(scope, campaignId).then(
    (value): Asked => ({ answered: true, value }),
    (error: unknown): Asked => {
      const code = (error as { refusalCode?: unknown }).refusalCode;
      return { answered: false, code: typeof code === "string" ? code : null, said: String(error).slice(0, 300) };
    },
  );
}

describe("BREAKER: freshness asked about an address that names no campaign", () => {
  test("an unheld project answers, or refuses by its registered code — the control", async () => {
    const it = await campaign();
    const asked = await askFreshness({ tenantId: it.tenantId, projectId: UNHELD }, it.campaignId);
    expect(
      asked.answered || asked.code !== null,
      `an address naming no campaign of this project is an answer in the closed taxonomy, never a bare fault (ARCH-03, B-21): ${JSON.stringify(asked)}`,
    ).toBe(true);
  });

  test("a project id that is not a uuid is judged before the store, not cast by it", async () => {
    const it = await campaign();
    const asked = await askFreshness({ tenantId: it.tenantId, projectId: MALFORMED }, it.campaignId);
    expect(
      asked.answered || asked.code !== null,
      `the freshness gate judges the whole address before the store — "a segment that is not a uuid would reach the database as a cast error rather than as a row that is not there, so it is judged here first" (ARCH-02), and a fault carrying no registered code is one a caller cannot tell from a store that is down (ARCH-03, B-21, R-SPINE-062): ${JSON.stringify(asked)}`,
    ).toBe(true);
  });
});
