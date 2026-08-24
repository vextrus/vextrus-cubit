/**
 * The act log's sole-writer scanner — SEAM-ACT, L-ACT-01 ("the act seam … is the sole writer of
 * the log and unimportable elsewhere").
 *
 * This module exists because the arbitration on db/__tests__/inc-013-act-seam.test.ts:735 ruled
 * that both clauses quantify over *every* write path and *every* way of holding the table
 * objects — not over the two shapes an earlier pair of regexes happened to recognise. Two
 * separate filters, one per half of AC-3, drifted apart and let the codebase's own idiomatic
 * write (`db.insert(acts).values(…)` over a binding reached by a re-export) through both. So the
 * scan lives here once and both halves of AC-3 call it.
 *
 * What it proves, and how:
 *
 *   1. *Unimportable elsewhere.* The three act tables are found where they are declared
 *      (`pgTable('acts' | 'participants' | 'participant_roles', …)` under db/schema) and their
 *      bindings are then propagated to a fixed point across every import and re-export edge in
 *      the tree — `import { x }`, `import { x as y }`, `export { x } from`, `export { x as y }
 *      from`, `export * from`, a local `export { x }`, and a local alias `const y = x`. A module
 *      that ends up holding such a binding by *any* chain is an offence. This subsumes the
 *      builder-call shape: `db.insert(acts)` cannot be written without holding `acts`.
 *   2. *Sole writer, raw SQL.* A statement that names one of the three tables in INSERT / UPDATE
 *      / DELETE text is an offence wherever it is spelled outside the seam.
 *   3. *Sole writer, query builder.* `.insert(t)` / `.update(t)` / `.delete(t)` on a held binding
 *      — or on one of the tables' canonical identifiers even when the chain that produced it
 *      could not be resolved — is reported by name, so an offence reads as the write it is.
 *
 * Two shapes are deliberately *not* offences, because the clause is about writing the log:
 *
 *   - a read through the relational reader (`tx.query.acts`), which holds no table object;
 *   - src/core/db.ts's `import * as schema from '../../db/schema'`. SEAM-TENANT makes that module
 *     the one holder of the composed schema, and it is the mechanism by which every module above
 *     the seam is *denied* the tables. Naming an act table off that namespace (or off a handle's
 *     `_.fullSchema`) is an offence for every module, db.ts included.
 *
 * Comments and their prose are stripped before any pattern runs: a doc line that says "nothing
 * else may insert into acts" describes the rule, it does not break it.
 */

/** L-ACT-01's three tables, as PostgreSQL names them. */
export const ACT_LOG_TABLES: readonly string[] = ['acts', 'participants', 'participant_roles'];

/** The identifiers the schema exports them under, for the unresolvable-chain fallback. */
const CANONICAL_BINDINGS: readonly string[] = [
  'acts',
  'participants',
  'participantRoles',
  'participant_roles',
];

/** Where a binding to an act table may lawfully live. */
const SEAM = 'src/core/acts';
const ALLOWED_HOLDER_PREFIXES: readonly string[] = ['src/core/acts/', 'db/schema/', 'db/migrations/'];

/** The schema composition root SEAM-TENANT allows to hold the whole schema as a namespace. */
const SCHEMA_NAMESPACE_HOLDER = 'src/core/db.ts';

export interface SourceModule {
  /** Repo-relative, posix-separated: `src/core/db.ts`. */
  readonly path: string;
  readonly text: string;
}

export interface Offence {
  readonly path: string;
  /** Why it is one, in the words of the shape that was found. */
  readonly what: string;
}

/** An offence, rendered the way a failing assertion should read it. */
export const renderOffence = (offence: Offence): string => `${offence.path}: ${offence.what}`;

/* ────────────────────────────────── reading the source ──────────────────────────────── */

/**
 * Strip line and block comments, leaving string and template literals intact. A regex cannot do
 * this without flagging the tree's own prose about the rule, so it is a small state machine.
 */
export function stripComments(text: string): string {
  let out = '';
  let index = 0;
  let quote = '';
  while (index < text.length) {
    const char = text[index] ?? '';
    const next = text[index + 1] ?? '';
    if (quote !== '') {
      out += char;
      if (char === '\\') {
        out += next;
        index += 2;
        continue;
      }
      if (char === quote) quote = '';
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      out += char;
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 2;
      out += ' ';
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

/* ─────────────────────────────── resolving one specifier ────────────────────────────── */

function normalise(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/**
 * Resolve an import specifier to a path in `known`. Relative specifiers are joined against the
 * importer; anything else that mentions db/schema falls back to the schema barrel, which is how
 * a non-relative spelling of the same edge still lands.
 */
function resolve(importer: string, specifier: string, known: ReadonlySet<string>): string | undefined {
  const base = specifier.startsWith('.')
    ? normalise(`${importer.split('/').slice(0, -1).join('/')}/${specifier}`)
    : normalise(specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (known.has(candidate)) return candidate;
  }
  if (/(^|\/)db\/schema(\/|$)/.test(specifier)) {
    for (const candidate of ['db/schema/index.ts', 'db/schema/spine/acts.ts']) {
      if (known.has(candidate)) return candidate;
    }
  }
  return undefined;
}

/* ──────────────────────────────── the edges of one module ───────────────────────────── */

interface NamedEdge {
  readonly specifier: string;
  /** The name as the source module exports it. */
  readonly imported: string;
  /** The name this module then holds (or re-exports) it under. */
  readonly local: string;
}

interface ModuleEdges {
  readonly namedImports: readonly NamedEdge[];
  readonly namespaceImports: readonly { specifier: string; local: string }[];
  readonly reExports: readonly NamedEdge[];
  readonly starReExports: readonly string[];
  /** `export { a, b as c }` with no `from`. */
  readonly localExports: readonly { local: string; exported: string }[];
  /** `const y = x` — an alias inside the module. */
  readonly aliases: readonly { from: string; to: string }[];
  /** `export const acts = pgTable('acts', …)` — where a binding is born. */
  readonly declarations: readonly { name: string; table: string }[];
}

const CLAUSE = String.raw`\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]`;

function specifiersOf(clause: string): { imported: string; local: string }[] {
  const out: { imported: string; local: string }[] = [];
  for (const piece of clause.split(',')) {
    const trimmed = piece.trim();
    if (trimmed === '') continue;
    // A type-only specifier cannot write a row; `type` as a name of its own is not one.
    const withoutType = trimmed.replace(/^type\s+/, '');
    if (withoutType !== trimmed) continue;
    const parts = withoutType.split(/\s+as\s+/);
    const imported = (parts[0] ?? '').trim();
    const local = (parts[1] ?? imported).trim();
    if (imported === '' || !/^[A-Za-z_$][\w$]*$/.test(imported)) continue;
    out.push({ imported, local });
  }
  return out;
}

function edgesOf(text: string): ModuleEdges {
  const namedImports: NamedEdge[] = [];
  const namespaceImports: { specifier: string; local: string }[] = [];
  const reExports: NamedEdge[] = [];
  const starReExports: string[] = [];
  const localExports: { local: string; exported: string }[] = [];
  const aliases: { from: string; to: string }[] = [];
  const declarations: { name: string; table: string }[] = [];

  for (const match of text.matchAll(new RegExp(String.raw`import\s+(type\s+)?${CLAUSE}`, 'g'))) {
    if (match[1] !== undefined) continue; // `import type { … }` holds no value
    for (const each of specifiersOf(match[2] ?? '')) {
      namedImports.push({ specifier: match[3] ?? '', ...each });
    }
  }
  for (const match of text.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g)) {
    namespaceImports.push({ local: match[1] ?? '', specifier: match[2] ?? '' });
  }
  for (const match of text.matchAll(new RegExp(String.raw`export\s+(type\s+)?${CLAUSE}`, 'g'))) {
    if (match[1] !== undefined) continue;
    for (const each of specifiersOf(match[2] ?? '')) {
      reExports.push({ specifier: match[3] ?? '', imported: each.imported, local: each.local });
    }
  }
  for (const match of text.matchAll(/export\s+\*\s+(?:as\s+\w+\s+)?from\s*['"]([^'"]+)['"]/g)) {
    starReExports.push(match[1] ?? '');
  }
  for (const match of text.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s*(?!from)[;\n]/g)) {
    if (match[1] !== undefined) continue;
    for (const each of specifiersOf(match[2] ?? '')) {
      localExports.push({ local: each.imported, exported: each.local });
    }
  }
  for (const match of text.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\s*[;\n]/g)) {
    aliases.push({ to: match[1] ?? '', from: match[2] ?? '' });
  }
  for (const match of text.matchAll(
    /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"]([a-z_]+)['"]/g,
  )) {
    const table = match[2] ?? '';
    if (ACT_LOG_TABLES.includes(table)) declarations.push({ name: match[1] ?? '', table });
  }
  return {
    namedImports,
    namespaceImports,
    reExports,
    starReExports,
    localExports,
    aliases,
    declarations,
  };
}

/* ─────────────────────────────────── the fixed point ────────────────────────────────── */

export interface ScanResult {
  readonly offences: readonly Offence[];
  /** path → local name → table, for every module that holds a binding by any chain. */
  readonly holders: ReadonlyMap<string, ReadonlyMap<string, string>>;
}

export interface ScanOptions {
  /**
   * Which paths are graded. Chains are followed through every module given, but only a module
   * whose path satisfies this is reported — AC-3 asks the question of `src/**`.
   */
  readonly graded?: (path: string) => boolean;
}

const isTest = (path: string): boolean => path.split('/').includes('__tests__');

const mayHold = (path: string): boolean =>
  path === `${SEAM}.ts` || ALLOWED_HOLDER_PREFIXES.some((prefix) => path.startsWith(prefix));

/**
 * Scan a corpus for every module that holds — or writes — one of the act log's tables.
 *
 * The corpus is the whole tree of product modules, not just the graded ones: a re-export chain
 * runs through modules that are innocent themselves.
 */
export function scanActLog(modules: Iterable<SourceModule>, options: ScanOptions = {}): ScanResult {
  const graded = options.graded ?? ((path: string): boolean => path.startsWith('src/') && !isTest(path));

  const source = new Map<string, string>();
  for (const module of modules) source.set(module.path, stripComments(module.text));
  const known = new Set(source.keys());

  const edges = new Map<string, ModuleEdges>();
  for (const [path, text] of source) edges.set(path, edgesOf(text));

  /** path → exported name → table. */
  const exported = new Map<string, Map<string, string>>();
  /** path → local binding → table. */
  const held = new Map<string, Map<string, string>>();

  const put = (into: Map<string, Map<string, string>>, path: string, name: string, table: string): boolean => {
    const bucket = into.get(path) ?? new Map<string, string>();
    into.set(path, bucket);
    if (bucket.get(name) === table) return false;
    bucket.set(name, table);
    return true;
  };

  for (const [path, edge] of edges) {
    for (const declaration of edge.declarations) {
      put(exported, path, declaration.name, declaration.table);
      put(held, path, declaration.name, declaration.table);
    }
  }

  let moved = true;
  while (moved) {
    moved = false;
    for (const [path, edge] of edges) {
      for (const each of edge.namedImports) {
        const from = resolve(path, each.specifier, known);
        const table = from === undefined ? undefined : exported.get(from)?.get(each.imported);
        if (table !== undefined) moved = put(held, path, each.local, table) || moved;
      }
      for (const each of edge.reExports) {
        const from = resolve(path, each.specifier, known);
        const table = from === undefined ? undefined : exported.get(from)?.get(each.imported);
        if (table !== undefined) moved = put(exported, path, each.local, table) || moved;
      }
      for (const specifier of edge.starReExports) {
        const from = resolve(path, specifier, known);
        if (from === undefined) continue;
        for (const [name, table] of exported.get(from) ?? []) {
          moved = put(exported, path, name, table) || moved;
        }
      }
      for (const each of edge.localExports) {
        const table = held.get(path)?.get(each.local);
        if (table !== undefined) moved = put(exported, path, each.exported, table) || moved;
      }
      for (const each of edge.aliases) {
        const table = held.get(path)?.get(each.from);
        if (table !== undefined) moved = put(held, path, each.to, table) || moved;
      }
    }
  }

  const offences: Offence[] = [];
  for (const [path, text] of source) {
    if (!graded(path)) continue;

    if (!mayHold(path)) {
      for (const [name, table] of held.get(path) ?? []) {
        offences.push({ path, what: `holds the ${table} table object as \`${name}\`` });
      }
      for (const [name, table] of exported.get(path) ?? []) {
        offences.push({ path, what: `re-exports the ${table} table object as \`${name}\`` });
      }
    }

    // A namespace that carries the schema is only an offence where it names an act table.
    const namespaces = new Set<string>();
    for (const each of edges.get(path)?.namespaceImports ?? []) {
      const from = resolve(path, each.specifier, known);
      if (from !== undefined && (exported.get(from)?.size ?? 0) > 0) namespaces.add(each.local);
    }
    if (path !== SCHEMA_NAMESPACE_HOLDER && !mayHold(path)) {
      for (const name of namespaces) {
        offences.push({ path, what: `imports the act tables' module as a namespace \`${name}\`` });
      }
    }
    for (const name of [...namespaces, 'fullSchema']) {
      const pattern = new RegExp(
        String.raw`\b${name}\s*(?:\.\s*(\w+)|\[\s*['"](\w+)['"]\s*\])`,
        'g',
      );
      for (const match of text.matchAll(pattern)) {
        const member = match[1] ?? match[2] ?? '';
        if (!CANONICAL_BINDINGS.includes(member)) continue;
        if (mayHold(path)) continue;
        offences.push({ path, what: `names the act log's ${member} table off \`${name}\`` });
      }
    }

    for (const statement of writeStatements(text)) {
      if (mayHold(path)) continue;
      offences.push({ path, what: statement });
    }
    for (const call of builderWrites(text, held.get(path))) {
      if (mayHold(path)) continue;
      offences.push({ path, what: call });
    }
  }
  return { offences, holders: held };
}

/* ───────────────────────── the two write shapes, spelled out ────────────────────────── */

/** A statement that changes one of the three tables, spelled as SQL rather than as drizzle. */
export function writeStatements(text: string): string[] {
  const pattern =
    /\b(insert\s+into|update|delete\s+from)\s+(?:public\s*\.\s*)?"?(acts|participants|participant_roles)"?\b/gi;
  return [...stripComments(text).matchAll(pattern)].map(
    (match) => `${String(match[1]).replace(/\s+/g, ' ')} ${String(match[2])}`,
  );
}

/**
 * The codebase's idiomatic write: a drizzle builder statement over a table object. Any binding
 * this module was shown to hold counts, and so do the canonical identifiers — a chain the
 * resolver could not follow must not become a way through.
 */
export function builderWrites(text: string, held?: ReadonlyMap<string, string>): string[] {
  const found: string[] = [];
  const pattern = /\.\s*(insert|update|delete)\s*\(\s*([A-Za-z_$][\w$]*)/g;
  for (const match of stripComments(text).matchAll(pattern)) {
    const verb = match[1] ?? '';
    const binding = match[2] ?? '';
    const table = held?.get(binding);
    if (table === undefined && !CANONICAL_BINDINGS.includes(binding)) continue;
    found.push(`.${verb}(${binding}) — a builder write of ${table ?? binding}`);
  }
  return found;
}
