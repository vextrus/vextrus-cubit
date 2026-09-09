/**
 * AC-3 — pinning a drawing set opens one campaign per pinned revision, and the campaign copies its
 * three digests immutably at that moment (L-REG-07, L-REG-06, L-ACT-02).
 *
 * "Campaign creation copies onto the campaign, immutably: the rule-set edition key, the work-item
 * catalogue digest (over `bears`, canonically sorted (class, kind) pairs), and the level-stack
 * digest." Every expected digest below is asked of the product's own one home for it — the pinned
 * view for the edition, `catalogueDigest` over `BEARS` for the catalogue, the level door for the
 * stack — so a snapshot that drifts from what is in force is visible here and nothing is
 * transcribed (B-19).
 *
 * The act is driven through the shipped seam, preview and commit, and the campaign is read back
 * through the doors the increment publishes. Nothing here reads product source.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  CAMPAIGNS_TABLE,
  PIN_DRAWING_SET,
  SET_NOT_PINNABLE,
  bears,
  campaignsSeam,
  closeStage,
  codeOf,
  field,
  liveLevelStackDigest,
  performAct,
  pinnedView,
  rejection,
  stageCampaign,
  storeCount,
  storeRows,
  unique,
  type StagedCampaign,
  type StoreRow,
} from "../gate/support/gate-stage";
import { actsSeam, pinning, setsSeam } from "../sets/support/sets-stage";
import { actorOf } from "../register/support/register-stage";

/** A sha-256, as every digest of L-REG-07 is spelled. */
const SHA256 = /^[0-9a-f]{64}$/u;

let staged: Promise<StagedCampaign> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const campaign = (): Promise<StagedCampaign> => (staged ??= stageCampaign("pin"));

afterAll(async () => {
  await closeStage();
});

/** The campaign the store holds for one pinned revision, asserted to be exactly one. */
function campaignFor(tenantId: string, setRevisionId: string): StoreRow {
  const rows = storeRows(CAMPAIGNS_TABLE, tenantId).filter((row) => String(field(row, "setRevisionId", "set_revision_id")) === setRevisionId);
  expect(rows.length, `pinning ${setRevisionId} opened exactly one campaign — a pinned revision is measured under one campaign (L-REG-07)`).toBe(1);
  return rows[0] as StoreRow;
}

describe("AC-3: pinning a drawing set opens one campaign, with the pin's three digests snapshotted", () => {
  test("AC-3: the pin writes one OPEN campaign for the revision, in the act that wrote the revision", async () => {
    const it = await campaign();
    const campaigns = await campaignsSeam();
    const row = campaignFor(it.tenantId, it.setRevisionId);

    expect(String(field(row, "status", "status")), "the campaign a pin opens stands OPEN (test contract: CAMPAIGN_STATUSES)").toBe("OPEN");
    expect(
      [...campaigns.CAMPAIGN_STATUSES],
      "and the status it stands at is one the campaign core admits — the roster is the product's, not this file's (B-19)",
    ).toContain(String(field(row, "status", "status")));

    // One transaction, observed: the campaign cites the very act that wrote the drawing-set
    // revision, so the two rows cannot have been written by two commits (L-REG-07, L-ACT-01).
    const revisionActId = String(
      storeRows("drawing_set_revisions", it.tenantId)
        .filter((revision) => String(field(revision, "setRevisionId", "set_revision_id")) === it.setRevisionId)
        .map((revision) => field(revision, "actId", "act_id"))[0],
    );
    expect(revisionActId, "the pinned revision was written by an act").not.toBe("undefined");
    expect(
      String(field(row, "actId", "act_id")),
      "the campaign cites the same act as the revision it belongs to — PIN_DRAWING_SET opens it inside its own commit transaction (goal)",
    ).toBe(revisionActId);
    expect(String(field(row, "projectId", "project_id")), "the campaign belongs to the project whose set was pinned").toBe(it.projectId);
  });

  test("AC-3: the edition, catalogue and level-stack digests are the ones in force at the pin", async () => {
    const it = await campaign();
    const campaigns = await campaignsSeam();
    const row = campaignFor(it.tenantId, it.setRevisionId);
    const catalogue = await bears();

    const view = await pinnedView(it.scope);
    expect(view.pinned, "the project is pinned to a rule-set edition — an unpinned project is unrepresentable (L-REG-07)").toBe(true);
    expect(
      String(field(row, "editionDigest", "edition_digest")),
      "the campaign snapshots the rule-set edition key the project is pinned to (L-REG-07)",
    ).toBe(String(view.digest));

    const expectedCatalogue = campaigns.catalogueDigest(catalogue.rows);
    expect(expectedCatalogue, "the catalogue digest is a sha-256 over the (class, kind) pairs").toMatch(SHA256);
    expect(
      String(field(row, "catalogueDigest", "catalogue_digest")),
      "the campaign snapshots the work-item catalogue digest over `bears` (L-REG-07)",
    ).toBe(expectedCatalogue);

    expect(
      String(field(row, "levelStackDigest", "level_stack_digest")),
      "the campaign snapshots the digest of the level stack the project stood at (L-REG-07)",
    ).toBe(await liveLevelStackDigest(it.scope));
  });

  test("AC-3: the catalogue digest is over the pairs as a SET — canonically sorted, order-insensitive", async () => {
    const campaigns = await campaignsSeam();
    const catalogue = await bears();
    const [first, second] = catalogue.classes;
    expect(typeof first === "string" && typeof second === "string", "the catalogue names more than one class, so two distinct pairs can be made of it").toBe(true);
    const kind = (catalogue.rows[0] as { kind: string }).kind;
    const a = { class: String(first), kind };
    const b = { class: String(second), kind };

    expect(
      campaigns.catalogueDigest([a, b]),
      "the digest is over canonically sorted pairs, so the order they are handed in cannot change it (L-REG-07)",
    ).toBe(campaigns.catalogueDigest([b, a]));
    expect(
      campaigns.catalogueDigest([a, b]),
      "and a different set of pairs is a different catalogue — a digest that ignored a pair would let a catalogue change unnoticed",
    ).not.toBe(campaigns.catalogueDigest([a]));
  });

  test("AC-3: the doors answer the campaign, and answer the same row twice", async () => {
    const it = await campaign();
    const campaigns = await campaignsSeam();

    const held = await campaigns.campaignsOf(it.scope);
    const mine = held.filter((row) => String(field(row, "campaignId", "campaign_id")) === it.campaignId);
    expect(mine.length, `campaignsOf answers the campaign the pin opened (it answered ${held.length} rows)`).toBe(1);
    expect(await campaigns.campaignOf(it.scope, it.campaignId), "campaignOf answers the same row campaignsOf does — one campaign, read two ways").toEqual(mine[0]);
  });

  test("AC-3: the pin's Consequence is unchanged — SUBJECTS, one subject per member", async () => {
    const it = await campaign();
    const acts = await actsSeam();
    const sets = await setsSeam();
    const setScope = { tenantId: it.tenantId, projectId: it.projectId };

    // A member the set did not name before, so this is a real pin rather than a repetition.
    const spare = it.spare[0];
    expect(typeof spare, "a drawing of the project stands outside the set, so a further pin has something to change").toBe("string");
    expect((await sets.toggleMember(setScope, it.setId, spare as string)).toggled, "the spare drawing was toggled into the set").toBe(true);

    const view = await sets.setOf(setScope, it.setId);
    expect(view, "the set the pin is previewed for stands in the module's answer").not.toBeNull();
    const memberCount = (view as { members: readonly string[] }).members.length;

    const consequence = await acts.preview(actorOf(it.person), pinning(it.projectId, it.setId));
    expect(String(consequence.actType), "the act previewed is the pin").toBe(PIN_DRAWING_SET);
    expect(String(consequence.rendering), "the pin renders as SUBJECTS — J-012's digest and its baselines stand (L-ACT-02)").toBe("SUBJECTS");
    expect(consequence.subjects.length, "one subject per member of the manifest the pin would cite (L-ACT-02)").toBe(memberCount);
  });

  test("AC-3: a second pin opens a second campaign, and only for the revision it wrote", async () => {
    const it = await campaign();
    const campaigns = await campaignsSeam();
    const before = (await campaigns.campaignsOf(it.scope)).length;

    await performAct(it.actor, pinning(it.projectId, it.setId) as unknown as Record<string, unknown>);

    const after = await campaigns.campaignsOf(it.scope);
    expect(after.length, "the second pin opened one further campaign — one campaign per pinned revision (goal)").toBe(before + 1);
    const revisions = new Set(after.map((row) => String(field(row, "setRevisionId", "set_revision_id"))));
    expect(revisions.size, "and each campaign belongs to a revision of its own").toBe(after.length);
  });

  test("AC-3: a refused pin opens no campaign", async () => {
    const it = await campaign();
    const acts = await actsSeam();
    const sets = await setsSeam();
    const setScope = { tenantId: it.tenantId, projectId: it.projectId };

    const created = await sets.createSet(setScope, { userId: it.person.userId }, unique("empty set"));
    expect(created.created, `the empty set was created: ${JSON.stringify(created)}`).toBe(true);
    const emptySetId = (created as { created: true; setId: string }).setId;

    const before = storeCount(CAMPAIGNS_TABLE, it.tenantId);
    const failure = await rejection(acts.preview(actorOf(it.person), pinning(it.projectId, emptySetId)));
    expect(failure, "a set naming no drawing of the project is not pinnable (L-REG-06)").not.toBeNull();
    expect(await codeOf(failure), "the pin is refused SET_NOT_PINNABLE").toBe(SET_NOT_PINNABLE);
    expect(
      storeCount(CAMPAIGNS_TABLE, it.tenantId),
      "a pin that refused opened no campaign — the campaign is written inside the commit the refusal never reached (L-REG-07)",
    ).toBe(before);
  });
});
