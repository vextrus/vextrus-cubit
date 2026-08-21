/**
 * V-CHECKUP — the machine's report, run at session start.
 *
 * node/pnpm/uv/typst/libredwg pins and hashes, Postgres reachable, roles,
 * ledger drift, ports bindable, storage root, env. Three of those can be
 * answered by a tree that is nothing but a toolchain; the rest need a database
 * increment and an e2e lane before there is anything to report, so they carry
 * the recorded reason instead of a green light nobody earned.
 *
 * Unlike verify, checkup does not fail fast: a broken tool is worth knowing
 * about alongside everything else that is fine. Every item reports, then any
 * FAIL decides the exit code.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { NOT_YET_BUILT, at, say } from './lib/lane.mjs';

/**
 * @param {string} file
 * @param {readonly string[]} args
 */
function ask(file, args) {
  const result = spawnSync(file, [...args], { encoding: 'utf8' });
  if (result.error !== undefined) {
    return { ok: false, text: result.error.message };
  }
  const text = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status !== 0) {
    return { ok: false, text: `${file} ${args.join(' ')} exited ${result.status}: ${text}` };
  }
  return { ok: true, text };
}

/** A reason is one line: newlines would break the item grammar. @param {string} text */
const oneLine = (text) => text.replace(/\s+/g, ' ').trim().slice(0, 200);

/** @returns {string} the pin recorded in .nvmrc */
const nodePin = () => readFileSync(at('.nvmrc'), 'utf8').trim();

/** @returns {string} the pin recorded in package.json's packageManager */
function pnpmPin() {
  const pkg = JSON.parse(readFileSync(at('package.json'), 'utf8'));
  return String(pkg.packageManager ?? '').replace(/^pnpm@/, '').replace(/\+.*$/, '');
}

/** @returns {string} the pin recorded in cad/pyproject.toml's [tool.uv] */
function uvPin() {
  const pyproject = readFileSync(at('cad/pyproject.toml'), 'utf8');
  const pinned = /^\s*required-version\s*=\s*["']==\s*([^"'\s]+)["']/m.exec(pyproject);
  if (pinned === null || pinned[1] === undefined) {
    throw new Error('cad/pyproject.toml records no exact [tool.uv] required-version');
  }
  return pinned[1];
}

/**
 * The roster, in V-CHECKUP's order. An item's check returns null when it is
 * fine and a reason when it is not; `armed: false` items are not built yet.
 *
 * @type {ReadonlyArray<{ name: string, armed: boolean, check?: () => string | null }>}
 */
const ROSTER = [
  {
    name: 'node',
    armed: true,
    check() {
      const pin = nodePin();
      const running = process.versions.node;
      const major = running.split('.')[0];
      return major === pin
        ? null
        : `.nvmrc pins Node ${pin}, this process is ${running}`;
    },
  },
  {
    name: 'pnpm',
    armed: true,
    check() {
      const pin = pnpmPin();
      const answer = ask('pnpm', ['--version']);
      if (!answer.ok) {
        return oneLine(answer.text);
      }
      return answer.text === pin
        ? null
        : `package.json pins pnpm ${pin}, PATH answers ${oneLine(answer.text)}`;
    },
  },
  {
    name: 'uv',
    armed: true,
    check() {
      const pin = uvPin();
      const answer = ask('uv', ['--version']);
      if (!answer.ok) {
        return oneLine(answer.text);
      }
      const running = /\buv\s+(\d+\.\d+\.\d+)/.exec(answer.text);
      if (running === null || running[1] === undefined) {
        return `uv --version did not name a version: ${oneLine(answer.text)}`;
      }
      // "uv exists" is not what C-06 pins. The pin lives in cad/pyproject.toml,
      // where `uv run` itself enforces it; checkup says so at session start
      // rather than at the first cad-ruff failure.
      return running[1] === pin
        ? null
        : `cad/pyproject.toml pins uv ${pin}, PATH answers ${running[1]}`;
    },
  },
  // typst and libredwg are pinned on paper in docs/toolchain.md; the increment
  // that renders a document installs them and arms these two.
  { name: 'typst', armed: false },
  { name: 'libredwg', armed: false },
  // Postgres, the ports, the storage root and the environment all become
  // answerable when the database and e2e lanes exist.
  { name: 'postgres', armed: false },
  { name: 'ports', armed: false },
  { name: 'storage', armed: false },
  { name: 'env', armed: false },
];

let failed = false;

for (const item of ROSTER) {
  if (!item.armed) {
    say(`checkup: ${item.name} SKIP ${NOT_YET_BUILT}`);
    continue;
  }
  let reason = null;
  try {
    reason = item.check();
  } catch (error) {
    reason = oneLine(error instanceof Error ? error.message : String(error));
  }
  if (reason === null) {
    say(`checkup: ${item.name} ok`);
  } else {
    say(`checkup: ${item.name} FAIL ${reason}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

say('checkup: ok');
