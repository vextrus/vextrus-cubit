// Focused tests for the local development lane (ARCH-02, C-06; docs/decisions/dev-lane.md).
// Validates CLI options parsing, lockfile enforcement, .env.example declaration parity,
// and the founder authentication cryptographic contract without opening a database.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ENV_NAMES } from "../../src/core/env";
import { verifyPassword } from "../../src/server/auth/secrets";
import { DEV_FOUNDER, DEV_PROJECT, DEV_TENANT, seedPasswordHash } from "../../db/seed";
import { modelFixtureRoot, parseArgs } from "../../scripts/dev.mjs";
import { cleanDevLane } from "../../scripts/dev-clean.mjs";
import { DEV_DIST_DIR, DEV_SERVER_LOCK, heldBy, holdDistDir } from "../../scripts/lib/dist.mjs";

describe("dev lane CLI argument parser", () => {
  test("defaults to port 3210, localhost, worker enabled, and no reset", () => {
    const opts = parseArgs([]);
    expect(opts.port).toBe(3210);
    expect(opts.host).toBe("127.0.0.1");
    expect(opts.hostSpecified).toBe(false);
    expect(opts.worker).toBe(true);
    expect(opts.reset).toBe(false);
  });

  test("parses custom port flag both spaced and joined", () => {
    expect(parseArgs(["--port", "4000"]).port).toBe(4000);
    expect(parseArgs(["--port=4001"]).port).toBe(4001);
  });

  test("parses --host flag with and without explicit address", () => {
    const defaultHost = parseArgs(["--host"]);
    expect(defaultHost.host).toBe("0.0.0.0");
    expect(defaultHost.hostSpecified).toBe(true);

    const explicitHost = parseArgs(["--host", "192.168.1.50"]);
    expect(explicitHost.host).toBe("192.168.1.50");
    expect(explicitHost.hostSpecified).toBe(true);

    const joinedHost = parseArgs(["--host=10.0.0.1"]);
    expect(joinedHost.host).toBe("10.0.0.1");
    expect(joinedHost.hostSpecified).toBe(true);
  });

  test("parses --no-worker and --reset flags", () => {
    const opts = parseArgs(["--no-worker", "--reset"]);
    expect(opts.worker).toBe(false);
    expect(opts.reset).toBe(true);
  });
});

describe("dev lane build and lock isolation", () => {
  test("declares dedicated dev dist dir .next-dev and dev lockfile name", () => {
    expect(DEV_DIST_DIR).toBe(".next-dev");
    expect(DEV_SERVER_LOCK).toBe(".dev-server.lock");
  });

  test("heldBy returns current PID when active lockfile exists and null when absent", () => {
    const scratch = join(tmpdir(), `cubit-test-lock-${Date.now()}`);
    mkdirSync(scratch, { recursive: true });
    try {
      expect(heldBy(scratch, DEV_SERVER_LOCK)).toBeNull();

      const release = holdDistDir(scratch, 3210, DEV_SERVER_LOCK);
      expect(heldBy(scratch, DEV_SERVER_LOCK)).toBe(process.pid);

      release();
      expect(heldBy(scratch, DEV_SERVER_LOCK)).toBeNull();
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test("cleanDevLane refuses cleanup when dev server lock is held by a live process", () => {
    const scratch = join(tmpdir(), `cubit-test-clean-${Date.now()}`);
    const devDir = join(scratch, DEV_DIST_DIR);
    mkdirSync(devDir, { recursive: true });
    writeFileSync(join(devDir, DEV_SERVER_LOCK), `${JSON.stringify({ pid: process.pid, port: 3210 })}\n`);

    try {
      const result = cleanDevLane(scratch);
      expect(result.ok).toBe(false);
      expect(result.error).toContain(`dev server running (PID ${process.pid})`);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

describe(".env.example environment declaration parity", () => {
  test(".env.example declares all seven runtime environment variables", () => {
    const content = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
    for (const name of ENV_NAMES) {
      expect(content, `.env.example does not declare ${name}`).toMatch(new RegExp(`^${name}=`, "m"));
    }
  });
});

/**
 * THE MODEL FIXTURE ROOT (L-AI-01, F-MODEL; found 2026-09-21). With no TypeSafe key the dev lane
 * replays recorded model answers, and the corpus of those answers lives in `fixtures/model`
 * (fixtures/model/README.md). The lane and `.env.example` both pointed at `fixtures/rcc6` — the
 * drawing corpus, which holds no recorded answer — so every model request the lane made was refused
 * FIXTURE_MISSING, and nobody running `pnpm dev` could reach a Jev answer without a live key.
 */
describe("the dev lane replays model answers from the corpus's own home", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));

  test("with nothing configured the root is fixtures/model, which holds the corpus", () => {
    expect(modelFixtureRoot({}, root)).toBe(join(root, "fixtures/model"));
    expect(modelFixtureRoot({ CUBIT_MODEL_FIXTURE_ROOT: "   " }, root), "a blank value is nothing configured").toBe(join(root, "fixtures/model"));
    expect(existsSync(join(root, "fixtures/model/README.md")), "the corpus's own README stands at the default root").toBe(true);
  });

  test("a configured root is taken as given, so a session may point the seam at a minted corpus (Q-08)", () => {
    expect(modelFixtureRoot({ CUBIT_MODEL_FIXTURE_ROOT: "/tmp/minted" }, root)).toBe("/tmp/minted");
  });

  test(".env.example names the same home, never the drawing corpus", () => {
    const content = readFileSync(join(root, ".env.example"), "utf8");
    expect(content).toMatch(/^CUBIT_MODEL_FIXTURE_ROOT=fixtures\/model$/m);
    expect(content).not.toMatch(/^CUBIT_MODEL_FIXTURE_ROOT=fixtures\/rcc6/m);
  });
});

/**
 * A CITATION NAMES LAW THE BIBLE CARRIES. The dev lane's files cited a nineteenth amendment as if it were an
 * amendment of the Bible; the Bible's amendments end at AM-18, and the lane's ADR only DRAFTS the next. A
 * comment that cites an amendment nobody wrote teaches the next reader a law that does not exist,
 * so every `AM-nn` these files name must stand in `docs/specs/cubit.bible.xml`'s `<amendments>`.
 */
describe("the dev lane cites only amendments the Bible carries", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const bible = readFileSync(join(root, "docs/specs/cubit.bible.xml"), "utf8");
  const carried = new Set([...bible.matchAll(/<[a-zA-Z]+\b[^>]*\bid="(AM-\d+)"/g)].map((match) => match[1]));

  test.each(["scripts/dev.mjs", "scripts/dev-clean.mjs", "docs/dev.md", "docs/decisions/dev-lane.md", ".env.example", "tests/toolchain/dev-lane.test.ts"])("%s", (file) => {
    const cited = new Set([...readFileSync(join(root, file), "utf8").matchAll(/\bAM-\d+\b/g)].map((match) => match[0]));
    for (const id of cited) expect(carried.has(id), `${file} cites ${id}, which the Bible does not carry`).toBe(true);
  });

  test("the Bible does carry amendments — an empty roster would make the test above vacuous", () => {
    expect(carried.size).toBeGreaterThan(0);
  });
});

describe("canonical founder identity and cryptographic contract", () => {
  test("founder password verifies using the repository auth scrypt contract", async () => {
    expect(DEV_FOUNDER.email).toBe("founder@cubit.dev");
    expect(DEV_FOUNDER.password).toBe("cubit-dev-founder-password");
    expect(DEV_TENANT.tenantId).toBe("d3e00000-0000-4000-8000-000000000001");
    expect(DEV_PROJECT.projectId).toBe("d3e00000-0000-4000-8000-000000000002");

    // Format is $scrypt$ln=15,r=8,p=1$<salt>$<digest>
    const hash = seedPasswordHash(DEV_FOUNDER.password);
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);

    const valid = await verifyPassword(DEV_FOUNDER.password, hash);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("incorrect-password", hash);
    expect(invalid).toBe(false);
  });
});
