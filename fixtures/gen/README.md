# Fixture generators

The skeleton C-06 (B-15) asks the Foundation increment to plant. A generator lives here when the
increment that needs its corpus lands; today the directory holds no generator, and nothing in the
toolchain pretends otherwise — no lane probes this path, so nothing here can make a lane look armed.

A generator that lands here:

- writes its corpus under `fixtures/<name>/`, never into `src/**` or `tests/lint-fixtures/**`;
- is deterministic — same inputs, byte-identical output — so a golden test can compare without a
  re-baseline (Q-08);
- is runnable on its own (`node fixtures/gen/<name>.mjs`) and re-runnable in place;
- records what it generated and from which source, so a stale corpus is visible rather than quiet
  (B-23).

The lint fixture corpus at `tests/lint-fixtures/**` is *not* generated: every payload there is
written by hand and read by the toolchain suite, because a rule is proven against the exact shape a
person would write (Q-01).
