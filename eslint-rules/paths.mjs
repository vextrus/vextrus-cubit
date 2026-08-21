/**
 * Where a file sits, in repo-relative POSIX terms. Every seam rule is a statement about a
 * path — "only src/core/format.ts may touch Intl" — so the path question is asked once.
 */
import { isAbsolute, relative, sep } from 'node:path';

/** The linted file as a repo-relative path with forward slashes, or '' if it has none. */
export function repoPath(context) {
  const filename = context.filename ?? context.getFilename?.() ?? '';
  if (filename === '' || filename === '<input>' || filename === '<text>') return '';
  const cwd = context.cwd ?? process.cwd();
  const rel = isAbsolute(filename) ? relative(cwd, filename) : filename;
  return rel.split(sep).join('/');
}

/** True when the linted file is exactly this repo-relative file. */
export function isFile(context, rel) {
  return repoPath(context) === rel;
}

/** True when the linted file is inside this repo-relative directory. */
export function isUnder(context, dir) {
  const rel = repoPath(context);
  return rel === dir || rel.startsWith(`${dir}/`);
}
