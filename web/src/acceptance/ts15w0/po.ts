/*
 * Ticket S15-W0's helpers: the chrome's English catalogues as files on disk, read as Lingui writes them
 * (`web/lingui.config.ts`: the PO format, `lineNumbers: false`, so an origin is `#: src/<path>`).
 *
 * The takeoff catalogues are every `.po` file under `web/src/takeoff/` (the ticket owns "web takeoff
 * locales"): today one, `web/src/takeoff/locales/en.po`; after the split, one per screen area, wherever
 * under the folder the builder puts them.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The repository's root and the web's folder, as absolute paths ending in `/`. */
export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
export const WEB = `${ROOT}web/`
const SRC = `${WEB}src/`

export interface Entry {
  /** `msgctxt`, or undefined. */
  context: string | undefined
  /** `msgid`: the English the code wrote (the chrome's ids are its words). */
  id: string
  /** `msgstr`: the English the catalogue gives it. */
  english: string
  /** The `#:` origins: source files relative to `web/` (`src/takeoff/acts.tsx`). */
  origins: string[]
}

export interface Catalogue {
  /** Relative to the repository (`web/src/takeoff/locales/en.po`). */
  path: string
  /** Relative to `web/` (`src/takeoff/locales/en.po`), as the catalogue check names it. */
  fromWeb: string
  lines: number
  entries: Entry[]
}

/** A PO string's text: the quoted pieces joined, `\"`, `\\`, `\n`, `\t` read back. */
function unquote(pieces: string[]): string {
  return pieces
    .join('')
    .replace(/\\(["\\nt])/g, (_m, c: string) => ({ '"': '"', '\\': '\\', n: '\n', t: '\t' })[c] ?? c)
}

/** The entries of a PO file's text, the header (empty msgid) left out. */
export function parsePo(text: string): Entry[] {
  const entries: Entry[] = []
  for (const block of text.split(/\n\s*\n/)) {
    const fields: Record<string, string[]> = {}
    const origins: string[] = []
    let current: string | null = null
    for (const line of block.split('\n')) {
      const origin = /^#: (.*)$/.exec(line)
      const field = /^(msgctxt|msgid|msgstr) "(.*)"$/.exec(line)
      const more = /^"(.*)"$/.exec(line)
      if (origin) origins.push(...origin[1]!.trim().split(/\s+/))
      else if (field) {
        current = field[1]!
        fields[current] = [field[2]!]
      } else if (more && current) fields[current]!.push(more[1]!)
      else current = null
    }
    if (!fields.msgid) continue
    const id = unquote(fields.msgid)
    if (id === '') continue
    entries.push({
      context: fields.msgctxt ? unquote(fields.msgctxt) : undefined,
      id,
      english: fields.msgstr ? unquote(fields.msgstr) : '',
      origins,
    })
  }
  return entries
}

export function readCatalogue(absolute: string): Catalogue {
  const text = readFileSync(absolute, 'utf8')
  const fromRoot = absolute.slice(ROOT.length)
  return {
    path: fromRoot,
    fromWeb: absolute.slice(WEB.length),
    lines: text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length,
    entries: parsePo(text),
  }
}

/** Every `.po` file under `web/src/<folder>/`, sorted, as absolute paths. */
function poFiles(folder: string): string[] {
  const base = `${SRC}${folder}/`
  return (readdirSync(base, { recursive: true }) as string[])
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => p.endsWith('.po'))
    .sort()
    .map((p) => `${base}${p}`)
}

/** The takeoff catalogues: every `.po` file under `web/src/takeoff/`. */
export function takeoffCatalogues(): Catalogue[] {
  return poFiles('takeoff').map(readCatalogue)
}

/** Every chrome catalogue: each `.po` file under `web/src/` outside the machine's `messages/`. */
export function chromeCatalogues(): Catalogue[] {
  const folders = (readdirSync(SRC, { withFileTypes: true }) as { name: string; isDirectory(): boolean }[])
    .filter((d) => d.isDirectory() && d.name !== 'messages')
    .map((d) => d.name)
    .sort()
  return folders.flatMap(poFiles).map(readCatalogue)
}

/** A message's key: its context and its id. */
export const keyOf = (e: { context: string | undefined; id: string }) => JSON.stringify([e.context ?? null, e.id])
