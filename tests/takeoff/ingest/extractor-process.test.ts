/**
 * AC-4(b), AC-4(c) — the extractor as a process, and the checkout it is run from.
 *
 * A CLI that ignores SIGTERM outlives the timeout that fired at it: node sends the polite signal and
 * gives up, and what lands is SHEET_NOT_INGESTABLE — "this drawing cannot be read" — for a drawing
 * nobody ever finished reading (debt-src-modules-1nfq8rz). It is killed with a signal no process can
 * trap, and a run that hit the wall is thrown as the fault of ours that it is (ARCH-03).
 *
 * The root it runs from is the other half: the root resolution falls back to `process.cwd()` when it
 * finds no `cad/pyproject.toml` above either candidate (debt-src-modules-14jqag7), so a worker
 * started elsewhere silently runs the extractor against a directory holding no project. There is no
 * fallback, and the judgement is reachable: `checkoutRootAmong` says what it looked for.
 */
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

const REPO_ROOT = process.cwd();
const CLI_MODULE = "src/modules/takeoff/ingest/cli.ts";

/** How long the deaf extractor sleeps for, and how long the call gives it. */
const SLEEP_SECONDS = 30;
const TIMEOUT_MS = 500;

type CliSeam = {
  checkoutRootAmong: (candidates: readonly string[]) => string;
  ingestDrawing: (bytes: Uint8Array, format: string, options: { tempDir: string; timeoutMs?: number }) => Promise<unknown>;
};

async function cli(): Promise<CliSeam> {
  const absolute = join(REPO_ROOT, CLI_MODULE);
  expect(existsSync(absolute), `${CLI_MODULE} is missing from the checkout`).toBe(true);
  const module = (await import(absolute)) as Record<string, unknown>;
  for (const call of ["checkoutRootAmong", "ingestDrawing"]) {
    expect(typeof module[call], `${CLI_MODULE} publishes ${call} (AC-4(b), AC-4(c))`).toBe("function");
  }
  return module as unknown as CliSeam;
}

/** A stand-in extractor that traps the polite signal and outlives any patience: the row's own case. */
function deafExtractor(): string {
  const path = join(mkdtempSync(join(tmpdir(), "cubit-deaf-cad-")), "deaf-extractor.sh");
  writeFileSync(path, `#!/bin/sh\ntrap "" TERM\nsleep ${SLEEP_SECONDS}\n`, "utf8");
  chmodSync(path, 0o755);
  return path;
}

test("AC-4(c): the checkout is a candidate that stands under one, and never the current directory by default", async () => {
  const { checkoutRootAmong } = await cli();

  expect(
    () => checkoutRootAmong([tmpdir()]),
    "a candidate with no cad/pyproject.toml above it names no checkout, and the failure says what was looked for",
  ).toThrow("cad/pyproject.toml");
  expect(checkoutRootAmong([tmpdir(), REPO_ROOT]), "the first candidate that does stand under one is the checkout").toBe(REPO_ROOT);
});

test(
  "AC-4(b): an extractor that ignores the polite signal is killed, and the run says so",
  async () => {
    const { ingestDrawing } = await cli();
    const held = process.env["CUBIT_CAD_COMMAND"];
    process.env["CUBIT_CAD_COMMAND"] = deafExtractor();

    try {
      const answered = await ingestDrawing(new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n"), "dxf", {
        tempDir: mkdtempSync(join(tmpdir(), "cubit-ingest-")),
        timeoutMs: TIMEOUT_MS,
      }).then(
        (value) => ({ threw: false, said: JSON.stringify(value) }),
        (reason: unknown) => ({ threw: true, said: reason instanceof Error ? reason.message : String(reason) }),
      );

      expect(answered.threw, `a run that hit the wall is a fault of ours, never an answer about the drawing — it answered ${answered.said}`).toBe(true);
      expect(answered.said, "the signal that ended it is named, so an operator can tell a timeout from an unreadable drawing").toContain("SIGKILL");
      expect(answered.said, "and a killed run is never dressed as the drawing's own fault").not.toContain("SHEET_NOT_INGESTABLE");
    } finally {
      if (held === undefined) delete process.env["CUBIT_CAD_COMMAND"];
      else process.env["CUBIT_CAD_COMMAND"] = held;
    }
  },
  60_000,
);
