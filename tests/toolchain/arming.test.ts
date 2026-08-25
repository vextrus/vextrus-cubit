// C-06, B-22, B-23 — the gate arms progressively and never lies about it. A stub records a skip
// naming the input root whose absence triggered it, and that skip vanishes the moment the input
// exists: the property is proved by planting each probe in a scratch root and watching the status
// flip, so no lane can be armed or silenced by anything but the tree.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { deriveLanes, deriveStages } from "../../scripts/lib/lanes.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The commands the gate decides merges with (B-22); verify is the chain these hang beside. */
const GATE_COMMANDS = ["pnpm checkup", "pnpm verify", "pnpm test:db", "pnpm e2e"];

/** Runners that report a stage of their own, with the argv that reaches them. */
const RUNNERS = [
  { stage: "e2e", argv: ["scripts/e2e.mjs", "--journey", "J-000"] },
  { stage: "test:db", argv: ["scripts/db-test.mjs"] },
];

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

function scratchRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "cubit-arming-"));
  scratches.push(dir);
  return dir;
}

/**
 * Create the smallest input that satisfies a probe, so the tree can be asked again. A probe naming
 * a glob is satisfied by one file at the shape it describes.
 */
function plant(rootDir: string, probe: string): string {
  const concrete = probe
    .split("/")
    .map((segment) => (segment === "**" ? "probed" : segment.replace(/\*/g, "probed")))
    .join("/");
  const target = join(rootDir, ...concrete.split("/"));
  const last = concrete.slice(concrete.lastIndexOf("/") + 1);
  if (last.includes(".")) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "");
  } else {
    mkdirSync(target, { recursive: true });
  }
  return concrete;
}

function workflows(): { file: string; text: string }[] {
  const dir = join(REPO_ROOT, ".github", "workflows");
  expect(existsSync(dir), ".github/workflows/ does not exist — no lane runs where merges are decided (B-22)").toBe(true);
  return readdirSync(dir)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") }));
}

describe("the skip vanishes the moment its input exists (C-06, B-23)", () => {
  const roster = [
    ...deriveLanes(REPO_ROOT).map((lane) => ({ ...lane, kind: "lane" as const })),
    ...deriveStages(REPO_ROOT).map((stage) => ({ ...stage, kind: "stage" as const })),
  ];

  test.each(roster.map((entry) => [entry.id, entry.probe, entry.kind] as const))(
    "%s arms itself when %s appears and not before",
    (id, probe, kind) => {
      const root = scratchRoot();
      const derive = kind === "lane" ? deriveLanes : deriveStages;
      expect(derive(root).find((entry) => entry.id === id)?.status, `${id} is armed on a root that has no ${probe}`).toBe("stub");

      const planted = plant(root, probe);
      const after = derive(root).find((entry) => entry.id === id);
      expect(after?.status, `${id} still records a skip although ${planted} now exists`).toBe("armed");
      expect(after?.probe, `${id} changed the input root it names once it was armed`).toBe(probe);
    },
  );

  test("planting one input arms only the lanes that were waiting for it", () => {
    const root = scratchRoot();
    plant(root, "tsconfig.json");
    const armed = deriveLanes(root).filter((lane) => lane.status === "armed");
    expect(armed.map((lane) => lane.id), "an unrelated lane armed itself on an input it does not read").toEqual(["types"]);
  });
});

describe("every runner records its skip in the one spelling (C-06)", () => {
  test.each(RUNNERS)("$stage prints SKIP <id> missing=<probe> and exits 0", ({ stage, argv }) => {
    const expected = deriveStages(REPO_ROOT).find((entry) => entry.id === stage);
    expect(expected?.status, `${stage} is armed on this tree — this fixture describes its stub`).toBe("stub");

    const result = spawnSync(process.execPath, argv, { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    expect(result.status, `${stage} exited ${String(result.status)}: ${result.stderr}`).toBe(0);
    expect(result.stdout, `${stage} did not record its skip`).toContain(`SKIP ${stage} missing=${expected?.probe}\n`);
    expect(result.stdout, `${stage} claimed to run a stage it has no inputs for`).not.toContain(`RUN ${stage}\n`);
  });
});

describe("B-22: every lane runs where merges are decided", () => {
  test("a workflow runs the gate's whole command surface on every pull request", () => {
    const files = workflows();
    expect(files.length, "no workflow file under .github/workflows/").toBeGreaterThan(0);
    const text = files.map((entry) => entry.text).join("\n");
    const missing = GATE_COMMANDS.filter((command) => !text.includes(command));
    expect(missing, "a guarantee proven on only one machine is not a guarantee (B-22)").toEqual([]);
    expect(/^on:$/m.test(text) && /^\s+pull_request:/m.test(text), "no workflow triggers on pull_request").toBe(true);
  });

  test("no workflow freezes the roster it should be deriving", () => {
    const laneIds = deriveLanes(REPO_ROOT).map((lane) => lane.id);
    const frozen: string[] = [];
    for (const { file, text } of workflows()) {
      for (const id of laneIds) {
        if (new RegExp(`(?:run|if)\\s*:[^\\n]*\\b${id.replace(/[-]/g, "[-]")}\\b`).test(text)) frozen.push(`${file} names the lane ${id}`);
      }
    }
    expect(frozen, "the workflow decides a lane's fate instead of letting the tree decide (C-06)").toEqual([]);
  });
});
