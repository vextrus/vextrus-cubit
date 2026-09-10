// R-SPINE-060: the Trace affordance's own copy (docs/design/evidence-link.md § 3). One sentence —
// the purpose, shown on hover for a reader who meets a mono key in a table and needs to know what
// following it does. It is never the accessible name: the name stays the key itself.
export const evidenceLink = {
  evidence_link_title: "Trace to the sheet",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { evidenceLink as "evidence-link" };
