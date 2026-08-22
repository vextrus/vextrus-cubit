/**
 * A minimal reader for ASCII DXF, so the acceptance can judge the artifact against the
 * file it came from rather than against itself.
 *
 * L-CAD-02 says a source key is "the file's own handle" and L-CAD-03 says extraction
 * consumes original entities only. Neither claim can be checked by reading the artifact
 * alone: both are relations between the artifact and the input bytes. So the committed
 * fixtures — which are test inputs, not product source — are parsed here into the two
 * facts the criteria need: which handles the ENTITIES section minted, and which handles
 * belong to block *definitions* (the BLOCKS section) and therefore may never appear as an
 * original entity's key.
 *
 * ASCII DXF is a flat stream of (group code, value) line pairs. Nothing here interprets
 * geometry; it only groups the stream.
 */

/** One group-code/value pair, exactly as the file writes it. */
export interface DxfTag {
  readonly code: number;
  readonly value: string;
}

/** One entity or table record: the code-0 name that opened it, and the tags that follow. */
export interface DxfRecord {
  readonly type: string;
  readonly tags: readonly DxfTag[];
}

/** The whole file as tag pairs. Blank trailing lines and CRLF are both tolerated. */
export function parseTags(text: string): DxfTag[] {
  const lines = text.split(/\r?\n/);
  const tags: DxfTag[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const rawCode = (lines[i] ?? '').trim();
    if (rawCode === '') break;
    const code = Number(rawCode);
    if (!Number.isInteger(code)) {
      throw new Error(`not an ASCII DXF: group code line ${i + 1} reads ${JSON.stringify(rawCode)}`);
    }
    tags.push({ code, value: (lines[i + 1] ?? '').trim() });
  }
  return tags;
}

/**
 * The tags inside `SECTION`/`2 <name>` up to its `ENDSEC`. Returns an empty list when the
 * file has no such section, which the callers assert against rather than swallow.
 */
export function section(tags: readonly DxfTag[], name: string): DxfTag[] {
  const out: DxfTag[] = [];
  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    const next = tags[i + 1];
    if (tag === undefined || next === undefined) break;
    if (tag.code !== 0 || tag.value !== 'SECTION') continue;
    if (next.code !== 2 || next.value !== name) continue;
    for (let j = i + 2; j < tags.length; j += 1) {
      const inner = tags[j];
      if (inner === undefined) break;
      if (inner.code === 0 && inner.value === 'ENDSEC') return out;
      out.push(inner);
    }
    return out;
  }
  return out;
}

/** Split a section's tags into records at every code-0 boundary. */
export function records(tags: readonly DxfTag[]): DxfRecord[] {
  const out: { type: string; tags: DxfTag[] }[] = [];
  for (const tag of tags) {
    if (tag.code === 0) {
      out.push({ type: tag.value, tags: [] });
      continue;
    }
    const current = out[out.length - 1];
    if (current !== undefined) current.tags.push(tag);
  }
  return out;
}

/** The first value carried at `code`, or undefined. */
export function tagValue(record: DxfRecord, code: number): string | undefined {
  return record.tags.find((t) => t.code === code)?.value;
}

/** Every value carried at `code`, in file order. */
export function tagValues(record: DxfRecord, code: number): string[] {
  return record.tags.filter((t) => t.code === code).map((t) => t.value);
}

/** A record's own handle (group code 5). Records without one are skipped by the callers. */
export function handleOf(record: DxfRecord): string | undefined {
  return tagValue(record, 5);
}

/** Every handle minted inside a named section, upper-cased (DXF handles are hex). */
export function handlesIn(tags: readonly DxfTag[], sectionName: string): Set<string> {
  const found = new Set<string>();
  for (const record of records(section(tags, sectionName))) {
    const handle = handleOf(record);
    if (handle !== undefined && handle !== '') found.add(handle.toUpperCase());
  }
  return found;
}

/**
 * The same fixture with `$INSUNITS` set to `code`, written into the HEADER when the file
 * does not already carry it.
 *
 * AC-3 names six header codes and the contract commits only two fixtures, so the other
 * readings are made by rewriting one header variable of a committed fixture — the input
 * differs in exactly the byte the criterion is about.
 */
export function withInsunits(text: string, code: number): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  for (let i = 0; i + 3 < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() !== '9') continue;
    if ((lines[i + 1] ?? '').trim() !== '$INSUNITS') continue;
    if ((lines[i + 2] ?? '').trim() !== '70') continue;
    const out = [...lines];
    out[i + 3] = String(code);
    return out.join(eol);
  }
  for (let i = 0; i + 3 < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() !== '0') continue;
    if ((lines[i + 1] ?? '').trim() !== 'SECTION') continue;
    if ((lines[i + 2] ?? '').trim() !== '2') continue;
    if ((lines[i + 3] ?? '').trim() !== 'HEADER') continue;
    const out = [
      ...lines.slice(0, i + 4),
      '9',
      '$INSUNITS',
      '70',
      String(code),
      ...lines.slice(i + 4),
    ];
    return out.join(eol);
  }
  throw new Error('fixture carries no HEADER section, so $INSUNITS cannot be set');
}
