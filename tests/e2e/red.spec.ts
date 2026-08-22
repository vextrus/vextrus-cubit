/**
 * HARNESS-RED — the declared DELIBERATE-BAD fixture (AC-3).
 *
 * A lane that cannot go red is not a lane. This spec fails on purpose, for ever: it is the
 * only thing in the tree that proves `pnpm e2e`'s exit status is the run's true status
 * rather than the teardown's. It is excluded from the default run and selected only by
 * `pnpm e2e --journey HARNESS-RED`, where the whole command must exit non-zero and must not
 * print `e2e: ok`.
 *
 * It takes no `page` fixture: the failure has to be the assertion's, never a server's.
 *
 * NEVER "fix" this file. Making it pass deletes the only proof that a red run is reported.
 */
import { expect, test } from '@playwright/test';

test('HARNESS-RED: the deliberate failure that proves the lane cannot report a silent green', () => {
  // RECORDED REASON DELIBERATE-BAD — this expectation is required to fail (AC-3).
  expect(
    'this spec fails on purpose',
    'HARNESS-RED failed, which is what it is for: the exit status of `pnpm e2e` must now be non-zero',
  ).toBe('and the lane must report it');
});
