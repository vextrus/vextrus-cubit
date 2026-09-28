/*
 * The English catalogues, gathered by glob so no ticket edits a shared list (docs/plans/M0.md, "The
 * shape of M0's code"): each feature folder's chrome, `src/<feature>/locales/en.po`, and the machine's
 * codes, `src/messages/<module>/<submodule>/en.po`. Lingui's Vite plugin compiles each `.po` at build
 * time and fails the build on a message without English (vite.config.ts).
 */
import type { Messages } from '@lingui/core'

interface CompiledCatalogue {
  messages: Messages
}

// The `dev` folder (the development-only specimen) brings its own catalogue with `addCatalogue`,
// so no development words reach a production bundle.
const chrome = import.meta.glob<CompiledCatalogue>(['../*/locales/en.po', '!../dev/locales/en.po'], { eager: true })
const machine = import.meta.glob<CompiledCatalogue>('../messages/*/*/en.po', { eager: true })
const added: Record<string, CompiledCatalogue> = {}

export class CatalogueClash extends Error {
  override name = 'CatalogueClash' // eslint-disable-line lingui/no-unlocalized-strings -- an error class name
}

/**
 * Merges compiled catalogues into one table. The chrome's ids are hashes of the English text, so two
 * features using the same words share one entry; a machine code is an explicit id, so two catalogues
 * wording one code differently is a clash and throws.
 */
export function mergeCatalogues(catalogues: Record<string, CompiledCatalogue>): Messages {
  const merged: Messages = {}
  const from: Record<string, string> = {}
  for (const [path, { messages }] of Object.entries(catalogues)) {
    for (const [id, message] of Object.entries(messages)) {
      if (id in merged && JSON.stringify(merged[id]) !== JSON.stringify(message)) {
        throw new CatalogueClash(`Message "${id}" is worded differently in ${from[id]} and ${path}`)
      }
      merged[id] = message
      from[id] = path
    }
  }
  return merged
}

let english: Messages | undefined

/** Every English message the web knows: the chrome's, the machine's and any added at runtime. */
export function englishMessages(): Messages {
  english ??= mergeCatalogues({ ...chrome, ...machine, ...added })
  return english
}

/** Adds a catalogue loaded later (the development-only specimen's); activate the language again after. */
export function addCatalogue(name: string, catalogue: CompiledCatalogue): void {
  added[name] = catalogue
  english = undefined
}
