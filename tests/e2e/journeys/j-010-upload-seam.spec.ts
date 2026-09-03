// J-010 — the upload leg of "upload DXF/DWG set", walked against the served product through the
// browser's own session (AC-1). This increment builds the seam and the gathering pattern; the
// S-Drawings screen that mounts the pattern on a project, the job timeline and the sheet cards are
// inc-108's, and its own `j-010-upload.spec.ts` walks them. This file walks what this increment
// ships: a session opened, interrupted, probed, resumed, and completed on the last byte.
//
// The gate runs `pnpm e2e --journey J-010`, and Playwright exits 1 on an unmatched grep — so the
// J-010 tag in the title below is what makes that stage runnable at all.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { SAuthPage, S_AUTH } from "../pages/s-auth.page";
import { SHomePage } from "../pages/s-home.page";
import { ShellPage, SHELL } from "../pages/shell.page";
import { UploadPage } from "../pages/upload.page";
import { checkpoint } from "../support/checkpoint";
import { newestMail } from "../support/outbox";

const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const EMAIL = `j010-${RUN}@cubit.test`;
const PASSWORD = `upload-journey-${RUN}`;
const WORKSPACE = "Sattva Drawings";
const PROJECT = "Sattva Court Drawings";

/** The corpus sheet this journey uploads, and the digest a browser would have declared for it. */
const FIXTURE = join(process.cwd(), "fixtures", "rcc6", "rcc6.dxf");

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-010 — a drawing is uploaded, interrupted, resumed and stored", () => {
  test("J-010: a member opens an upload, resumes it after an interruption, and the last byte stores one drawing", async ({ page, baseURL }, testInfo) => {
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();
    const origin = baseURL ?? "";
    const auth = new SAuthPage(page);
    const shell = new ShellPage(page);
    const home = new SHomePage(page);
    const uploads = new UploadPage(page);

    const bytes = readFileSync(FIXTURE);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const half = Math.floor(bytes.length / 2);
    const first = bytes.subarray(0, half);
    const rest = bytes.subarray(half);

    /* --- this journey's own identity, so its drawings never land in another spec's workspace --- */
    await auth.open(S_AUTH.signUp);
    await auth.signUpWith(EMAIL, PASSWORD, WORKSPACE);
    await auth.expectNotice();
    const verifyMail = await newestMail(EMAIL, "verify-email");
    await auth.openWithToken(S_AUTH.verify, verifyMail.token);
    await auth.expectNotice();
    await auth.open(S_AUTH.signIn);
    await auth.signInWith(EMAIL, PASSWORD);
    await expect(page).toHaveURL(`${origin}${SHELL.home}`);

    await shell.workspaceDoor.click();
    await expect(page).toHaveURL(new RegExp(`^${origin}/t/[0-9a-f-]{36}$`));

    /* --- a project of this workspace, made through the shipped screen --- */
    await home.createWith({ name: PROJECT, code: "SCD-001", client: "Sattva Holdings", district: "Dhaka", buildingType: 1, storeys: "12" });
    const card = home.cardNamed(PROJECT);
    await expect(card, "the created project stands on S-Home").toBeVisible();
    const projectId = (await card.getAttribute("data-project")) ?? "";
    expect(projectId, "the card names the project it is for").not.toBe("");

    /* --- j-010-upload-created: the session, opened by the signed-in member --- */
    const created = await uploads.create({ projectId, name: "rcc6.dxf", size: bytes.length, sha256: digest });
    expect(created.status, "POST /api/upload answers 201 to a member of the project's workspace").toBe(201);
    expect(created.body.uploadId ?? "", "the created session names itself").not.toBe("");
    expect(created.body.receivedBytes, "a session that has taken no bytes has received none").toBe(0);
    expect(created.body.chunkBytes ?? 0, "the session announces the chunk size it takes").toBeGreaterThan(0);
    const uploadId = created.body.uploadId ?? "";
    await checkpoint(page, testInfo, "j-010-upload-created");

    /* --- one chunk, then the interruption: nothing else is sent until the client has asked --- */
    const acknowledged = await uploads.send(uploadId, 0, first);
    expect(acknowledged.status, "a chunk offered from the offset the server holds is taken").toBe(200);
    expect(acknowledged.body.receivedBytes, "the server acknowledges exactly the bytes it took").toBe(first.length);

    /* --- j-010-upload-resumed: the probe a resuming client makes, and the chunk that follows it --- */
    const probed = await uploads.status(uploadId);
    expect(probed.status, "GET /api/upload/{uploadId} answers 200 while a transfer is open").toBe(200);
    expect(probed.body.receivedBytes, "the probe answers the length of the chunk that arrived").toBe(first.length);
    expect(probed.body.size, "and the size the session was opened for").toBe(bytes.length);
    expect(probed.body.complete, "an unfinished transfer is not complete").toBe(false);

    const misplaced = await uploads.send(uploadId, first.length + 1, rest);
    expect(misplaced.status, "a chunk offered from anywhere but that point is refused").toBe(409);
    expect(misplaced.body.refusal?.code, "and refused by the registered name").toBe("UPLOAD_NOT_RESUMABLE");
    expect((await uploads.status(uploadId)).body.receivedBytes, "a refused chunk adds nothing").toBe(first.length);
    await checkpoint(page, testInfo, "j-010-upload-resumed");

    /* --- j-010-upload-stored: the last byte --- */
    const completed = await uploads.send(uploadId, first.length, rest);
    expect(completed.status, "the last PATCH answers 200").toBe(200);
    expect(completed.body.complete, "the last byte completes the upload").toBe(true);
    expect(completed.body.receivedBytes, "every byte the session was opened for arrived").toBe(bytes.length);
    const drawing = uploads.onlyDrawing(completed);
    expect(drawing.name, "the drawing carries the name it was presented under").toBe("rcc6.dxf");
    expect(drawing.sha256, "the server's own digest of the staged bytes is the browser's digest of the file").toBe(digest);
    expect(drawing.format, "the format is the one the name and the content agree on").toBe("dxf");
    expect(drawing.duplicate, "the first upload of a content is not a duplicate").toBe(false);
    expect(completed.body.skipped, "one file in a format the product reads skips nothing").toEqual([]);
    await checkpoint(page, testInfo, "j-010-upload-stored");
  });
});
