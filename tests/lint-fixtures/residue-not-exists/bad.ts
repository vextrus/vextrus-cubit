// L-QTY-05's payload: `NOT EXISTS` written where the residue's law forbids it. The ban has one
// exception — the residue query itself — so every OTHER spelling of it is a second home for the
// judgement "this is absent", which is exactly what a channel reader may never make. Every shape
// below is a way one creeps back in: the straight SQL spelling, the lower-case one a driver accepts
// just as happily, a mixed-case one, and drizzle's own `notExists` operator (Q-08). Nothing in this
// file is imported by anything: it exists to be scanned.
//
// This corpus proves a committed SCAN (src/core/residue/__tests__/not-exists-scan.test.ts), not an
// ESLint rule: `scripts/eslint/**` is locked at M2, so the ban is the scan test — the
// `view-type-literals` precedent. The scan is expected to report every line marked below.

/** Drizzle's operator, stood in for here so the payload carries its shape without a dependency. */
function notExists(fragment: string): string {
  // RECORDED REASON L-QTY-05
  return `(${fragment}) is null`;
}

export const sqlUpperCase = `select 1 from sightings s where NOT EXISTS (select 1 from quantity_lines l where l.class = s.class)`; // RECORDED REASON L-QTY-05

export const sqlLowerCase = "select 1 from bears b where not exists (select 1 from sightings s where s.class = b.class)"; // RECORDED REASON L-QTY-05

export const sqlMixedCase = `select 1 from levels v where Not Exists (select 1 from placements p where p.level_id = v.id)`; // RECORDED REASON L-QTY-05

export function inADrizzleFragment(inner: string): string {
  return notExists(inner); // RECORDED REASON L-QTY-05
}

export const insideALargerStatement = `
  select c.kind, c.class
  from cells c
  where NOT EXISTS (select 1 from declarations d where d.kind = c.kind)
`; // RECORDED REASON L-QTY-05
