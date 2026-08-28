// The model-call ledger's tables, read back out of the seam. The builders themselves are lawful only
// in src/core/db.ts (SEAM-TENANT); this file is where drizzle-kit, the drift lane and the live suite
// see them (ARCH-02).
export { modelCalls, modelFixtures } from "../../src/core/db";
