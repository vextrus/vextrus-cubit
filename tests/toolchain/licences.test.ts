/**
 * inc-104 — the AGPL ban, enforced on both runtimes (L-CAD-04).
 *
 * "AGPL PDF libraries (PyMuPDF/fitz, mutool, `@vivliostyle/cli`) are banned in shipped code
 * and a licence test enforces it on both runtimes." This is that test. It makes two claims,
 * and the second is what keeps the first honest:
 *
 *   1. The tree is clean — neither manifest pair declares or locks a banned distribution.
 *   2. The checkers can tell. A checker that answers "clean" for every input would satisfy
 *      claim 1 over any tree at all, so each side is also shown a manifest that names a
 *      banned library and is required to find it.
 *
 * Both checkers read manifest text only. That is why this file may spell the banned names
 * at all: nothing scans source for them, so the ban's own test cannot trip it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANNED, bannedLicenceFindings } from '../../scripts/lib/licences.mjs';

const REPO = process.cwd();
const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

/**
 * The python half of the ban, asked in the cad lane's own frozen environment. It prints one
 * finding per line, and nothing at all when the manifests are clean.
 */
function pythonFindings(pyprojectText: string, lockText: string): string[] {
  const probe = [
    'import sys',
    'from cubit_cad.licences import banned_licence_findings',
    '',
    'for finding in banned_licence_findings(sys.argv[1], sys.argv[2]):',
    '    print(finding)',
    '',
  ].join('\n');
  const stdout = execFileSync('uv', ['run', '--frozen', 'python', '-c', probe, pyprojectText, lockText], {
    cwd: join(REPO, 'cad'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.split('\n').filter((line) => line.trim() !== '');
}

describe('L-CAD-04 — no AGPL PDF library is declared or locked', () => {
  it('finds nothing in package.json and pnpm-lock.yaml', () => {
    const findings = bannedLicenceFindings(read('package.json'), read('pnpm-lock.yaml'));
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('finds nothing in cad/pyproject.toml and cad/uv.lock', () => {
    const findings = pythonFindings(read('cad/pyproject.toml'), read('cad/uv.lock'));
    expect(findings, findings.join('\n')).toEqual([]);
  });
});

describe('L-CAD-04 — the node checker can tell (AS-03: the ban is real, not decorative)', () => {
  const CLEAN_MANIFEST = JSON.stringify({ dependencies: { zod: '4.4.3' } });
  const CLEAN_LOCK = "packages:\n  /zod@4.4.3:\n    resolution: {integrity: sha512-x}\n";

  it('names every banned distribution the spec lists', () => {
    expect([...BANNED].sort()).toEqual(['@vivliostyle/cli', 'mupdf', 'pymupdf']);
  });

  it.each(BANNED)('reports %s declared as a dependency', (name) => {
    const manifest = JSON.stringify({ dependencies: { [name]: '1.0.0' } });
    const findings = bannedLicenceFindings(manifest, CLEAN_LOCK);
    expect(findings.length).toBe(1);
    expect(findings[0]).toContain('package.json');
    expect(findings[0]).toContain(name);
  });

  it('reports a banned distribution that only the lockfile knows about', () => {
    // The transitive copy is the one that ships and the one a source scan never sees; a
    // lockfile writes a scoped package with its separators around it.
    const lock = `packages:\n  /@vivliostyle/cli@8.0.0:\n    resolution: {integrity: sha512-y}\n`;
    const findings = bannedLicenceFindings(CLEAN_MANIFEST, lock);
    expect(findings.length).toBe(1);
    expect(findings[0]).toContain('pnpm-lock.yaml');
  });

  it('does not report a distribution that merely contains a banned name', () => {
    const manifest = JSON.stringify({ dependencies: { 'mupdfview-shim': '1.0.0', pdfmupdf: '2' } });
    expect(bannedLicenceFindings(manifest, CLEAN_LOCK)).toEqual([]);
  });

  it('is clean on a manifest pair that names nothing banned', () => {
    expect(bannedLicenceFindings(CLEAN_MANIFEST, CLEAN_LOCK)).toEqual([]);
  });
});

describe('L-CAD-04 — the python checker can tell', () => {
  const CLEAN_PYPROJECT = '[project]\nname = "cubit-cad"\ndependencies = ["ezdxf==1.4.4"]\n';
  const CLEAN_LOCK = '[[package]]\nname = "ezdxf"\nversion = "1.4.4"\n';

  it.each(['pymupdf', 'fitz', 'mutool'])('reports %s pinned in pyproject.toml', (name) => {
    const pyproject = `[project]\ndependencies = ["${name}==1.0.0"]\n`;
    const findings = pythonFindings(pyproject, CLEAN_LOCK);
    expect(findings.length, findings.join('\n')).toBe(1);
    expect(findings[0]).toContain('cad/pyproject.toml');
    expect(findings[0]).toContain(name);
  });

  it('reports a banned distribution that only uv.lock knows about', () => {
    const lock = '[[package]]\nname = "pymupdf"\nversion = "1.24.0"\n';
    const findings = pythonFindings(CLEAN_PYPROJECT, lock);
    expect(findings.length, findings.join('\n')).toBe(1);
    expect(findings[0]).toContain('cad/uv.lock');
  });

  it('is clean on a manifest pair that names nothing banned', () => {
    expect(pythonFindings(CLEAN_PYPROJECT, CLEAN_LOCK)).toEqual([]);
  });
});
