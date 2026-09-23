// What an act's cited subject IS, read off its key: the one parse of the key schemes an act records
// (R-SPINE-081, L-ACT-01), shared by the read that resolves the names a subject is known by and the
// screens that present it (S-Audit's cited evidence, S-Project's subject column). Two readers that
// each sliced a key their own way would be two spellings of one fact, and they already disagreed:
// one showed the characters after the first colon, the other the first seven (B-17).
//
// Pure: no store, no copy. What a subject is CALLED is the screen's to say from its own string
// table; this file only says which facts the key carries, so a screen can name them. It is imported
// by client components, so it reaches nothing that opens a connection — which is why the uuid shape
// is stated here rather than asked of the seam's `isUuid`, whose module holds the driver.

/**
 * The shape of a surrogate: a uuid, as the store renders one. The two screens that present subjects
 * and actors ask this one test, rather than each keeping an `IDENTIFIER` pattern of its own.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Is this value a bare surrogate — an id a person can only be shown as an IdChip (R-UI-082)? */
export function isSurrogate(value: string): boolean {
  return UUID.test(value);
}

/** The field separator every composite key of the register writes (L-REG-04). */
const FIELD = "|";

/** Where a key's level segment begins (L-REG-04's `@<levelId>`, `@<slot>`, `@unregistered:<label>`). */
const LEVEL_MARKER = "@";

/** The placeholder a level nobody has authored yet is carried under, inside a level segment. */
const UNREGISTERED = "unregistered:";

/** The level a placement stands on, as its key states it. */
export type SubjectLevel = { readonly levelId: string } | { readonly slot: string } | { readonly unregistered: string };

/** The facts one cited subject carries, by the scheme its key is written in. */
export type ParsedSubject =
  /** A register instance or placement: `v:<class>:<anchor>|<mark>|<x>,<y>[@<level>]`. */
  | { readonly scheme: "placement"; readonly viewKey: string; readonly mark: string; readonly level: SubjectLevel | null }
  /** A view: `v:<class>:<anchor>` (AFFIRM_SCALE, CONFIRM_VIEW_TYPE). */
  | { readonly scheme: "view"; readonly viewKey: string; readonly viewClass: string }
  /** A note reading: `note:<drawingId>|<layout>|<kind>|<actor>|<source>` (TRANSCRIBE_SHEET_NOTES). */
  | { readonly scheme: "note"; readonly drawingId: string; readonly layoutName: string; readonly kind: string }
  /** A storey-height reading: `h:<levelId>|<actor>|<basis>|<source>` (AUTHOR_STOREY_HEIGHT). */
  | { readonly scheme: "storey"; readonly levelId: string }
  /** A level an act proposed and the store had not minted yet: `proposed:<index>` (INSERT_LEVEL). */
  | { readonly scheme: "proposed"; readonly index: number }
  /** A sheet: `<ingestId>:<layout>` (CONFIRM_DISCIPLINE). */
  | { readonly scheme: "sheet"; readonly layoutName: string }
  /** A bare surrogate — a level, a drawing, a person or the project, whichever the store names by it. */
  | { readonly scheme: "id"; readonly id: string }
  /** Anything else: shown as the identifier it is. */
  | { readonly scheme: "opaque" };

/**
 * The names the store knows a project's subjects by, keyed by the identifier a key carries. Plain
 * records, because they cross from the server to the client component that presents them.
 */
export interface SubjectNames {
  /** Level surrogate → the level's own label ("GF", "1F"). */
  readonly levels: Readonly<Record<string, string>>;
  /** Drawing id → the file name it was uploaded under. */
  readonly drawings: Readonly<Record<string, string>>;
  /** View key → the caption the drawing anchors the view by. */
  readonly views: Readonly<Record<string, string>>;
  /** Account id → the label the project's roster names the person by. */
  readonly people: Readonly<Record<string, string>>;
}

/** No name known for anything: every subject is presented from its key alone. */
export const NO_SUBJECT_NAMES: SubjectNames = Object.freeze({ levels: {}, drawings: {}, views: {}, people: {} });

/** The level segment of a placement's last field, where the key carries one. */
function levelOf(field: string): SubjectLevel | null {
  const at = field.indexOf(LEVEL_MARKER);
  if (at < 0 || at === field.length - 1) return null;
  const segment = field.slice(at + 1);
  if (segment.startsWith(UNREGISTERED)) return { unregistered: segment.slice(UNREGISTERED.length) };
  return isSurrogate(segment) ? { levelId: segment.toLowerCase() } : { slot: segment };
}

/** One cited subject, read for the facts its key carries. Never throws: an unknown key is opaque. */
export function parseSubject(subject: string): ParsedSubject {
  if (isSurrogate(subject)) return { scheme: "id", id: subject.toLowerCase() };

  const fields = subject.split(FIELD);
  const head = fields[0] ?? "";

  if (head.startsWith("v:")) {
    const viewClass = head.slice(2).split(":")[0] ?? "";
    if (fields.length === 1) return viewClass === "" ? { scheme: "opaque" } : { scheme: "view", viewKey: head, viewClass };
    const mark = fields[1] ?? "";
    // A bar key continues past the point with its role, diameter and sequence; the level segment is
    // on the point's field either way (L-REG-04's instance key, extended by the bar key).
    return mark === "" ? { scheme: "opaque" } : { scheme: "placement", viewKey: head, mark, level: levelOf(fields[2] ?? "") };
  }
  if (head.startsWith("note:") && fields.length >= 3) {
    const drawingId = head.slice("note:".length);
    return { scheme: "note", drawingId: drawingId.toLowerCase(), layoutName: fields[1] ?? "", kind: fields[2] ?? "" };
  }
  if (head.startsWith("h:")) {
    const levelId = head.slice(2);
    return isSurrogate(levelId) ? { scheme: "storey", levelId: levelId.toLowerCase() } : { scheme: "opaque" };
  }
  if (head.startsWith("proposed:") && fields.length === 1) {
    const index = Number(head.slice("proposed:".length));
    return Number.isSafeInteger(index) && index >= 0 ? { scheme: "proposed", index } : { scheme: "opaque" };
  }
  const colon = subject.indexOf(":");
  if (colon > 0 && isSurrogate(subject.slice(0, colon)) && colon < subject.length - 1) return { scheme: "sheet", layoutName: subject.slice(colon + 1) };
  return { scheme: "opaque" };
}

/** What a set of subjects asks the store to name: the surrogates they carry, and the views. */
export function namesAskedBy(subjects: readonly string[]): { readonly ids: readonly string[]; readonly viewKeys: readonly string[] } {
  const ids = new Set<string>();
  const viewKeys = new Set<string>();
  for (const subject of subjects) {
    const parsed = parseSubject(subject);
    switch (parsed.scheme) {
      case "id":
        ids.add(parsed.id);
        break;
      case "storey":
        ids.add(parsed.levelId);
        break;
      case "note":
        if (isSurrogate(parsed.drawingId)) ids.add(parsed.drawingId);
        break;
      case "placement":
        if (parsed.level !== null && "levelId" in parsed.level) ids.add(parsed.level.levelId);
        break;
      case "view":
        viewKeys.add(parsed.viewKey);
        break;
      default:
        break;
    }
  }
  return { ids: [...ids], viewKeys: [...viewKeys] };
}
