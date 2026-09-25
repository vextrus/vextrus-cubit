#!/usr/bin/env node
// PreToolUse guard: refuses the few acts this repository forbids, naming the rule and the lawful path.
// Self-contained (no repo imports), so it runs in local and cloud sessions alike. Anything it cannot
// read is allowed through: the guard refuses what it recognises and is never why a session cannot work.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** A shell command cut into simple commands; rules read each one at its command position. */
const segments = (command) =>
  command
    .split(/\n|;|&&|\|\||\|/)
    .map((part) => part.trim())
    .filter((part) => part !== "");

const SECRET_NAME = String.raw`[A-Z0-9_]*(?:API_KEY|_KEY|TOKEN|SECRET|PASSWORD)`;
const SECRET_EXPANSION = new RegExp(String.raw`\$(?:${SECRET_NAME}\b|\{${SECRET_NAME}\})`);
const SECRET_FILES = /(?:~|\$HOME|\/home\/[^/\s]+)\/(?:\.bashrc|\.bash_profile|\.profile|\.zshrc|\.claude\/\.credentials\.json)\b/;

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

const GIT = String.raw`^(?:[A-Z_]+=\S*\s+)*git\s+(?:-C\s+\S+\s+)?`;
const gitVerb = (verb) => new RegExp(`${GIT}${verb}\\b(.*)$`);
const args = (rest) => (rest ?? "").split(/\s+/).filter((arg) => arg !== "");

const BASH_RULES = [
  {
    rule: "SECRET_PRINTED",
    fires: (parts) => parts.some(secretPrint),
    reason:
      'This would print a secret. TYPESAFE_API_KEY and every *_KEY/TOKEN/SECRET/PASSWORD are never printed, written or committed. Test presence with `[ -n "$TYPESAFE_API_KEY" ] && echo set`.',
  },
  {
    rule: "STAGE_ALL",
    fires: (parts) =>
      parts.some((part) => {
        const add = gitVerb("add").exec(part);
        if (add && args(add[1]).some((a) => ["-A", "--all", ".", ":/", "*", "--no-ignore-removal"].includes(a))) return true;
        const commit = gitVerb("commit").exec(part);
        return commit !== null && args(commit[1]).some((a) => a === "--all" || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a));
      }),
    reason: "Stage explicit paths (`git add <file> …`). The owner's untracked files and .private/ never enter a commit.",
  },
  {
    rule: "PRIVATE_STAGED",
    fires: (parts) =>
      parts.some((part) => {
        const add = gitVerb("add").exec(part);
        return add !== null && args(add[1]).some((a) => a === "-f" || a === "--force" || a.includes(".private") || /\.(dwg|dxf|rvt|ifc)$/i.test(a));
      }),
    reason:
      "Real drawings (the Edison set, the Sample Project, client sets) and everything derived from them live in .private/ and never enter git. A forced add of an ignored path is refused for the same reason.",
  },
  {
    rule: "GIT_CLEAN",
    fires: (parts) => parts.some((part) => gitVerb("clean").test(part)),
    reason: "`git clean` deletes untracked files, the owner's own files and .private/ among them. Remove the files you made by name.",
  },
  {
    rule: "HISTORY_REWRITTEN",
    fires: (parts) =>
      parts.some(
        (part) => /\s(?:--force|-f|--force-with-lease)\b/.test(part) && gitVerb("push").test(part),
      ) || parts.some((part) => gitVerb("(?:filter-branch|filter-repo)").test(part)),
    reason: "History is append-only: no forced push and no history rewrite. A wrong commit is corrected by the next commit.",
  },
  {
    rule: "HOOKS_SKIPPED",
    fires: (parts) => parts.some((part) => /^(?:[A-Z_]+=\S*\s+)*git\s/.test(part) && /\s--no-verify\b/.test(part)),
    reason: "`--no-verify` skips the checks a commit or push is owed. Fix what they refuse instead.",
  },
  {
    rule: "MERGE_BY_AGENT",
    fires: (parts) =>
      parts.some((part) => /^(?:[A-Z_]+=\S*\s+)*gh\s+pr\s+merge\b/.test(part) || (/^(?:[A-Z_]+=\S*\s+)*gh\s+api\b/.test(part) && /\/(?:pulls\/\d+\/merge|statuses\/|check-runs)\b/.test(part))),
    reason: "Only the owner merges (ADR 0025), and only the key user posts the real-drawing status (ADR 0030). Open the PR, state what was and was not verified, and stop.",
  },
  {
    rule: "PRIVILEGE_RAISED",
    fires: (parts) => parts.some((part) => /^(?:[A-Z_]+=\S*\s+)*(?:sudo|su|doas|pkexec|(?:\S*\/)?wsl(?:\.exe)?)(?:\s|$)/.test(part)),
    reason: "Agent sessions never raise privilege: Answer Keys live with another user (ADR 0026). If something needs root, say what and the owner runs it with `! <command>`.",
  },
  {
    rule: "LABORATORY_READ",
    fires: (parts) => parts.some((part) => /(?:~|\$HOME|\/home\/[^/\s]+|\.\.)\/vextrus-cad(?:\/|\s|$|["'])/.test(part)),
    reason: "The laboratory (~/vextrus-cad) holds Answer Keys and is never read by a Vextrus session (ADR 0026). Its methods reach us only through documents the owner hands over.",
  },
  {
    rule: "POWERSHELL",
    fires: (parts) =>
      parts.some((part) => /^(?:(?:cmd(?:\.exe)?\s+\/c|start|exec|nohup|sudo)\s+)?(?:\S*\/)?(?:powershell|pwsh)(?:\.exe)?(?:\s|$)/i.test(part)),
    reason: "PowerShell is denied by the owner, and reaching it through Bash is the same act. Say what you need from Windows; the owner runs it with `! <command>`.",
  },
];

const FILE_RULES = [
  {
    rule: "REFERENCE_EDITED",
    fires: (relative) => relative.startsWith(".private/reference/"),
    reason: "The owner's reference drawings are read-only originals. Convert and annotate into .private/work/ instead.",
  },
];

function judge(tool, input) {
  if (tool === "Bash") {
    const parts = segments(typeof input.command === "string" ? input.command : "");
    for (const { rule, fires, reason } of BASH_RULES) if (fires(parts)) return { rule, reason };
    return null;
  }
  if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit") {
    const path = typeof input.file_path === "string" ? input.file_path : "";
    const base = root.endsWith("/") ? root : `${root}/`;
    const relative = path.startsWith(base) ? path.slice(base.length) : path;
    for (const { rule, fires, reason } of FILE_RULES) if (fires(relative)) return { rule, reason };
  }
  return null;
}

let event;
try {
  event = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const verdict = judge(String(event.tool_name ?? ""), event.tool_input ?? {});
if (verdict !== null) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${verdict.rule}: ${verdict.reason}`,
      },
    }),
  );
}
process.exit(0);
