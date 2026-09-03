// @vitest-environment node
/**
 * The session doors against the rows they write (R-SPINE-001, R-SPINE-002): what resolving a cookie
 * costs on the hot path, what revoke answers for an id it did not touch, and what the creating door
 * stores as a personal workspace's name.
 *
 * A private scratch database from the db lane's harness, imported first because it reads
 * DATABASE_URL at load. Values that must be compared byte for byte — a name whose trailing space is
 * the point — are compared inside postgres, because psql's text output is trimmed per line.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { BOOTSTRAP_URL } from "../../../db/__tests__/support/fixtures";
import { isTrue, lit, run, scalar } from "../../../db/__tests__/support/live-sql";
import { closePools } from "../../core/db";
import { pruneWhenDue } from "./prune";
import {
  LAST_SEEN_RESOLUTION_MS,
  listSessions,
  mailedAddress,
  resolveSession,
  revokeSession,
  signIn,
  signUp,
  type AuthSession,
} from "./session";

let scratch: ScratchDb;
let admin: string;

const ORIGIN = process.env["CUBIT_PUBLIC_ORIGIN"] ?? "";
const PASSWORD = "correct-horse-battery-staple-9";

/** A byte no `text` column can carry, built without spelling an escape into a source file. */
const NUL = String.fromCharCode(0);

/** Sign up a fresh account, and answer the mark its address carries plus the session it was given. */
async function newAccount(tenantName: string): Promise<{ mark: string; email: string; sessionToken: string }> {
  const mark = randomUUID();
  const email = `verifier-${mark}@example.test`;
  const { sessionToken } = await signUp({
    email,
    password: PASSWORD,
    tenantName,
    deviceLabel: "verifier",
    origin: ORIGIN,
    requestId: `req-${mark}`,
  });
  return { mark, email, sessionToken };
}

/** The name the door stored for this account's personal workspace, judged inside postgres. */
function storedWorkspaceName(mark: string, expected: string): { matches: boolean; shown: string } {
  const [row] = run(
    admin,
    `select (t.name = ${lit(expected)})::text, '[' || t.name || ']'
       from tenants t
       join memberships m on m.tenant_id = t.tenant_id
       join users u on u.user_id = m.user_id
      where u.email like ${lit(`%${mark}%`)};`,
  );
  if (row === undefined) throw new Error(`no workspace was created for the account marked ${mark}`);
  return { matches: isTrue(row[0] ?? ""), shown: row[1] ?? "" };
}

function lastSeenOf(sessionId: string): string {
  return scalar(admin, `select last_seen_at::text from sessions where session_id = ${lit(sessionId)};`);
}

beforeAll(async () => {
  scratch = await provisionScratchDb();
  process.env["DATABASE_URL"] = scratch.urlApp;
  const url = new URL(BOOTSTRAP_URL);
  url.pathname = new URL(scratch.urlApp).pathname;
  admin = url.toString();
  expect(ORIGIN, "the harness names the address this deployment answers at").not.toBe("");
}, 240_000);

afterAll(async () => {
  await pruneWhenDue();
  await closePools();
  await scratch.drop();
}, 240_000);

describe("resolving a cookie stamps last-seen at most once a resolution window", () => {
  test("AC-3(a): a stale session is stamped once, and the next resolution leaves the stamp alone", async () => {
    expect(typeof LAST_SEEN_RESOLUTION_MS, "session.ts publishes the window a last-seen stamp is held to").toBe("number");
    const account = await newAccount(`Workspace ${randomUUID()}`);
    const session = await resolveSession(account.sessionToken);
    expect(session, "the token the door answered with resolves").not.toBeNull();
    const { sessionId } = session as AuthSession;

    scalar(
      admin,
      `update sessions set last_seen_at = now() - interval '1 millisecond' * ${Math.round(2 * LAST_SEEN_RESOLUTION_MS)}
        where session_id = ${lit(sessionId)} returning session_id;`,
    );
    const stale = lastSeenOf(sessionId);

    await resolveSession(account.sessionToken);
    const stamped = lastSeenOf(sessionId);
    expect(stamped, "a last-seen older than the resolution window is stamped forward").not.toBe(stale);

    await resolveSession(account.sessionToken);
    expect(lastSeenOf(sessionId), "a second resolution inside the window writes nothing").toBe(stamped);
  });
});

describe("revoke answers for what it revoked", () => {
  test("AC-3(b): an id the caller holds is answered, an id it does not name is null, and the list survives both", async () => {
    const account = await newAccount(`Workspace ${randomUUID()}`);
    await signIn({ email: account.email, password: PASSWORD, deviceLabel: "second device", client: `client-${account.mark}` });

    const session = (await resolveSession(account.sessionToken)) as AuthSession;
    const held = (await listSessions(session)).map((row) => row.id).sort();
    expect(held.length, "the account is signed in on the device it signed up with and the one it signed in on").toBe(2);

    expect(await revokeSession(session, "not-a-uuid"), "an id no session could have is revoked by nothing").toEqual({ revoked: null });
    expect((await listSessions(session)).map((row) => row.id).sort(), "and the list is untouched").toEqual(held);

    const stranger = randomUUID();
    expect(await revokeSession(session, stranger), "a well-formed id naming no row of the caller's is revoked by nothing").toEqual({ revoked: null });
    expect((await listSessions(session)).map((row) => row.id).sort(), "and the list is untouched").toEqual(held);

    const other = held.find((id) => id !== session.sessionId) as string;
    expect(await revokeSession(session, other), "the caller's own other session is answered by its id").toEqual({ revoked: other });
    expect((await listSessions(session)).map((row) => row.id), "and it is gone from the list").toEqual([session.sessionId]);
  });
});

describe("the creating door stores the name it was given", () => {
  test("AC-4(a): a whitespace-only name is the address the account was made with; a presented name is stored as presented", async () => {
    for (const blank of ["   ", "\t\n"]) {
      const account = await newAccount(blank);
      const named = storedWorkspaceName(account.mark, mailedAddress(account.email));
      expect(named.matches, `a workspace named ${JSON.stringify(blank)} takes the address instead: got ${named.shown}`).toBe(true);
    }

    const presented = "Acme Works ";
    const account = await newAccount(presented);
    const named = storedWorkspaceName(account.mark, presented);
    expect(named.matches, `a name the person presented is stored exactly as presented: got ${named.shown}`).toBe(true);
  });

  test("AC-4(b): a name carrying a byte postgres cannot store keeps what is left of it, and falls back only when nothing is left", async () => {
    const carried = await newAccount(`Acme ${NUL}Works`);
    const kept = storedWorkspaceName(carried.mark, "Acme Works");
    expect(kept.matches, `the unstorable byte is dropped and the rest of the name is kept: got ${kept.shown}`).toBe(true);

    const nothingLeft = await newAccount(` ${NUL} `);
    const fallen = storedWorkspaceName(nothingLeft.mark, mailedAddress(nothingLeft.email));
    expect(fallen.matches, `a name with nothing storable left in it takes the address: got ${fallen.shown}`).toBe(true);
  });
});
