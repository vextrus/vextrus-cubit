/**
 * AC-3 — `takeoffBoq.exportQuantities`, judged at the door itself and followed all the way to the
 * bytes a person downloads: live, against a scratch database the committed migrations built (V-DB,
 * R-TO-070, A-BOQ-XLSX, Q-12).
 *
 * Every entry point resolves actor, tenant, project, participation and permission through the one
 * guard before it reads or writes, and carries a live-database test that a caller without the
 * permission is refused BY NAME. This is that test for the quantities door, and it goes further,
 * because the door's answer is a LINK: the address it answers is the address of the bytes the
 * composer would build, and the shipped `GET /api/exports/[id]` serves exactly those bytes to the
 * member who asked for them.
 *
 * The campaign, the people and the published lines are the product's own: a project made through
 * its door, a set pinned by act (which opens the campaign), sightings at the register's door and
 * the gate publishing the rail's offers — the register workspace's stage, borrowed and never copied
 * (ARCH-02). The door is called through the router's own caller, because what is under judgement is
 * the guard the procedure runs and the answer it composes, not the wire beneath it.
 *
 * Nothing here spells a refusal code beside the register: every code is read from `REFUSALS`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  BOQ_NO_CAMPAIGN,
  BOQ_NO_PUBLISHED_LINE,
  BOQ_ROUTER_MODULE,
  CSV,
  EXPORTS_ROUTE_MODULE,
  MEASURE,
  PERMISSION_NOT_HELD,
  QUANTITIES_SHEET,
  REQUEST_MALFORMED,
  SERVER_MODULE,
  STORAGE_APP_MODULE,
  XLSX,
  csvLines,
  exportsSeam,
  openWorkbook,
  serverModule,
  sheetNames,
  specModule,
  type ExportsSeam,
} from "./support/boq-xlsx-stage";
import {
  REFUSAL_MARKER_MODULE,
  closeStage,
  productModule,
  refusalRegister,
  rejection,
  stagePerson,
  stageRegisterCampaign,
  stageReviewer,
  type Person,
  type StagedRegisterCampaign,
} from "../register-ui/support/register-ui-stage";
import { stageCampaign } from "../rails/support/column-rail-stage";
import { grantRole } from "../support/sheets-stage";

/** The role that holds MEASURE and nothing a principal would have handed it by accident (L-ACT-03). */
const MEASURER = "MEASURER";

/** What the door answers: a link, its address and the kind it addresses (interfaces). */
type QuantitiesLink = { url: string; sha256: string; kind: string };

/** The shipped route that serves an address, as a browser reaches it. */
type ExportsRoute = { GET: (request: Request, address?: { params: Promise<Record<string, string>> }) => Promise<Response> };

/** Any door of the BOQ lane, as a caller wearing one person's session reaches it. */
type BoqDoor = Record<string, (input: unknown) => Promise<unknown>>;

let staged!: StagedRegisterCampaign;
let seam!: ExportsSeam;
let storage!: unknown;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
let staging: Promise<void> | undefined;
const ready = (): Promise<void> => (staging ??= stage());

async function stage(): Promise<void> {
  staged = await stageRegisterCampaign("boq-xlsx");
  seam = await exportsSeam();
  const app = await productModule<{ appStorage: () => unknown }>(STORAGE_APP_MODULE);
  storage = app.appStorage();
}

afterAll(async () => {
  await closeStage();
});

/** The BOQ lane's doors, as this person's session reaches them (the register workspace's shape). */
async function doorFor(person: Person): Promise<BoqDoor> {
  const router = await productModule<{ takeoffBoqRouter?: { createCaller: (ctx: unknown) => BoqDoor } }>(BOQ_ROUTER_MODULE);
  expect(typeof router.takeoffBoqRouter?.createCaller, `${BOQ_ROUTER_MODULE} publishes the BOQ lane's router`).toBe("function");
  const here = "http://127.0.0.1";
  return (router.takeoffBoqRouter as { createCaller: (ctx: unknown) => BoqDoor }).createCaller({
    requestId: randomUUID(),
    actor: "an-account",
    origin: here,
    statedOrigin: null,
    requestOrigin: here,
    deviceLabel: "acceptance",
    client: "an unobserved caller",
    session: { sessionId: randomUUID(), userId: person.userId },
    secureCookies: false,
    cookies: [],
  });
}

/**
 * The quantities door itself, asserted to be ON THE ROUTER before it is called.
 *
 * A caller is a proxy — every name on it is a function, and a door that does not exist answers
 * `typeof` exactly as one that does — so the question is asked of the router's own procedure table
 * instead, which is the one place a tRPC lane says what it publishes (test contract).
 */
async function quantitiesDoor(person: Person): Promise<(input: unknown) => Promise<unknown>> {
  const router = await productModule<{ takeoffBoqRouter?: { _def?: { procedures?: Record<string, unknown> } } }>(BOQ_ROUTER_MODULE);
  const published = Object.keys(router.takeoffBoqRouter?._def?.procedures ?? {});
  expect(published, "takeoffBoq.exportQuantities is on the wire — the door this increment lands (test contract)").toContain("exportQuantities");
  const caller = await doorFor(person);
  return caller["exportQuantities"] as (input: unknown) => Promise<unknown>;
}

/** The registered code a refusal carries, read off the register rather than spelled here (Q-07). */
async function registeredCode(name: string): Promise<string> {
  const register = await refusalRegister();
  const entry = register[name];
  expect(entry?.code, `the register publishes ${name} — this lane answers by its registered code`).toBe(name);
  return entry?.code ?? "";
}

/**
 * What the door refused with, where it refused — an answer instead of a refusal is a failure here.
 *
 * The code is read off the failure by the PRODUCT's own marker (`refusalCodeOf`), not by a reading
 * of anybody's source: a refusal is a marked rejection, and a transport that wrapped it carries the
 * marker on its cause (ARCH-03).
 */
async function refusalOf(work: Promise<unknown>, what: string): Promise<string | null> {
  const thrown = await rejection(work);
  expect(thrown, `${what} must be refused, and the door answered instead`).not.toBeNull();
  const marker = await productModule<{ refusalCodeOf: (failure: unknown) => string | null }>(REFUSAL_MARKER_MODULE);
  const direct = marker.refusalCodeOf(thrown);
  if (direct !== null) return direct;
  const cause = (thrown as { cause?: unknown } | null)?.cause;
  return cause === undefined ? null : marker.refusalCodeOf(cause);
}

/** The person the staged campaign belongs to, who holds every permission on their own project. */
function principal(): Person {
  return staged.person;
}

/** The link the door answers, asserted to be the shape the interfaces publish before it is read. */
function linkOf(answered: unknown, kind: string): QuantitiesLink {
  const link = answered as QuantitiesLink;
  expect(typeof link?.url, `the door answers a url for the ${kind} it built`).toBe("string");
  expect(typeof link?.sha256, `the door answers the address the bytes are stored at (R-SPINE-021)`).toBe("string");
  expect(link?.kind, "and says which kind it answered for").toBe(kind);
  return link;
}

/** The request a browser makes of the shipped route, wearing this person's own session. */
async function download(url: string, person: Person): Promise<Response> {
  const route = await productModule<ExportsRoute>(EXPORTS_ROUTE_MODULE);
  const parsed = new URL(url, "http://127.0.0.1");
  const id = parsed.pathname.slice(parsed.pathname.lastIndexOf("/") + 1);
  return route.GET(new Request(parsed, { headers: { cookie: person.cookie } }), { params: Promise.resolve({ id }) });
}

describe("AC-3: the quantities door is guarded, and its link serves the bytes it addresses", () => {
  it("AC-3: refuses a participant who does not hold MEASURE, by name", async () => {
    await ready();
    const reviewer = await stageReviewer(staged, "boq-xlsx-reviewer");
    const door = await quantitiesDoor(reviewer);

    const code = await refusalOf(door({ projectId: staged.projectId, kind: XLSX }), `a participant holding no ${MEASURE} asking for the quantities`);
    expect(code, `a reviewer holds no ${MEASURE}, so the one guard refuses this door before it reads anything (L-ACT-03)`).toBe(await registeredCode(PERMISSION_NOT_HELD));
  }, 600_000);

  it("AC-3: refuses a MEASURER whose project has no campaign, by the register's own code", async () => {
    await ready();
    const { person, projectId } = await stagePerson("boq-xlsx-no-campaign");
    grantRole(person.tenantId, projectId, person.userId, MEASURER);
    const door = await quantitiesDoor(person);

    const code = await refusalOf(door({ projectId, kind: XLSX }), "a MEASURER asking for the quantities of a project with no campaign");
    expect(code, "there is no register to export from, and a workbook of nothing is not evidence (R-SPINE-062)").toBe(await registeredCode(BOQ_NO_CAMPAIGN));
  }, 600_000);

  it("AC-3: refuses a MEASURER whose campaign published no line, by the register's own code", async () => {
    await ready();
    const empty = await stageCampaign("boq-xlsx-empty", { objects: 0 });
    const door = await quantitiesDoor(empty.person);

    const code = await refusalOf(door({ projectId: empty.projectId, kind: XLSX }), "a MEASURER asking for the quantities of a campaign that published nothing");
    expect(code, "a campaign with no published line has no quantities to write (R-SPINE-062, B-21)").toBe(await registeredCode(BOQ_NO_PUBLISHED_LINE));
  }, 600_000);

  it("AC-3: refuses a statement naming a kind this seam does not write", async () => {
    await ready();
    const door = await quantitiesDoor(principal());
    const unwritable = "pdf";
    expect(seam.EXPORT_KINDS, `the seam writes ${JSON.stringify(seam.EXPORT_KINDS)} and ${unwritable} is not one of them`).not.toContain(unwritable);

    const code = await refusalOf(door({ projectId: staged.projectId, kind: unwritable }), `a statement asking for a ${unwritable}`);
    expect(code, "a statement this lane cannot read is a refusal, never a 500 (ARCH-03, B-21)").toBe(await registeredCode(REQUEST_MALFORMED));
  }, 600_000);

  for (const kind of [XLSX, CSV]) {
    it(`AC-3: answers a signed link at the address of the ${kind} the composer builds`, async () => {
      await ready();
      const person = principal();
      const door = await quantitiesDoor(person);
      const link = linkOf(await door({ projectId: staged.projectId, kind }), kind);

      // The address is the artefact's own: the bytes the composer builds for this campaign, hashed
      // as SEAM-STORAGE hashes them. A door that stored something else would answer another address.
      const composition = await serverModule();
      expect(typeof composition.boqExportReadingOf, `${SERVER_MODULE} publishes \`boqExportReadingOf\``).toBe("function");
      expect(typeof composition.buildBoqExport, `${SERVER_MODULE} publishes \`buildBoqExport\``).toBe("function");
      const reading = await composition.boqExportReadingOf({ tenantId: staged.tenantId, projectId: staged.projectId });
      expect(reading, "the staged campaign published lines, so a reading of it stands").not.toBeNull();
      const built = await composition.buildBoqExport(reading as NonNullable<typeof reading>, kind);
      expect(link.sha256, `the ${kind} the door stored is the ${kind} the composer builds from this campaign (R-SPINE-021)`).toBe(seam.exportAddress(built));

      // The link is the storage seam's own spelling at this product's route — never a second URL
      // shape minted beside it (Q-12).
      const base = "http://127.0.0.1";
      const answered = new URL(link.url, base);
      const minted = new URL(seam.exportDownloadUrl(storage, { tenantId: staged.tenantId, sha256: link.sha256, kind, expiresInSeconds: 900 }), base);
      expect(answered.pathname, "the link names the artefact's own address under the download route").toBe(minted.pathname);
      expect(answered.pathname, "which is the sha256 the door answered").toBe(`/api/exports/${link.sha256}`);
      expect([...answered.searchParams.keys()], "and carries the fields exportDownloadUrl writes, in its own order").toEqual([...minted.searchParams.keys()]);
      expect(answered.searchParams.get("tenant"), "the workspace the artefact belongs to").toBe(staged.tenantId);
      expect(answered.searchParams.get("kind"), "the kind the bytes are").toBe(kind);
      expect(Number(answered.searchParams.get("expires")), "the link expires (Q-12)").toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(answered.searchParams.get("signature"), "and is signed, in hex, by the one signer").toMatch(/^[0-9a-f]+$/u);
    }, 600_000);

    it(`AC-3: the shipped GET serves that ${kind} to the member who asked for it`, async () => {
      await ready();
      const person = principal();
      const door = await quantitiesDoor(person);
      const link = linkOf(await door({ projectId: staged.projectId, kind }), kind);

      const answer = await download(link.url, person);
      expect(answer.status, `the member of the workspace that stored the ${kind} is served it`).toBe(200);
      expect(answer.headers.get("content-type"), `the ${kind} travels as the media type the seam's one table names`).toBe(seam.MIME_OF_KIND[kind]);

      const bytes = new Uint8Array(await answer.arrayBuffer());
      expect(bytes.length, "the body is the artefact, not an empty answer").toBeGreaterThan(0);

      if (kind === XLSX) {
        // "XLSX export opens with formulas" (J-030): the bytes a person downloads open as a
        // workbook, and the sheet every line of the campaign stands on is in it.
        const workbook = await openWorkbook(bytes);
        expect(sheetNames(workbook), `the downloaded workbook carries the ${QUANTITIES_SHEET} sheet (A-BOQ-XLSX)`).toContain(QUANTITIES_SHEET);
      } else {
        const composer = await specModule();
        const composition = await serverModule();
        const reading = await composition.boqExportReadingOf({ tenantId: staged.tenantId, projectId: staged.projectId });
        const sheet = composer.boqQuantitiesSheetOf(reading as NonNullable<typeof reading>);
        expect(csvLines(bytes)[0], "the CSV opens with the Quantities sheet's own header — it IS that sheet, as interchange (R-TO-070)").toBe(
          sheet.columns.map((column) => column.header).join(","),
        );
      }
    }, 600_000);
  }
});
