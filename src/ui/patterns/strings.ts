/**
 * The patterns module's string table (R-SPINE-060).
 *
 * The R-UI-050 states speak for the system when it cannot do what was asked, which is exactly
 * where improvised copy does the most damage: a reader meets these sentences on their worst
 * minute. So they are decided in docs/design/datum-patterns.md §10 and quoted there verbatim
 * (AM-03 (2)), registered here, and read by key.
 *
 * What is deliberately absent: EmptyState's title and teaching sentence, and a DataTable's
 * `emptyReason`, are the composing screen's copy — decided in that screen's Design Decision,
 * because only that screen knows what the next action is. A refusal's message and remedy are
 * the REFUSALS register's (L-QTY-04), never repeated here.
 */
export const PATTERNS_STRINGS = Object.freeze({
  /** ErrorState's heading: what failed, without blaming the reader. */
  'patterns.error.title': 'This data could not be loaded.',
  /** ErrorState's body: the two things worth doing, in order. */
  'patterns.error.body': 'Retry now. If it keeps failing, quote the report id below.',
  /** The name of ErrorState's retry control. */
  'patterns.error.retry': 'Retry',
  /** What labels the report id a reader quotes back to support. */
  'patterns.error.reportLabel': 'Report id',
  /** PartialNotice: some rows were refused and are still on screen. Slot: the count. */
  'patterns.partial.text': 'Refused rows: {count}. They remain in the list with their reasons.',
  /** OfflineBanner: what the reader may still do while the connection is gone. */
  'patterns.offline':
    'You are offline. This screen is read-only until the connection returns; the data shown may be stale.',
  /** PermissionDenied's heading. */
  'patterns.permission.title': 'Permission needed',
  /** What permission was missing. Slot: the permission's own name. */
  'patterns.permission.body': 'This needs the {permission} permission, which you do not hold.',
  /** Who can resolve it. Slot: the holder. */
  'patterns.permission.remedy': 'Ask {holder} to grant it or to make the change for you.',
  /** EvidenceLink's own name when the caller gives it no words (R-UI-020's Trace affordance). */
  'patterns.evidence.default': 'View evidence',
  /** ConsequenceDialog's dismissal. */
  'patterns.consequence.cancel': 'Cancel',
  /** ConsequenceDialog's commit. */
  'patterns.consequence.confirm': 'Confirm',
  /** The commit that never answered at all — a rejected promise, said in the reader's terms. */
  'patterns.consequence.failed':
    'This could not be confirmed — the request did not complete. Nothing was changed. Try confirming again.',
  /** What a stale digest means, said to the reader rather than reported as an error. */
  'patterns.consequence.stale':
    'The preview changed while this dialog was open. Review the updated counts; confirming applies what is shown now.',
} as const);

/** The closed key set: exactly the keys the table above carries. */
export type PatternStringKey = keyof typeof PATTERNS_STRINGS;

/** Read one string. The only reader — the table itself stays where it is. */
export function ps(key: PatternStringKey): string {
  return PATTERNS_STRINGS[key];
}

/**
 * Split a template around its `{slot}`, so the slot can be rendered as its own element — a
 * count in `.numeric`, a permission in mono — without the component composing the sentence.
 */
export function around(key: PatternStringKey, slot: string): readonly [string, string] {
  const template = ps(key);
  const marker = `{${slot}}`;
  const at = template.indexOf(marker);
  if (at === -1) return [template, ''];
  return [template.slice(0, at), template.slice(at + marker.length)];
}

/** The same substitution where the result is plain text (a name, a label). */
export function fill(key: PatternStringKey, slot: string, value: string): string {
  return ps(key).replace(`{${slot}}`, value);
}
