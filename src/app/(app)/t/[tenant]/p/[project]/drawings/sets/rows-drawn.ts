"use client";
// How many rows a grid region DREW, read from the one place that knows it (B-17, the S-Documents
// and levels precedent). The shipped DataTable windows its rows once the list is long enough and
// publishes the number it in fact put in the document; a screen's region carries the id a retrying
// read waits on, so it repeats the table's own number rather than restating the length of the data
// it handed over.
//
// Both screens of S-Drawings-Sets have a grid region now (I-285, I-286), so the hook lives once
// beside them rather than twice inside them.
import { useEffect, useState, type RefObject } from "react";

/** The attribute the table publishes its drawn-row count under. */
const ROWS_DRAWN = "data-rows-rendered";

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
    const watch = new MutationObserver(read);
    watch.observe(host, { attributes: true, attributeFilter: [ROWS_DRAWN], subtree: true, childList: true });
    return () => watch.disconnect();
  }, [region, rows]);
  return drawn;
}
