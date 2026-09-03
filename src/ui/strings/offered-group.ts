// R-SPINE-060: the offered-group pattern's own table. Copy fixed verbatim by
// docs/design/offered-group.md § 3; the label and the count are the consumer's data (I-78, I-79),
// and the act's own words live in the ConsequenceDialog the door opens.
export const offeredGroup = {
  offered_group_confirm: "Preview this group",
  offered_group_empty: "No groups are offered right now. A group appears as soon as the product can name what a set of subjects has in common.",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { offeredGroup as "offered-group" };
