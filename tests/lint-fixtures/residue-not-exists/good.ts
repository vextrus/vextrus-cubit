// The lawful half of the corpus: everything here stands beside the absence clause without spelling
// one where the law bans it, so the scan must report nothing at all in this file.
//
// Three shapes the scan has to see past, and the reason each is lawful:
//  - prose: NOT EXISTS and notExists are both written in this comment, and a comment is not code
//    (Q-17) — the tree's one lexer drops it before anything is counted;
//  - a channel that answers with what it SAW: a recogniser's output type is `Sighting[]`, empty when
//    the channel saw nothing, so absence is the caller's arithmetic and never the channel's query;
//  - ordinary SQL that names only what it reads — an EXISTS on its own states no absence.
//
// Nothing here reaches out of its own directory: this file is linted as though it stood in the
// layered tree, and a fixture that tripped a boundary rule would be proving somebody else's NEVER.

export type SightingRow = { class: string; levelId: string | null; sourceKey: string };

export const sightedClasses = `
  select r.class, r.level_id, r.placement_key
    from register_objects r
   where r.set_revision_id = $1
`;

export const alsoSighted = "select 1 from placements p where exists (select 1 from member_types m where m.family = p.family)";

/** What the channel saw, as an array — empty when it saw nothing. */
export function sightedIn(rows: readonly SightingRow[]): readonly SightingRow[] {
  return rows.filter((row) => row.sourceKey !== "");
}

export const sawNothing: readonly SightingRow[] = sightedIn([]);

export const unionOfWhatWasSeen = (a: readonly SightingRow[], b: readonly SightingRow[]): readonly SightingRow[] => [...a, ...b];
