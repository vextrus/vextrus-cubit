import words from './never-shown.json' with { type: 'json' }

/**
 * m0-screens §1.1's "Never shown to a QS or an MD" (the design gate greps the DOM for them), the one list
 * in `never-shown.json`; the words lint (`tools/lint/words.py`) reads the same file for the catalogues.
 * Each word is matched whole, in any case, with its plural.
 */
function pattern(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const forms = word.endsWith('y') ? `${escaped.slice(0, -1)}(?:y|ies)` : `${escaped}(?:e?s)?`
  return new RegExp(`\\b${forms}(?![\\w])`, 'i')
}

const PATTERNS = words.map((word) => [word, pattern(word)] as const)
/** A font file name with its extension ("romans.shx": say "Romans (AutoCAD lettering)"). */
const FONT_FILE = /\b[\w-]+\.shx\b/i

/** The entries of the list found in a screen's text, as the list writes them; [] when none is. */
export function neverShownIn(text: string): string[] {
  const found: string[] = PATTERNS.filter(([, re]) => re.test(text)).map(([word]) => word)
  const font = FONT_FILE.exec(text)
  if (font) found.push(font[0])
  return found
}
