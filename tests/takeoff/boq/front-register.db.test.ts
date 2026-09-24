// @vitest-environment node
/**
 * DB LANE — the draft's front page names the drawings it measured as a register of sheets, and the
 * rule-set edition its campaign was opened under (s-boq I-689, I-691).
 *
 * The register's staged campaign is measured through the shipped seams. What is graded is the one
 * reading the screen, the PDF and the workbook read (`boqViewOf`): every sheet a member line cites
 * stands in the register once, by the number the details cite it by and a title read off its title
 * block, in sheet-number order; and the edition is the one the campaign row names, by its own name
 * and version, as the store holds it.
 *
 * This suite opens a live database, so it is the DATABASE lane's; nothing here measures time.
 */
import { afterAll, beforeAll, expect, test } from "vitest";
import { lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, productModule, sql, stageRegisterCampaign, type StagedRegisterCampaign } from "../register-ui/support/register-ui-stage";

const BUDGET_MS = 900_000;

type DraftLine = { sheet?: string };
type RegisterSheet = { sheet: string; title: string; revision: string | null };
type DraftView = {
  campaignId: string | null;
  payload: {
    front?: { register?: RegisterSheet[]; edition?: { name: string; version: string } | null };
    sections: { groups: { items: { lines: DraftLine[] }[] }[] }[];
    unclassified: { lines: DraftLine[] };
  } | null;
};
type BoqServer = { boqViewOf(scope: { tenantId: string; projectId: string }): Promise<DraftView> };

let staged!: StagedRegisterCampaign;

beforeAll(async () => {
  staged = await stageRegisterCampaign("boq-front");
}, BUDGET_MS);

afterAll(async () => {
  await closeStage();
}, 120_000);

test(
  "the register lists each sheet the lines cite, once, in sheet-number order, with its title",
  async () => {
    const server = await productModule<BoqServer>("src/modules/takeoff/boq/server.ts");
    const view = await server.boqViewOf({ tenantId: staged.tenantId, projectId: staged.projectId });
    expect(view.payload, "the staged campaign drafts").not.toBeNull();
    const payload = view.payload as NonNullable<DraftView["payload"]>;
    const cited = new Set(
      [...payload.sections.flatMap((section) => section.groups.flatMap((group) => group.items.flatMap((item) => item.lines))), ...payload.unclassified.lines]
        .map((line) => line.sheet)
        .filter((sheet): sheet is string => sheet !== undefined),
    );
    expect(cited.size, "the staged lines cite the sheet their evidence stands on").toBeGreaterThan(0);

    const register = payload.front?.register ?? [];
    expect(register.map((one) => one.sheet)).toEqual([...cited].sort());
    for (const one of register) expect(one.title.trim(), `${one.sheet} carries the title its block states`).not.toBe("");
  },
  BUDGET_MS,
);

test(
  "the edition is the one the campaign was opened under, by its name and version",
  async () => {
    const server = await productModule<BoqServer>("src/modules/takeoff/boq/server.ts");
    const view = await server.boqViewOf({ tenantId: staged.tenantId, projectId: staged.projectId });
    const stored = sql(
      `select coalesce(t.name, p.name), coalesce(t.version, p.version)
         from campaigns c
         left join tenant_ruleset_editions t on t.edition_id = c.edition_id
         left join ruleset_editions p on p.edition_id = c.edition_id
        where c.campaign_id = ${lit(view.campaignId ?? "")}::uuid;`,
    )[0];
    expect(stored?.[0], "the campaign names an edition the store holds").toBeTruthy();
    expect(view.payload?.front?.edition).toEqual({ name: stored?.[0], version: stored?.[1] });
  },
  BUDGET_MS,
);
