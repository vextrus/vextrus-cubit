/**
 * AC-3 — the method is enumerated as `conventions.resolve@1` in a manifest shard beside it, and the
 * shard arms V-VERIFY's method-hash stage.
 *
 * The stage is driven as the chain drives it — the shipped script, run as a process, judged by its
 * exit code and its stdout — and the roster is asked through its one exported home rather than
 * through a list transcribed here (C-06: a lane's status is the tree's answer, never a flag).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { deriveLanes } from "../../../../scripts/lib/lanes.mjs";
import { REPO_ROOT, productModule } from "../support/partition-stage";
import {
  METHOD_HASH_GREEN,
  METHOD_HASH_LANE,
  METHOD_HASH_SCRIPT,
  METHOD_ID,
  METHOD_LAW,
  METHOD_SHARD,
  RESOLVE_MODULE,
  RULE_ID,
  RULE_VERSION,
  resolveDoor,
} from "../support/conventions-stage";

/** What the shard records for one method (AC-3). */
type Declaration = { ruleId: string; version: string; law: string; module: string };

/** The shard as it is read back: the methods it enumerates, and the digest it records over them. */
type Manifest = { methods?: Record<string, Declaration>; digest?: string };

/**
 * The manifest, loaded as the declaration it is — the shard is data the product publishes, and it
 * is asked for by the same loader every other published surface is asked for by. Nothing here reads
 * its text: what it SAYS is what the stage below is then made to verify.
 */
async function manifest(): Promise<Manifest> {
  const loaded = await productModule<{ default?: Manifest } & Manifest>(METHOD_SHARD);
  return loaded.default ?? loaded;
}

/**
 * The separator the toolchain's digests are built on: a NUL byte, which no method id, declaration
 * or JSON text can itself hold (arbitration, this file's AC-3 digest case). Spelled through its
 * code point because the byte cannot be written into this file as a literal.
 */
const SEPARATOR = String.fromCharCode(0);

/** The digest the stage recomputes: every method id and its declaration, in code-point order. */
function digestOf(methods: Record<string, Declaration>): string {
  const hash = createHash("sha256");
  for (const id of Object.keys(methods).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
    hash.update(id);
    hash.update(SEPARATOR);
    hash.update(JSON.stringify(methods[id]));
    hash.update(SEPARATOR);
  }
  return hash.digest("hex");
}

describe("AC-3: the method is enumerated, and its digest is recorded", () => {
  test("AC-3: resolve.ts publishes the pair an edition would cite the method by", async () => {
    const door = await resolveDoor();
    expect(door.CONVENTIONS_METHOD, `${RESOLVE_MODULE} enumerates the method as (rule id, version) — the form an edition's method roster holds (L-CAD-08)`).toEqual({
      ruleId: RULE_ID,
      version: RULE_VERSION,
    });
  });

  test("AC-3: the shard enumerates that one method, and nothing else", async () => {
    const shard = await manifest();
    const methods = shard.methods ?? {};
    expect(Object.keys(methods), `${METHOD_SHARD} enumerates this increment's one method, keyed \`${METHOD_ID}\``).toEqual([METHOD_ID]);
    expect(methods[METHOD_ID], "and records what it is: the pair, the law it implements and the module that is it").toEqual({
      ruleId: RULE_ID,
      version: RULE_VERSION,
      law: METHOD_LAW,
      module: RESOLVE_MODULE,
    });
  });

  test("AC-3: the recorded digest is the digest of what the shard enumerates", async () => {
    const shard = await manifest();
    expect(shard.digest, `${METHOD_SHARD} records the sha256 of its own methods — a declaration edited without re-recording it is the drift this stage exists to catch`).toBe(
      digestOf(shard.methods ?? {}),
    );
  });
});

describe("AC-3: the method-hash stage is armed and green", () => {
  test("AC-3: the roster reports the method-hash lane armed", () => {
    const lane = deriveLanes(REPO_ROOT).find((entry) => entry.id === METHOD_HASH_LANE);
    expect(lane, `the roster knows a lane named ${METHOD_HASH_LANE} (V-VERIFY)`).toBeTruthy();
    expect(
      lane?.status,
      `a manifest in the tree arms the stage by itself: the status is the tree's own answer about its input, never a flag (C-06). The lane probes ${lane?.probe ?? "nothing"}`,
    ).toBe("armed");
  });

  test("AC-3: the shipped stage verifies the recorded digest and says so", () => {
    const ran = spawnSync(process.execPath, [join(REPO_ROOT, METHOD_HASH_SCRIPT)], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    const said = `${ran.stdout ?? ""}${ran.stderr ?? ""}`;
    expect(ran.status, `\`node ${METHOD_HASH_SCRIPT}\` exits 0 over a tree whose manifests are recorded truly:\n${said.slice(-1200)}`).toBe(0);
    expect(said, `and it reports what it checked — an armed stage that prints nothing has proved nothing (C-06)`).toContain(METHOD_HASH_GREEN);
  });
});
