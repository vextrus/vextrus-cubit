#!/usr/bin/env node
// Cleans dev-lane artifacts (ARCH-02, AM-19).
// Refuses cleanup while the dev server holds its lock, then removes only
// dev database (cubit_dev), dev build (.next-dev), and dev storage (storage/dev).
import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_DIST_DIR, DEV_SERVER_LOCK, heldBy } from "./lib/dist.mjs";
import { bootstrapUrl, DEV_DATABASE, dropDatabase } from "./lib/pg-database.mjs";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

export function cleanDevLane(rootDir = ROOT) {
  const devDistPath = join(rootDir, DEV_DIST_DIR);
  const devStoragePath = join(rootDir, "storage", "dev");

  // Refuse if dev server is running
  const holder = heldBy(devDistPath, DEV_SERVER_LOCK);
  if (holder !== null) {
    process.stderr.write(`REFUSE dev:clean: dev server is currently running (PID ${holder})\n`);
    return { ok: false, error: `dev server running (PID ${holder})` };
  }

  let droppedDb = false;
  let removedDist = false;
  let removedStorage = false;

  // 1. Drop dev database
  try {
    droppedDb = dropDatabase(DEV_DATABASE, bootstrapUrl());
    if (droppedDb) {
      process.stdout.write(`dev:clean dropped database ${DEV_DATABASE}\n`);
    } else {
      process.stdout.write(`dev:clean database ${DEV_DATABASE} was not present\n`);
    }
  } catch (err) {
    process.stderr.write(`dev:clean database drop warning: ${err instanceof Error ? err.message : String(err)}\n`);
  }

  // 2. Remove .next-dev
  if (existsSync(devDistPath)) {
    rmSync(devDistPath, { recursive: true, force: true });
    removedDist = true;
    process.stdout.write(`dev:clean removed ${DEV_DIST_DIR}\n`);
  }

  // 3. Remove storage/dev
  if (existsSync(devStoragePath)) {
    rmSync(devStoragePath, { recursive: true, force: true });
    removedStorage = true;
    process.stdout.write("dev:clean removed storage/dev\n");
  }

  return { ok: true, droppedDb, removedDist, removedStorage };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = cleanDevLane(ROOT);
  if (!result.ok) {
    process.exit(1);
  }
}
