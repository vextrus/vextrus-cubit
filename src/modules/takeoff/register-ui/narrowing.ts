// The register narrowed to what a link names, as an address (s-coverage I-484, s-takeoff
// I-172): the three narrowings a link may set — class, kind and level — spelled once, for the screen
// that writes the address (the coverage cell's "Open the register") and the register that reads it
// back into its filter chips. Two spellings of one query were two answers to which rows a link shows
// (B-17): the coverage screen wrote `?class=&kind=&level=` and the register read none of it.
//
// Free of the store and of React, so both browser screens import it without carrying either.

/** The narrowings an address may carry, by the query names both screens read — in the order written. */
export const NARROWING_PARAMS = ["class", "kind", "level"] as const;

/** One value per narrowing, as the register's filters hold them: empty is the all-option. */
export type Narrowing = { readonly [name in (typeof NARROWING_PARAMS)[number]]: string };

/**
 * The query that narrows the register to what is named — the stored values the register's rows
 * carry (the class and kind keys, the level's label or its slot), never their words — with every
 * empty narrowing left out.
 */
export function narrowingQuery(narrowing: Partial<Narrowing>): string {
  const query = new URLSearchParams();
  for (const name of NARROWING_PARAMS) {
    const value = narrowing[name] ?? "";
    if (value !== "") query.set(name, value);
  }
  return query.toString();
}

/** The narrowings an address's query carries; one it does not name reads as the all-option. */
export function narrowingOf(search: string): Narrowing {
  const query = new URLSearchParams(search);
  return { class: query.get("class") ?? "", kind: query.get("kind") ?? "", level: query.get("level") ?? "" };
}

/** Whether an address names any narrowing at all. */
export function narrows(narrowing: Narrowing): boolean {
  return NARROWING_PARAMS.some((name) => narrowing[name] !== "");
}
