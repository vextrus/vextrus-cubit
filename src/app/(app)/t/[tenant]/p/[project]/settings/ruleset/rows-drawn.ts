"use client";
// How many rows a settings grid region DREW, read from the one place that knows it (B-17, the
// S-Documents and levels precedent). The shipped DataTable windows its rows once the list is long
// enough and publishes the number it in fact put in the document; a region carries the id a retrying
// read waits on, so it repeats the table's own number rather than restating the length of the data it
// handed over.
//
// The Rule set screen's two grids and the Author edition screen's diff are the settings area's grid
// regions (s-settings-ruleset I-349), so the mirror lives once beside them rather than inside each.
import { useEffect, useState, type RefObject } from "react";

/** The attribute the table publishes its drawn-row count under (the settle contract's own word). */
const ROWS_DRAWN = "data-rows-rendered";

/**
 * The count the table inside `region` says it drew — or `rows`, the length handed to it, until the
 * table has said anything (the server's paint, a suite without a table).
 */
export function useRowsDrawn(region: RefObject<HTMLElement | null>, rows: number): number {
  const [drawn, setDrawn] = useState(rows);
  useEffect(() => {
    const host = region.current;
    if (host === null) return;
    const read = (): void => {
      const said = host.querySelector(`[${ROWS_DRAWN}]`)?.getAttribute(ROWS_DRAWN);
      const count = said === null || said === undefined ? Number.NaN : Number(said);
      setDrawn(Number.isFinite(count) ? count : rows);
    };
    read();
    if (typeof MutationObserver === "undefined") return;
    const watch = new MutationObserver(read);
    watch.observe(host, { attributes: true, attributeFilter: [ROWS_DRAWN], subtree: true, childList: true });
    return () => watch.disconnect();
  }, [region, rows]);
  return drawn;
}
