// L-QTY-05's payload: the ABSENCE CLAUSE written somewhere the law bans it.
//
// "`NOT EXISTS` is lint-banned inside the channel module and appears once, in the residue query" —
// so a channel that asks what it cannot see, or a second query that spells its own absence, is a
// second home for the law. This file is what the committed scan is proved on
// (src/core/residue/__tests__/not-exists-scan.ts), not an ESLint rule: scripts/eslint/** is locked
// at M2, so the ban is the scan, exactly as the conversion factors were done.
//
// Every shape the spelling creeps back in as is a payload here: the SQL operator in a template
// literal, the same operator in either quote style, the camel-case helper name in code, and the
// operator written across a line break the way a formatted query carries it. Nothing in this file is
// imported by anything: it exists to be scanned.

export const absentFromTheRegister = `
  select r.class, r.level_id
    from register_objects r
   where NOT EXISTS (select 1 from quantity_lines q where q.object_key = r.object_key)
`;

export const sameAskInSingleQuotes = 'not exists (select 1 from placements p where p.class = $1)';

export const sameAskInDoubleQuotes = "NOT   EXISTS (select 1 from view_membership v where v.layout_name = $1)";

export function notExists(rows: readonly string[]): boolean {
  return rows.length === 0;
}

export const askedAgain = notExists([]);

export const brokenAcrossTheLine = `select 1 where not
 exists (select 1 from ingests)`;
