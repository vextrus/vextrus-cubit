/**
 * `pnpm checkup` — V-CHECKUP: "The machine's report: node/pnpm/uv/typst/libredwg pins and
 * hashes, Postgres reachable, roles, ledger drift, ports bindable, storage root, env; runs
 * at session start."
 *
 * A report reads every item before it draws a conclusion — checkup does not fail fast —
 * but it never ends "ok" after a FAIL. Armed here: node, pnpm, uv. typst and libredwg are
 * not installed by this increment (their pins are recorded in docs/toolchain.md), and
 * postgres, ports, storage and env have no roles, no storage root and no env contract to
 * check against until the database and e2e increments define them; each carries the
 * recorded reason rather than a green light for something nobody has defined.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_NOT_YET_BUILT, REPO, detail, say } from './lib/lane.mjs';

const read = (relative) => readFileSync(join(REPO, relative), 'utf8');

const version = (file, args) => {
  const result = spawnSync(file, args, { cwd: REPO, encoding: 'utf8' });
  if (result.error !== undefined) throw new Error(`${file} is not runnable — ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${file} ${args.join(' ')} exited ${result.status}`);
  return `${result.stdout ?? ''}`.trim();
};

/**
 * Node: the .nvmrc pin is the whole statement — `24` today (C-06, AC-5).
 *
 * The pin says as much as it says: `24` pins the major, `24.5` the minor, `24.5.1` the
 * patch. So the check compares the segments the pin actually writes, and no more — reading
 * only the major would pass a mismatched patch, and comparing a full pin against the major
 * alone would FAIL forever on a correctly pinned machine (B-05: a mechanical guardrail
 * fires on the right condition).
 */
function checkNode() {
  const pin = read('.nvmrc').trim();
  const wanted = pin.replace(/^v/, '').split('.');
  const found = process.versions.node.split('.');
  detail(`node ${process.version} against the .nvmrc pin ${pin}`);
  if (!/^v?\d+(\.\d+)*$/.test(pin)) return `.nvmrc pins ${pin}, which is not a Node version`;
  if (!wanted.every((part, i) => found[i] === part)) {
    return `node ${process.version} is not the .nvmrc pin ${pin}`;
  }
  return null;
}

/** pnpm: exact, via corepack, from package.json's packageManager field. */
function checkPnpm() {
  const manifest = JSON.parse(read('package.json'));
  const pinned = typeof manifest.packageManager === 'string' ? manifest.packageManager : '';
  if (!pinned.startsWith('pnpm@')) return 'package.json does not pin packageManager to a pnpm version';
  const wanted = pinned.slice('pnpm@'.length).split('+')[0];
  const found = version('pnpm', ['--version']);
  detail(`pnpm ${found} against the packageManager pin ${wanted}`);
  if (found !== wanted) return `pnpm ${found} is not the packageManager pin ${wanted}`;
  return null;
}

/**
 * uv: the Python toolchain's installer. uv itself is a bootstrapper and is not pinned by
 * version — what is pinned is what it serves: Python 3.13 in cad/pyproject.toml, and every
 * package in cad/uv.lock.
 */
function checkUv() {
  const found = version('uv', ['--version']);
  const requires = /requires-python\s*=\s*["']([^"']+)["']/.exec(read('cad/pyproject.toml'));
  if (requires === null) return 'cad/pyproject.toml does not pin requires-python';
  const pin = requires[1];
  detail(`${found} serving the cad/pyproject.toml pin requires-python ${pin}`);
  if (!pin.includes('3.13')) return `cad/pyproject.toml pins Python ${pin}, not 3.13`;
  return null;
}

/** The roster, in order. An item with no check is not armed yet (C-06). */
const ITEMS = [
  { name: 'node', check: checkNode },
  { name: 'pnpm', check: checkPnpm },
  { name: 'uv', check: checkUv },
  { name: 'typst' },
  { name: 'libredwg' },
  { name: 'postgres' },
  { name: 'ports' },
  { name: 'storage' },
  { name: 'env' },
];

const oneLine = (text) => `${text}`.replace(/\s+/g, ' ').trim();

let failed = false;

for (const item of ITEMS) {
  if (item.check === undefined) {
    say(`checkup: ${item.name} ${LANE_NOT_YET_BUILT}`);
    continue;
  }
  let reason = null;
  try {
    reason = item.check();
  } catch (error) {
    reason = oneLine(error instanceof Error ? error.message : error);
  }
  if (reason === null) {
    say(`checkup: ${item.name} ok`);
    continue;
  }
  say(`checkup: ${item.name} FAIL ${oneLine(reason)}`);
  failed = true;
}

if (failed) {
  // A report that ends "ok" after a FAIL is a lie, and the exit code says so too.
  process.exitCode = 1;
} else {
  say('checkup: ok');
}
