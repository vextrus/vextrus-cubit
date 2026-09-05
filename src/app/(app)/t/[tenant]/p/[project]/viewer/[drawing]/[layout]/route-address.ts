// S-Viewer's own address, spelled once (B-17): the path the sheet index's door points at, and the
// path this route answers. A layout name is a sheet's own words — `FOUNDATION PLAN` carries a space
// — so it is escaped as one path segment here rather than at each call site (R-UI-031).
export function viewerSheetRoute(tenantId: string, projectId: string, drawingId: string, layoutName: string): string {
  return `/t/${tenantId}/p/${projectId}/viewer/${drawingId}/${encodeURIComponent(layoutName)}`;
}

/** One percent escape, and a run of them — the sequences a percent-decoding reads. */
const ESCAPE = /%[0-9A-Fa-f]{2}/g;
const ESCAPES = /(?:%[0-9A-Fa-f]{2})+/g;

/**
 * The sheet a `[layout]` segment names. Next 16 hands a *page* its dynamic segments exactly as the
 * path spells them — `FOUNDATION%20PLAN`, not `FOUNDATION PLAN` — while a route handler is given
 * them already decoded, so reading the segment is the screen's own job and has one home here
 * (B-17). Percent-decoding is not a second reading of the name: RFC 3986 makes `%6D` and `m` the
 * same path segment, so `/…/model` and `/…/%6Dodel` are one address and not two.
 *
 * It is read run by run rather than through `decodeURIComponent` on the whole segment, because that
 * function raises on a segment a reader can type: a bare `%` (a sheet named `50%`, hand-typed) and
 * an escape that is no UTF-8 (`%C0`) both throw `URIError`, and a reader's own address is a sheet
 * this drawing does not carry — never a fault of ours (ARCH-03). A bare `%` is left standing as
 * itself, and bytes no text can be read from decode to the replacement character, so this answers a
 * name for every address and raises for none.
 */
export function layoutNameOf(segment: string): string {
  return segment.replace(ESCAPES, (run) => {
    const bytes = new Uint8Array((run.match(ESCAPE) ?? []).map((pair) => Number.parseInt(pair.slice(1), 16)));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  });
}
