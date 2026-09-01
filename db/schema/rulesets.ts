// The immutable rule-set edition store (L-MEA-01, L-REG-07), as the schema tree offers it to
// drizzle-kit. The definitions themselves live in the seam: the ORM's table builders are a driver
// import, and src/core/db.ts is their one lawful home (SEAM-TENANT). This file is where the
// generator and the drift lane read them back.
export { rulesetEditions, rulesetScope, tenantRulesetEditions } from "../../src/core/db";
