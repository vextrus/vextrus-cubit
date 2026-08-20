#!/usr/bin/env node
/**
 * pnpm gen:fixtures — the fixture generators' skeleton (B-15).
 *
 * The synthetic fixture set (F-RCC6 and the rest of fixtures/README.md) belongs
 * to the takeoff lane. Until that lane exists there is nothing to generate, so
 * the generator names itself, names the fixtures it will own, and skips with the
 * recorded reason rather than writing a placeholder nobody asked for.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/run.mjs';

/** Each entry becomes a generator when its lane lands. */
const GENERATORS = [
  { id: 'F-RCC6', lane: 'takeoff', output: 'fixtures/drawings/f-rcc6.dxf' },
  { id: 'F-BOOK-PWD', lane: 'book', output: 'fixtures/books/pwd-sample.json' },
  { id: 'F-BID-OCE', lane: 'bid', output: 'fixtures/bids/oce-sample.json' },
];

const policy = path.join(ROOT, 'fixtures/README.md');
if (!existsSync(policy)) {
  // the fixture policy is the one fixture artefact this increment owns
  console.error('FIXTURE_MISSING fixtures/README.md — the fixture policy must be committed');
  process.exit(1);
}

for (const generator of GENERATORS) {
  console.log(`gen:fixtures ${generator.id} → ${generator.output} (lane ${generator.lane})`);
}
console.log('SKIP gen-fixtures LANE_NOT_YET_BUILT');
