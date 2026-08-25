// AC-1, the half of the seam surface that owes no database: what `@/core/db` exports, and what
// runAsSystem does with a reason that is not one (SEAM-TENANT).
//
// The seam is loaded lazily and once, not in a beforeAll hook: a hook that throws leaves every test
// in the file skipped, and a criterion nothing ran against is a criterion nothing judged.
import { describe, expect, it } from "vitest";
import { loadSeam, seamFn, tenantDb, type Seam } from "./support/seam";

let loading: Promise<Seam> | undefined;

/** A syntactically valid URL so the module loads; nothing in this file opens a connection. */
const seam = (): Promise<Seam> => (loading ??= loadSeam());

describe("SEAM-TENANT: the seam's exported surface", () => {
  it("AC-1: @/core/db exports forTenant(ctx) and runAsSystem(reason)", async () => {
    const db = await seam();
    expect(typeof db.forTenant, "@/core/db must export forTenant(ctx: { tenantId: string }): TenantDb").toBe("function");
    expect(typeof db.runAsSystem, "@/core/db must export runAsSystem(reason: string): SystemDb").toBe("function");
  });

  it("AC-1: a TenantDb offers the drizzle read/write surface", async () => {
    const handle = tenantDb(await seam(), "00000000-0000-0000-0000-000000000000");
    expect(typeof handle, "forTenant(ctx) must answer with a handle").toBe("object");
    expect(typeof handle.select, "a TenantDb must expose drizzle's read surface (db.select)").toBe("function");
    expect(typeof handle.insert, "a TenantDb must expose drizzle's write surface (db.insert)").toBe("function");
    expect(typeof handle.execute, "a TenantDb must expose drizzle's raw surface (db.execute), the channel its session is read through").toBe("function");
  });

  it("AC-1: runAsSystem refuses an empty or whitespace reason, before any connection is used", async () => {
    const runAsSystem = seamFn((await seam()).runAsSystem, "runAsSystem(reason)");
    // Synchronously: a refusal thrown after a connection was opened could not be thrown by the call
    // itself. runAsSystem's reason is never validated-then-discarded (SEAM-TENANT).
    for (const reason of ["", " ", "\t", "\n  \t "]) {
      expect(() => runAsSystem(reason), `runAsSystem(${JSON.stringify(reason)}) must throw — an empty reason is not attributable`).toThrow();
    }
  });

  it("AC-1: runAsSystem answers with a handle when the reason is a real one", async () => {
    const handle = seamFn((await seam()).runAsSystem, "runAsSystem(reason)")("test: the seam's surface answers");
    expect(typeof handle, "runAsSystem(reason) must answer with a SystemDb handle").toBe("object");
    expect(typeof handle.execute, "a SystemDb must expose drizzle's raw surface (db.execute)").toBe("function");
  });
});
