/**
 * The AGPL ban, enforced on the node runtime (L-CAD-04).
 *
 * "PDF via pypdfium2 (permissive); AGPL PDF libraries (PyMuPDF/fitz, mutool,
 * `@vivliostyle/cli`) are banned in shipped code and a licence test enforces it on both
 * runtimes." This is the node half; `cad/src/cubit_cad/licences.py` is the python half, and
 * the two read the same kind of evidence in the same way.
 *
 * The check reads *manifest* text — `package.json` and the lockfile — and nothing else.
 * Two reasons, and both matter:
 *
 *   1. A dependency is what the lockfile says is installed. A source scan misses the
 *      transitive copy nobody imports by name, which is exactly the copy that ships.
 *   2. A source scan would report this file, and the test that drives it, for naming what
 *      they forbid. A rule that cannot state its own subject is a rule someone deletes.
 */

/** The banned distributions, by the name a manifest spells them with. */
export const BANNED = ['@vivliostyle/cli', 'mupdf', 'pymupdf'];

/**
 * What a distribution name is made of. A match touching one of these on either side is a
 * longer name that merely contains this one — `mupdf` inside `pymupdf`, `mupdf-js` beside
 * `mupdf` — and is not this distribution.
 *
 * `/` and `@` are deliberately not in the set: a lockfile writes a scoped package as
 * `/@vivliostyle/cli@8.0.0`, so the separators around the name are the very characters
 * that prove it is the name.
 */
const NAME_CHARACTERS = '0-9a-z._-';

const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

function mentions(text, name) {
  const pattern = new RegExp(
    `(?<![${NAME_CHARACTERS}])${escapeForRegExp(name)}(?![${NAME_CHARACTERS}])`,
  );
  return pattern.test(text.toLowerCase());
}

/**
 * Every banned distribution named by the two manifests, as readable findings.
 *
 * An empty array is the whole of "clean": the caller does not have to know which files
 * were read, only that nothing AGPL is declared or locked.
 */
export function bannedLicenceFindings(packageJsonText, lockfileText) {
  const findings = [];
  for (const [where, text] of [
    ['package.json', packageJsonText],
    ['pnpm-lock.yaml', lockfileText],
  ]) {
    for (const name of BANNED) {
      if (mentions(text, name)) {
        findings.push(
          `${where} names ${name}, which is AGPL and banned in shipped code (L-CAD-04); ` +
            `PDF is read with pypdfium2 through the cad/ seam`,
        );
      }
    }
  }
  return findings;
}
