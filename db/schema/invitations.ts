// R-SPINE-003's invitations, as the schema tree offers them to drizzle-kit. The definition itself
// lives in the seam: the ORM's table builders are a driver import, and src/core/db.ts is their one
// lawful home (SEAM-TENANT). This file is where the generator and the drift lane read it back.
//
// It is published under the workspace's own name for it, because the table is the tenancy module's
// row and nothing outside that module mints one: the name a scan of the tree looks for is this one,
// and the core symbol it is bound from is reachable only through the module (B-17).
import { invitations } from "../../src/core/db";

export const workspaceInvitations = invitations;
