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

/** L-REG-04's prefix: an identity view key is the partition's own view key under it. */
const IDENTITY_VIEW_PREFIX = "v:";

/**
 * The partition's own view key, `<CLASS>:<anchor>`, where the anchor is the caption's source key
 * (`<SCHEME>:<id>`, L-CAD-02) — the spelling `partitionViewKey` writes, the views stage stores and
 * AFFIRM_SCALE and CONFIRM_VIEW_TYPE cite. It is read here by its SHAPE, as the `v:` key always has
 * been, because the vocabulary's one home is a module this client-side parse may not reach (ARCH-01):
 * a class and a scheme are both SCREAMING words, which no other scheme a subject is written in
 * begins with (a sheet begins with a lower-case uuid; `note:`, `h:` and `proposed:` are lower-case).
 */
const PARTITION_VIEW_KEY = /^([A-Z][A-Z0-9_]*):([A-Z][A-Z0-9_]*:.+)$/;

/**
 * The name the cad lane's artifact gives model space (`vextrus_cad.ingest.MODEL_SPACE`): a sheet key
 * whose layout is this is model space, which carries no sheet number to be read by.
 */
const MODEL_SPACE_LAYOUT = "model";

/** The level a placement stands on, as its key states it. */
export type SubjectLevel = { readonly levelId: string } | { readonly slot: string } | { readonly unregistered: string };

/**
 * The facts one cited subject carries, by the scheme its key is written in. A `viewKey` is always the
 * PARTITION's spelling, `<class>:<anchor>` — the key the views stage stores a caption under — whichever
 * of the two spellings the act cited, so the names a view is known by are keyed one way (B-17).
 */
export type ParsedSubject =
  /** A register instance or placement: `v:<class>:<anchor>|<mark>|<x>,<y>[@<level>]`. */
  | { readonly scheme: "placement"; readonly viewKey: string; readonly mark: string; readonly level: SubjectLevel | null }
  /**
   * A view: the partition's own `<class>:<anchor>` (AFFIRM_SCALE, CONFIRM_VIEW_TYPE — what
   * `partitionViewKey` writes), or L-REG-04's `v:<class>:<anchor>`, which is the same key under a prefix.
   */
  | { readonly scheme: "view"; readonly viewKey: string; readonly viewClass: string }
  /** A note reading: `note:<drawingId>|<layout>|<kind>|<actor>|<source>` (TRANSCRIBE_SHEET_NOTES). */
  | { readonly scheme: "note"; readonly drawingId: string; readonly layoutName: string; readonly kind: string }
  /** A storey-height reading: `h:<levelId>|<actor>|<basis>|<source>` (AUTHOR_STOREY_HEIGHT). */
  | { readonly scheme: "storey"; readonly levelId: string }
  /** A level an act proposed and the store had not minted yet: `proposed:<index>` (INSERT_LEVEL). */
  | { readonly scheme: "proposed"; readonly index: number }
  /** A sheet: `<ingestId>:<layout>` (CONFIRM_DISCIPLINE); model space is the layout with no number. */
  | { readonly scheme: "sheet"; readonly layoutName: string; readonly modelSpace: boolean }
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
  /** The partition's view key (`<class>:<anchor>`) → the caption the drawing anchors the view by. */
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

/**
 * A view key in the partition's own spelling, read off either spelling an act cites it in — or null
 * where the head is no view key at all. The identity key is the partition's key under `v:`, so the
 * prefix is all that parts them.
 */
function partitionViewOf(head: string): { readonly viewKey: string; readonly viewClass: string } | null {
  const key = head.startsWith(IDENTITY_VIEW_PREFIX) ? head.slice(IDENTITY_VIEW_PREFIX.length) : head;
  const read = PARTITION_VIEW_KEY.exec(key);
  return read === null ? null : { viewKey: key, viewClass: read[1] ?? "" };
}

/** One cited subject, read for the facts its key carries. Never throws: an unknown key is opaque. */
export function parseSubject(subject: string): ParsedSubject {
  if (isSurrogate(subject)) return { scheme: "id", id: subject.toLowerCase() };

  const fields = subject.split(FIELD);
  const head = fields[0] ?? "";

  if (head.startsWith(IDENTITY_VIEW_PREFIX)) {
    const view = partitionViewOf(head);
    if (view === null) return { scheme: "opaque" };
    if (fields.length === 1) return { scheme: "view", ...view };
    const mark = fields[1] ?? "";
    // A bar key continues past the point with its role, diameter and sequence; the level segment is
    // on the point's field either way (L-REG-04's instance key, extended by the bar key).
    return mark === "" ? { scheme: "opaque" } : { scheme: "placement", viewKey: view.viewKey, mark, level: levelOf(fields[2] ?? "") };
  }
  // The partition's own spelling, which AFFIRM_SCALE and CONFIRM_VIEW_TYPE cite: the same view, and
  // the key its caption is stored under (s-audit I-347).
  if (fields.length === 1) {
    const view = partitionViewOf(head);
    if (view !== null) return { scheme: "view", ...view };
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
  if (colon > 0 && isSurrogate(subject.slice(0, colon)) && colon < subject.length - 1) {
    const layoutName = subject.slice(colon + 1);
    return { scheme: "sheet", layoutName, modelSpace: layoutName === MODEL_SPACE_LAYOUT };
  }
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
