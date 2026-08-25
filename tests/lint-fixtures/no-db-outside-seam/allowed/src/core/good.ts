// SEAM-TENANT: a core file beside the seam still reaches the database through it — the allowlist
// is the exact path, not the directory.
import { runAsSystem } from "./db";

export const system = runAsSystem("migration");
