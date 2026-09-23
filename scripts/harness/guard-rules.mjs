// The session guard (B-05, B-16): what a Claude Code session in this checkout may not do through a
// tool, each refusal naming its rule and the lawful path. `.claude/hooks/guard.mjs` is the only
// caller — a PreToolUse hook hands it the tool call — and tests/harness/guard-rules.test.ts proves
// every rule fires on the spellings sessions have used and stays quiet on the lawful ones.
//
// Pure: a verdict is a function of the tool call and of the facts handed in, never of the machine.
// A rule here exists because a session did the thing, or because the owner forbade it by name; a
// rule the product's own scripts already enforce (the gate's served-port refusals) is not repeated.

/** @typedef {{ tool: string, input: Record<string, unknown> }} ToolCall */
/** @typedef {{ root: string, tracked?: (relativePath: string) => boolean }} Facts */
/** @typedef {{ rule: string, reason: string }} Refusal */

/**
 * A shell command cut into the simple commands it runs, so a rule reads one command at a time.
 * @param {string} command
 * @returns {string[]}
 */
export function segments(command) {
  return command
    .split(/\n|;|&&|\|\||\|/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

const SECRET_NAME = String.raw`[A-Z0-9_]*(?:API_KEY|_KEY|TOKEN|SECRET|PASSWORD)`;
/** A secret-named variable expanded plainly — `${#NAME}` (its length) and `${NAME:+set}` say nothing of it. */
const SECRET_EXPANSION = new RegExp(String.raw`\$(?:${SECRET_NAME}\b|\{${SECRET_NAME}\})`);
const SECRET_FILES = /(?:~|\$HOME|\/home\/[^/\s]+)\/(?:\.bashrc|\.bash_profile|\.profile|\.zshrc|\.claude\/\.credentials\.json)\b/;
const PRESENCE = '[ -n "$TYPESAFE_API_KEY" ] && echo set';

/** @param {string} segment */
function secretPrint(segment) {
  const words = segment.split(/\s+/);
  const verb = words[0] ?? "";
  if (verb === "printenv" && (words.length === 1 || new RegExp(`^${SECRET_NAME}$`).test(words[1] ?? ""))) return true;
  if (verb === "env" && words.length === 1) return true;
  if ((verb === "export" || verb === "declare") && (words.length === 1 || /^-[a-z]*p/.test(words[1] ?? ""))) return true;
  if (verb === "set" && words.length === 1) return true;
  if ((verb === "echo" || verb === "printf") && SECRET_EXPANSION.test(segment)) return true;
  return SECRET_FILES.test(segment) && /^(?:cat|less|more|head|tail|grep|rg|ugrep|sed|awk|bat|strings|xxd|od)\b/.test(verb);
}

const GIT = String.raw`\bgit\s+(?:-C\s+\S+\s+)?`;
const GIT_ADD = new RegExp(`${GIT}add\\b(.*)$`);
const GIT_COMMIT = new RegExp(`${GIT}commit\\b(.*)$`);

/** @param {string} args */
const argList = (args) => args.split(/\s+/).filter((arg) => arg !== "");

/**
 * The Bash rules, in the order they are asked.
 * @type {ReadonlyArray<{ rule: string, fires: (command: string, parts: string[]) => boolean, reason: string }>}
 */
const BASH_RULES = [
  {
    rule: "SECRET_PRINTED",
    fires: (_command, parts) => parts.some(secretPrint),
    reason: `This would print a secret: TYPESAFE_API_KEY (in ~/.bashrc) and every *_KEY/TOKEN/SECRET are never printed, written or committed. Test presence with \`${PRESENCE}\`; the live transport reads the key itself.`,
  },
  {
    rule: "STAGE_ALL",
    fires: (_command, parts) =>
      parts.some((part) => {
        const add = GIT_ADD.exec(part);
        if (add !== null && argList(add[1] ?? "").some((arg) => ["-A", "--all", ".", ":/", "*", "--no-ignore-removal"].includes(arg))) return true;
        const commit = GIT_COMMIT.exec(part);
        return commit !== null && argList(commit[1] ?? "").some((arg) => arg === "--all" || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(arg));
      }),
    reason:
      "Stage explicit paths (`git add <file> …`). The owner's untracked files (.agents/, .idea/, .junie/, AGENTS.md, cov.html) and .private/ never enter a commit, and `git add -A` once swept 152 files into a lint commit.",
  },
  {
    rule: "PRIVATE_STAGED",
    fires: (_command, parts) =>
      parts.some((part) => {
        const add = GIT_ADD.exec(part);
        return add !== null && argList(add[1] ?? "").some((arg) => arg === "-f" || arg === "--force" || arg.includes(".private") || /\.dwg$/i.test(arg));
      }),
    reason:
      "The Edison drawings and everything derived from them live in .private/ and never enter this public repository (L-CAD-09; the thesis: Edison is never demo content). A forced add of an ignored path is refused for the same reason.",
  },
  {
    rule: "GIT_CLEAN",
    fires: (_command, parts) => parts.some((part) => new RegExp(`${GIT}clean\\b`).test(part)),
    reason: "`git clean` deletes untracked files: the owner's own files and .private/ among them. Remove the files you made by name; `pnpm e2e:clean` takes the lanes' leavings.",
  },
  {
    rule: "HISTORY_REWRITTEN",
    fires: (_command, parts) =>
      parts.some((part) => new RegExp(`${GIT}(?:push\\b.*(?:\\s--force\\b|\\s-f\\b|\\s--force-with-lease\\b)|filter-branch\\b|filter-repo\\b)`).test(part)),
    reason: "History is append-only here: no forced push and no history rewrite. A wrong commit is corrected by the next commit.",
  },
  {
    rule: "HOOKS_SKIPPED",
    fires: (command) => /\s--no-verify\b/.test(command),
    reason: "`--no-verify` skips the checks a commit or push is owed. Fix what they refuse instead.",
  },
  {
    rule: "BASELINE_OVERWRITTEN",
    fires: (command) => /--update-snapshots\b/.test(command) || /\bplaywright\s+test\b.*\s-u\b/.test(command),
    reason:
      "A design picture a lawful change moved is the gate's to re-take (`pnpm e2e:retake <journey>`, committed alone under a `baseline:` subject that names the proof), never `--update-snapshots`.",
  },
  {
    rule: "POWERSHELL",
    // Read at command position only, so a commit message that names PowerShell is not a call to it.
    fires: (_command, parts) =>
      parts.some((part) => /^(?:(?:cmd(?:\.exe)?\s+\/c|start|exec|nohup|sudo)\s+)?(?:\S*\/)?(?:powershell|pwsh)(?:\.exe)?(?:\s|$)/i.test(part)),
    reason: "PowerShell is denied on this machine by the owner, and reaching it through Bash is the same act. Say what you need from Windows and the owner will run it (`! <command>`).",
  },
  {
    rule: "PSQL_WRITE",
    fires: (_command, parts) =>
      parts.some((part) => /^psql\b/.test(part) && /\b(?:insert|update|delete|drop|truncate|alter|create|grant|revoke|reindex|vacuum|copy)\s/i.test(part)),
    reason:
      "A session does not write the product's databases by hand. Read through the cubit MCP `db_read` tool (read-only, project-scoped, system reason set); change state through the product's doors, a migration, or the lane that owns the database.",
  },
];

/** @param {string} path @param {string} root */
function relativeTo(path, root) {
  const normalRoot = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(normalRoot) ? path.slice(normalRoot.length) : path;
}

/**
 * The file rules, asked of Edit and Write.
 * @type {ReadonlyArray<{ rule: string, fires: (relative: string, facts: Facts) => boolean, reason: string }>}
 */
const FILE_RULES = [
  {
    rule: "BIBLE_EDITED",
    fires: (relative) => relative.startsWith("docs/specs/"),
    reason:
      "The Bible (docs/specs/**) is the owner's. Where it is wrong, depart from it by a Deviation in docs/decisions/deviations.md in the same commit; only the owner amends it.",
  },
  {
    rule: "HELDOUT_EDITED",
    fires: (relative) => relative.startsWith(".builder-heldout/"),
    reason: ".builder-heldout/ is the Verifier's held-out acceptance and is never a session's to write.",
  },
  {
    rule: "REFERENCE_EDITED",
    fires: (relative) => relative.startsWith(".private/reference/"),
    reason: "The owner's reference drawings are read-only originals. Convert and annotate into .private/work/ instead.",
  },
  {
    rule: "FROZEN_FIXTURE_EDITED",
    fires: (relative) => relative.startsWith("fixtures/rcc6/") || relative.startsWith("fixtures/model/"),
    reason:
      "F-RCC6 is byte-frozen at v1.1, and fixtures/model/ is the recorded Jev corpus, minted once by `scripts/model-corpus.ts` (record, then file). A regenerated fixture goes in its own `baseline:` commit naming the proof.",
  },
  {
    rule: "LANDED_MIGRATION_EDITED",
    fires: (relative, facts) => relative.startsWith("db/migrations/") && (facts.tracked?.(relative) ?? false),
    reason: "A landed migration is superseded, never edited: add the next-numbered migration beside it.",
  },
  {
    rule: "GENERATED_EDITED",
    fires: (relative) => relative === "next-env.d.ts",
    reason: "next-env.d.ts is Next's generated, untracked shim: never edit, commit or restore it.",
  },
];

/**
 * The verdict on one tool call: the first rule it breaks, or null.
 * @param {ToolCall} call
 * @param {Facts} facts
 * @returns {Refusal | null}
 */
export function judge(call, facts) {
  if (call.tool === "Bash") {
    const command = typeof call.input.command === "string" ? call.input.command : "";
    const parts = segments(command);
    for (const { rule, fires, reason } of BASH_RULES) if (fires(command, parts)) return { rule, reason };
    return null;
  }
  if (call.tool === "Edit" || call.tool === "Write" || call.tool === "NotebookEdit") {
    const path = typeof call.input.file_path === "string" ? call.input.file_path : "";
    const relative = relativeTo(path, facts.root);
    for (const { rule, fires, reason } of FILE_RULES) if (fires(relative, facts)) return { rule, reason };
  }
  return null;
}

/** Every rule's name, so the test can prove each one fires (B-19: derived, never a frozen list). */
export const RULES = Object.freeze([...BASH_RULES.map((entry) => entry.rule), ...FILE_RULES.map((entry) => entry.rule)]);
