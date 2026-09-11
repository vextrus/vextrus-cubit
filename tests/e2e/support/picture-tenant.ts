// THE PICTURE TENANT (AM-09 §4, Design Direction 00 §9.3).
//
// "Picture tests run against the fixed picture tenant and the frozen fixture, never against a
// freshly generated project." The reason is the magenta masks. Every baseline in this lane today
// paints over the parts of the frame that change between runs — a per-run email address, a
// last-activity date, a generated id — and a mask is a hole in the evidence: the founder's read of
// the stills was right partly BECAUSE the masks hid the thing being judged. A tenant whose ids,
// names and clock are literals needs no masks, because nothing in its frame moves.
//
// Everything here is a LITERAL, and deliberately so: a derived id is an id that changes when the
// derivation changes, and then the pictures change with it. The UUIDs are in the `f1c7u2e0` family
// so a row found in a database by hand is recognisable as this fixture's and nobody's customer.
//
// THIS TENANT IS OFF BY DEFAULT. It is provisioned only under `CUBIT_E2E_PICTURE=1`, so a journey
// run that did not ask for pictures meets exactly the database it met before (the gate the brief
// asks for: no behaviour change to an existing journey).
import { test as baseTest, type Page } from "@playwright/test";

/** The frozen instant every picture is taken at: 2026-03-01 10:00 Asia/Dhaka, stated in UTC. */
export const PICTURE_CLOCK = "2026-03-01T04:00:00.000Z";

/** The workspace, the project, the account — ids and names, all literal, all frozen. */
export const PICTURE_TENANT = Object.freeze({
  tenantId: "f1c70000-0000-4000-8000-000000000001",
  projectId: "f1c70000-0000-4000-8000-000000000002",
  userId: "f1c70000-0000-4000-8000-000000000003",
  drawingId: "f1c70000-0000-4000-8000-000000000004",
  sheetId: "f1c70000-0000-4000-8000-000000000005",
  /** The account the pictures are taken as. Fixed, so `shell-user` needs no mask. */
  email: "surveyor@picture.cubit.test",
  password: "picture-tenant-fixed-password",
  /** What the frame reads, top left to bottom right. */
  workspaceName: "Meghna Works",
  projectName: "Riverside Tower",
  projectCode: "RT-01",
  client: "Meghna Holdings",
  siteAddress: "Plot 14, Gulshan Avenue",
  district: "Dhaka",
  /** The sheet and the lines the register and the viewer paint in a still. */
  sheetName: "A-101 — Foundation Plan",
  lineNames: Object.freeze(["Substructure — Excavation", "Substructure — Blinding", "Substructure — Pile cap"]),
});

/** The picture tenant's own address, for a journey that navigates to it without a sign-in leg. */
export const PICTURE_ROUTES = Object.freeze({
  workspace: `/t/${PICTURE_TENANT.tenantId}`,
  project: `/t/${PICTURE_TENANT.tenantId}/p/${PICTURE_TENANT.projectId}`,
});

/**
 * The frozen clock, injected into the BROWSER CONTEXT rather than into the product: a picture is a
 * picture of what a reader sees, and what a reader sees is what `new Date()` answered in their tab.
 * `page.clock.setFixedTime` pins that answer without stopping timers, so a screen that polls still
 * polls and only its idea of "now" is fixed — which is what keeps "2 minutes ago" from moving
 * between two runs of the same still.
 *
 * Off unless the run asked for pictures, so an existing journey's clock is untouched.
 */
export async function freezeClock(page: Page): Promise<void> {
  if (process.env["CUBIT_E2E_PICTURE"] !== "1") return;
  await page.clock.setFixedTime(PICTURE_CLOCK);
}

/**
 * The journeys' `test`, with the picture clock installed before the first navigation. A picture spec
 * imports `test` from here; every other journey imports it from `@playwright/test` and meets the
 * lane it always met.
 */
export const pictureTest = baseTest.extend({
  page: async ({ page }, use: (page: Page) => Promise<void>) => {
    await freezeClock(page);
    await use(page);
  },
});
