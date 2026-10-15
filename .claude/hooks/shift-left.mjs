#!/usr/bin/env node
// PreToolUse, Bash: the shift-left checks, advisory (S30-F2d, #895; #890). A builder's early warning at `git commit`
// and `gh pr create`; the walls stay `scripts.factory.publish`'s range scan and CI.
// - `git commit`: the leak scan of the staged blobs and the message (`python -m tools.leakscan staged`), the acceptance
//   check's per-commit rules (`python -m tools.lint.acceptance --staged`), and, on a READY commit, merge_ready's Cut
//   check on the message as publish makes the PR body of it (`python -m scripts.merge_ready --cut-message`).
// - `gh pr create`: the leak scan of the body file (`tools.leakscan file --no-stamp`) and the Cut check
//   (`scripts.merge_ready --cut-body`, offline: an item must link an issue; whether it is open is read at merge).
// It denies (exit 0, `permissionDecision: "deny"`, naming the check and `<path>:<line>`, never the hit's text) only when
// it judges the call exactly and a check fails. Whenever it cannot judge (a word quoted inside `git` or `commit`, git's
// environment or global options in the call, a folder or message known only at run time, standard input, an unquoted
// heredoc delimiter, anything earlier in the call that may change the index, an unknown git verb with commit's
// options, no corpus, a check that does not answer) it allows, with one line on stderr. A message passed as
// `-m "$(cat <<'EOF' ... EOF)"` (a quoted delimiter) is literal, so it is judged. It never writes the index and never
// fires a git hook: `git add` (and `commit -a`'s `add -u`) earlier in the call is replayed on a copy of the index, with
// `-c core.hooksPath=/dev/null`; every git it runs has optional locks, hooks and the fsmonitor off. The checks are
// found by this file's own location (VEXTRUS_PYTHON, else that checkout's .venv, else python3, run with -P).
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const OWN = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const VENV = join(OWN, ".venv/bin/python");
const PYTHON = process.env.VEXTRUS_PYTHON || (existsSync(VENV) ? VENV : "python3");
const DEADLINE_MS = 13_000; // registered with a 15 s timeout
const SHOWN = 5;

// ------------------------------------------------------------------------------------------------ the call's words

const word = () => ({ v: "", dyn: false, quoted: false, any: false, unquotedHeredoc: false });
// `"$(cat <<'EOF' ... EOF)"`: how builders pass a long message; with a quoted delimiter its body is literal.
const CAT_HEREDOC = /^\$\(\s*cat\s+<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2[ \t]*\n([\s\S]*?)\n\t*\3[ \t]*\n\s*\)/;

/** The end of a `$(` opened at `i` (the index after its `)`), skipping quotes and nested parentheses. */
function substitutionEnd(text, i) {
  let depth = 1;
  for (let k = i + 1; k < text.length; k += 1) {
    const c = text[k];
    if (c === "\\") k += 1;
    else if (c === "'") k = text.indexOf("'", k + 1) === -1 ? text.length : text.indexOf("'", k + 1);
    else if (c === "(") depth += 1;
    else if (c === ")" && (depth -= 1) === 0) return k + 1;
  }
  return text.length;
}

/** The call as simple commands: `{ words, heredoc, depth, piped, background, redirected }` each, and `hidden`: a
 * substitution or backquote whose text names a commit or a PR (run inside, so never judged). */
export function parse(text) {
  const found = [];
  const fresh = () => ({ words: [], heredoc: null, depth: 0, piped: false, background: false, redirected: false });
  let current = fresh();
  let w = word();
  let depth = 0;
  let pending = [];
  let skipNext = false;
  let pipedNext = false;
  let hidden = false;
  const inner = (body) => {
    w.dyn = true;
    w.any = true;
    if (/commit|pr\s+create/.test(body)) hidden = true;
  };
  const endWord = () => {
    if (w.any) {
      if (skipNext) skipNext = false;
      else current.words.push(w);
    }
    w = word();
  };
  const endCommand = ({ piped = false, background = false } = {}) => {
    endWord();
    Object.assign(current, { depth, piped: current.piped || piped || pipedNext, background });
    pipedNext = piped;
    if (current.words.length > 0) found.push(current);
    current = fresh();
  };
  const dollar = (i, quotedContext) => {
    const heredoc = quotedContext ? text.slice(i).match(CAT_HEREDOC) : null;
    if (heredoc) {
      w.any = true;
      if (heredoc[2] === "") (w.dyn = true), (w.unquotedHeredoc = true);
      else w.v += heredoc[1] === "-" ? heredoc[4].replace(/^\t+/gm, "") : heredoc[4];
      return i + heredoc[0].length;
    }
    if (text[i + 1] === "(") {
      const end = substitutionEnd(text, i + 1);
      inner(text.slice(i + 2, end - 1));
      return end;
    }
    w.dyn = true;
    w.any = true;
    if (text[i + 1] === "{") return text.indexOf("}", i) === -1 ? text.length : text.indexOf("}", i) + 1;
    if (text[i + 1] === "'") return text.indexOf("'", i + 2) === -1 ? text.length : text.indexOf("'", i + 2) + 1;
    const name = text.slice(i + 1).match(/^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/);
    return i + 1 + (name ? name[0].length : 0);
  };
  const backquote = (i) => {
    const end = text.indexOf("`", i + 1);
    inner(text.slice(i + 1, end === -1 ? text.length : end));
    return end === -1 ? text.length : end + 1;
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "\n") {
      const owners = pending;
      endCommand();
      i += 1;
      for (const { delimiter, quoted, owner } of owners) {
        const lines = text.slice(i).split("\n");
        const end = lines.findIndex((line) => line.replace(/^\t+/, "") === delimiter);
        const body = lines.slice(0, end === -1 ? lines.length : end).join("\n");
        owner.heredoc = { body: `${body}\n`, quoted };
        i += body.length + 1 + (end === -1 ? 0 : delimiter.length + 1);
      }
      pending = [];
    } else if (c === " " || c === "\t") {
      endWord();
      i += 1;
    } else if (c === "#" && !w.any) {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (c === "\\") {
      if (text[i + 1] !== "\n") Object.assign(w, { v: w.v + (text[i + 1] ?? ""), any: true, quoted: true });
      i += 2;
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1);
      Object.assign(w, { v: w.v + text.slice(i + 1, end === -1 ? text.length : end), any: true, quoted: true });
      i = end === -1 ? text.length : end + 1;
    } else if (c === '"') {
      Object.assign(w, { any: true, quoted: true });
      i += 1;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && '"\\$`\n'.includes(text[i + 1])) {
          if (text[i + 1] !== "\n") w.v += text[i + 1];
          i += 2;
        } else if (text[i] === "$" && /[A-Za-z_({0-9@*#?!$-]/.test(text[i + 1] ?? "")) i = dollar(i, true);
        else if (text[i] === "`") i = backquote(i);
        else (w.v += text[i]), (i += 1);
      }
      i += 1;
    } else if (c === "$" && /[A-Za-z_({0-9@*#?!$'-]/.test(text[i + 1] ?? "")) {
      i = dollar(i, false);
    } else if (c === "`") {
      i = backquote(i);
    } else if (c === "<" && text[i + 1] === "<" && text[i + 2] !== "<") {
      endWord();
      i += text[i + 2] === "-" ? 3 : 2;
      while (text[i] === " " || text[i] === "\t") i += 1;
      const delimiter = text.slice(i).match(/^(['"]?)([^\s'"<>|&;()]+)\1/);
      if (delimiter) {
        pending.push({ delimiter: delimiter[2], quoted: delimiter[1] !== "", owner: current });
        i += delimiter[0].length;
      }
    } else if (c === ">" || c === "<" || (c === "&" && text[i + 1] === ">")) {
      if (/^[0-9]+$/.test(w.v) && !w.quoted && !w.dyn) w = word();
      else endWord();
      const from = i;
      i += 1;
      while (text[i] === ">" || text[i] === "&" || text[i] === "<") i += 1;
      if (text[i] === "|" && text[i - 1] === ">") i += 1;
      current.redirected ||= text.slice(from, i).includes(">");
      skipNext = true;
    } else if ((c === "&" || c === "|") && text[i + 1] === c) {
      endCommand();
      i += 2;
    } else if (c === "|") {
      endCommand({ piped: true });
      i += text[i + 1] === "&" ? 2 : 1;
    } else if (c === "&") {
      endCommand({ background: true });
      i += 1;
    } else if (c === "(" || c === ")" || c === ";") {
      endCommand();
      if (c === "(") depth += 1;
      if (c === ")") depth = Math.max(0, depth - 1);
      i += 1;
    } else {
      Object.assign(w, { v: w.v + c, any: true });
      i += 1;
    }
  }
  endCommand();
  return { commands: found, hidden };
}

// ------------------------------------------------------------------------------------------------ the checks

/** The environment of every git the hook runs, its checks' included: no optional locks, no hooks, no fsmonitor. */
function quiet(extra = {}) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...extra };
  let n = /^[0-9]+$/.test(env.GIT_CONFIG_COUNT ?? "") ? Number(env.GIT_CONFIG_COUNT) : 0;
  for (const [key, value] of [["core.hooksPath", "/dev/null"], ["core.fsmonitor", "false"]]) {
    env[`GIT_CONFIG_KEY_${n}`] = key;
    env[`GIT_CONFIG_VALUE_${n}`] = value;
    n += 1;
  }
  env.GIT_CONFIG_COUNT = String(n);
  return env;
}

function git(cwd, args, env = quiet()) {
  const done = spawnSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 });
  return done.status === 0 ? done.stdout.trim() : null;
}

/** A check run in parallel with the others: `{ status, stdout, timedOut }`, killed at the deadline. */
function python(args, cwd, env = quiet()) {
  return new Promise((done) => {
    let stdout = "";
    let timedOut = false;
    let child;
    try {
      child = spawn(PYTHON, ["-P", ...args], { cwd, stdio: ["ignore", "pipe", "ignore"], env: { ...env, PYTHONPATH: OWN } });
    } catch {
      done({ status: null, stdout: "", timedOut });
      return;
    }
    const timer = setTimeout(() => ((timedOut = true), child.kill("SIGKILL")), Math.max(500, DEADLINE_MS - performance.now()));
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", () => {});
    child.on("close", (status) => (clearTimeout(timer), done({ status, stdout, timedOut })));
  });
}

const didNotRun = (done) => (done.timedOut ? "it did not answer in time" : `exit ${done.status}`);

/** The leak scan's JSON answer as `{ deny?, note? }`; `where` maps a hit's place to the one named. */
function leakVerdict(done, label, where = (w) => w) {
  let answer;
  try {
    answer = JSON.parse(done.stdout.trim().split("\n").pop());
  } catch {
    return { note: `the leak scan did not run (${didNotRun(done)})` };
  }
  const { status, reason } = answer.summary ?? {};
  if (status === "skipped" || status === "cannot-scan") return { note: `the leak scan did not run (${reason ?? status})` };
  if (status !== "hits") return {};
  const places = answer.hits.map((hit) => where(hit.where));
  const more = places.length > SHOWN ? ` and ${places.length - SHOWN} more` : "";
  return { deny: `the leak scan found ${answer.summary.hits} hit(s) in ${label} at ${places.slice(0, SHOWN).join(", ")}${more}: remove them (never quote them).` };
}

/** A line check (exit 1 and its lines: deny; exit 0: pass; anything else: a note). */
function lineVerdict(done, check) {
  const printed = done.stdout.split("\n").filter((line) => line.trim() !== "");
  if (done.status === 0) return {};
  if (done.status === 1 && printed.length > 0) return { deny: `the ${check}: ${printed.map((line) => line.replace(/^merge-ready: /, "")).join("; ")}.` };
  return { note: `the ${check} did not run (${didNotRun(done)})` };
}

/** Runs the checks with a scratch folder that is always removed. */
async function scratch(work) {
  const folder = mkdtempSync(join(tmpdir(), "shift-left-"));
  try {
    return await work(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

const READYISH = /factory.{0,3}state/i;

/** A judged commit: the leak scan and acceptance check when its index is known, the Cut check on a READY message. */
async function checkCommit(cwd, message, index) {
  return scratch(async (folder) => {
    const messageFile = join(folder, "message");
    writeFileSync(messageFile, message);
    const runs = [];
    const notes = [];
    if (READYISH.test(message)) runs.push(python(["-m", "scripts.merge_ready", "--cut-message", messageFile], cwd).then((d) => lineVerdict(d, "Cut check")));
    if (index.cannot) notes.push(`the staged tree was not scanned (${index.cannot})`);
    else {
      const top = git(cwd, ["rev-parse", "--show-toplevel"]);
      const env = quiet();
      if (top === null) notes.push("no repository here, so the staged tree was not scanned");
      else if (index.replays.length > 0 && !replay(top, index.replays, folder, env)) notes.push("the staged tree was not scanned (its staging could not be replayed on a copy of the index)");
      else {
        runs.push(python(["-m", "tools.leakscan", "staged", "--json", "--message-file", messageFile], top, env).then((d) => leakVerdict(d, "the staged commit")));
        runs.push(python(["-m", "tools.lint.acceptance", "--staged", "--message-file", messageFile], top, env).then((d) => lineVerdict(d, "acceptance check")));
      }
    }
    const verdicts = await Promise.all(runs);
    return { reasons: verdicts.map((v) => v.deny).filter(Boolean), notes: [...notes, ...verdicts.map((v) => v.note).filter(Boolean)] };
  });
}

/** Replays `git add` on a copy of the index (sets `env.GIT_INDEX_FILE`); false when it cannot, never touching the real
 * one: each replay must be in the same repository, and a repository with a filter driver is not replayed. */
function replay(top, replays, folder, env) {
  if (git(top, ["config", "--get-regexp", "^filter\\."]) !== null) return false;
  const real = git(top, ["rev-parse", "--path-format=absolute", "--git-path", "index"]);
  if (real === null) return false;
  const copy = join(folder, "index");
  if (existsSync(real)) copyFileSync(real, copy);
  env.GIT_INDEX_FILE = copy;
  for (const { cwd, args } of replays) {
    if (git(cwd, ["rev-parse", "--show-toplevel"]) !== top) return false;
    if (git(cwd, ["-c", "core.hooksPath=/dev/null", "add", ...args], env) === null) return false;
  }
  return true;
}

/** A judged `gh pr create`: the body file's leak scan and Cut check. */
async function checkPullRequest(path, shown) {
  if (!existsSync(path)) return { reasons: [], notes: [`the PR body file ${shown} does not exist yet, so it was not checked`] };
  const verdicts = await Promise.all([
    python(["-m", "tools.leakscan", "file", path, "--json", "--no-stamp"], OWN).then((d) => leakVerdict(d, "the PR body", (w) => w.replace(/^file:/, `${shown}:`))),
    python(["-m", "scripts.merge_ready", "--cut-body", path], OWN).then((d) => lineVerdict(d, "Cut check")),
  ]);
  return { reasons: verdicts.map((v) => v.deny).filter(Boolean), notes: verdicts.map((v) => v.note).filter(Boolean) };
}

// ------------------------------------------------------------------------------------------------ reading the call

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const LEADING = new Set(["!", "{", "}", "if", "then", "elif", "else", "do", "while", "until", "time"]);
const READ_ONLY_GIT = new Set(["status", "diff", "log", "show", "rev-parse", "ls-files", "branch", "describe", "fetch", "rev-list", "notes", "worktree", "remote", "config", "blame", "grep", "shortlog", "cat-file", "merge-base", "for-each-ref", "ls-remote"]);
const KNOWN_GIT = new Set([...READ_ONLY_GIT, "add", "rm", "commit", "push", "pull", "merge", "rebase", "checkout", "switch", "reset", "restore", "stash", "mv", "tag", "cherry-pick", "revert", "clone", "init", "apply", "am", "clean", "update-index", "read-tree"]);
const HARMLESS = new Set(["true", "pwd", "ls", "date", "echo", "printf", "cat", "test", "["]);
const RUNS_A_COMMIT = /\bgit\b[\s\S]*\bcommit\b|\bgh\b[\s\S]*\bpr\b[\s\S]*\bcreate\b/;
const COMMIT_SHAPED = /^(?:-[A-Za-z]*[mFa]|--(?:message|file|all|amend)\b)/;
const ADD_INTERACTIVE = /^(?:-[A-Za-z]*[pie][A-Za-z]*|--(?:patch|interactive|edit|pathspec-from-file)\b.*)$/;
const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** A commit's message and index from its arguments: `{ message, cannot, all, paths }` (`cannot`: why not readable). */
function commitArgs(args, cwd) {
  const parts = [];
  let file = null;
  let all = false;
  let cannot = null;
  let paths = false;
  for (let k = 0; k < args.length; k += 1) {
    const { v } = args[k];
    const take = () => args[(k += 1)] ?? { v: "", dyn: true };
    if (v === "--") {
      paths ||= k + 1 < args.length;
      break;
    }
    if (!v.startsWith("-") || v === "-") paths = true;
    else if (v.startsWith("--")) {
      const [name, inline] = v.includes("=") ? [v.slice(0, v.indexOf("=")), { ...args[k], v: v.slice(v.indexOf("=") + 1) }] : [v, null];
      if (name === "--message") parts.push(inline ?? take());
      else if (name === "--file") file = inline ?? take();
      else if (name === "--all") all = true;
      else if (["--author", "--date", "--cleanup"].includes(name)) inline ?? take();
      else if (!["--quiet", "--signoff", "--no-verify", "--allow-empty", "--verbose", "--no-edit", "--no-gpg-sign", "--no-status", "--status"].includes(name)) cannot ??= `git commit ${name} is not judged`;
    } else {
      for (let c = 1; c < v.length; c += 1) {
        const flag = v[c];
        const rest = v.slice(c + 1);
        const value = () => (rest !== "" ? { ...args[k], v: rest } : take());
        if (flag === "a") all = true;
        else if (flag === "m") (parts.push(value()), (c = v.length));
        else if (flag === "F") (file = value()), (c = v.length);
        else if (!"qsnv".includes(flag)) {
          cannot ??= `git commit -${flag} is not judged`;
          break;
        }
      }
    }
  }
  let message = null;
  if (cannot === null) {
    if (parts.length > 0 && file !== null) cannot = "git commit takes -m or -F, not both";
    else if (parts.some((p) => p.unquotedHeredoc)) cannot = "its message is a heredoc whose delimiter is unquoted (write <<'EOF')";
    else if (parts.some((p) => p.dyn)) cannot = "its message is built at run time";
    else if (parts.length > 0) message = parts.map((p) => p.v).join("\n\n");
    else if (file === null) cannot = "it has no -m or -F message";
    else if (file.dyn) cannot = "its message file is named at run time";
    else if (file.v === "-" || file.v.startsWith("/dev/")) cannot = "it reads its message from standard input";
    else {
      try {
        message = readFileSync(isAbsolute(file.v) ? file.v : join(cwd, file.v), "utf8");
      } catch {
        cannot = "its message file cannot be read";
      }
    }
  }
  return { message, cannot, all, paths, fromFile: file !== null };
}

/** The reasons to deny the call and the notes for its one stderr line. */
export async function verdict(command, startCwd) {
  const reasons = [];
  const notes = [];
  const { commands, hidden } = parse(command);
  if (hidden) notes.push("a commit or PR inside a substitution is not judged");
  const gitEnv = /\bGIT_[A-Z_]+=/.test(command);
  let cwd = startCwd; // null: known only at run time
  let changed = false; // something earlier in the call may change the index or a file a check reads
  const replays = [];
  for (const { words, heredoc, depth, piped, background, redirected } of commands) {
    let k = 0;
    while (k < words.length && !words[k].quoted && (LEADING.has(words[k].v) || ASSIGNMENT.test(words[k].v))) k += 1;
    const ws = words.slice(k);
    if (ws.length === 0) continue;
    const [head] = ws;
    const nested = depth > 0 || piped || background;
    if (head.dyn) {
      if (ws.some((w) => w.v === "commit" || w.v === "create")) notes.push("a command named at run time is not judged");
      changed = true;
      continue;
    }
    const tool = basename(head.v);
    if (tool === "cd") {
      const target = ws.find((w, n) => n > 0 && !/^-[LPe@]*$/.test(w.v));
      if (nested) continue;
      if (target === undefined || target.dyn || target.v === "-") cwd = null;
      else if (cwd !== null && isDirectory(resolve(cwd, target.v))) cwd = resolve(cwd, target.v);
      continue;
    }
    if ((tool === "git" || tool === "gh") && head.quoted) {
      notes.push(`a quoted or escaped '${tool}' word is not judged`);
      changed = true;
      continue;
    }
    if (tool === "gh") {
      if (ws[1]?.v !== "pr" || ws[2]?.v !== "create") {
        changed = true;
        continue;
      }
      const found = await judgePullRequest(ws.slice(3), { cwd, nested, changed });
      reasons.push(...found.reasons);
      notes.push(...found.notes);
      continue;
    }
    if (tool !== "git") {
      if (HARMLESS.has(tool) && !redirected && !heredoc) continue;
      changed = true;
      // A wrapper (`env`, `command`, `bash -c '...'`) that runs git or gh: noted, never a silent pass.
      if (RUNS_A_COMMIT.test(ws.map((w) => w.v).join(" "))) notes.push(`a commit or PR run by ${tool} is not judged`);
      continue;
    }
    // git's global options: only a spelled-out -C is read; any other one is the call's own configuration.
    let here = cwd;
    let odd = false;
    let at = 1;
    while (at < ws.length && ws[at].v.startsWith("-") && !ws[at].quoted) {
      if (ws[at].v === "-C") {
        const folder = ws[at + 1];
        here = folder === undefined || folder.dyn || here === null ? null : resolve(here, folder.v);
        at += 2;
      } else {
        odd = true;
        at += ["-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"].includes(ws[at].v) ? 2 : 1;
      }
    }
    const verb = ws[at];
    const args = ws.slice(at + 1);
    if (verb === undefined) continue;
    if (verb.dyn || verb.quoted) {
      notes.push("a git verb quoted, escaped or named at run time is not judged");
      changed = true;
      continue;
    }
    if (verb.v === "add") {
      if (nested || here === null || odd || gitEnv || changed || args.some((a) => a.dyn || ADD_INTERACTIVE.test(a.v))) changed = true;
      else replays.push({ cwd: here, args: args.map((a) => a.v) });
      continue;
    }
    if (verb.v !== "commit") {
      if (!KNOWN_GIT.has(verb.v) && args.some((a) => COMMIT_SHAPED.test(a.v))) notes.push(`git ${verb.v} may be an alias that commits; it is not judged`);
      if (!READ_ONLY_GIT.has(verb.v) || redirected || odd) changed = true;
      continue;
    }
    const found = await judgeCommit(args, { here, nested, odd: odd || gitEnv, changed, replays });
    reasons.push(...found.reasons);
    notes.push(...found.notes);
    changed = true;
  }
  return { reasons: [...new Set(reasons)], notes: [...new Set(notes)] };
}

async function judgeCommit(args, { here, nested, odd, changed, replays }) {
  if (nested) return { reasons: [], notes: ["a commit in a subshell, pipeline or background is not judged"] };
  if (here === null) return { reasons: [], notes: ["a commit whose folder is known only at run time is not judged"] };
  if (odd) return { reasons: [], notes: ["a commit under git's environment or global options set in the call is not judged"] };
  const { message, cannot, all, paths, fromFile } = commitArgs(args, here);
  if (message === null) return { reasons: [], notes: [`a commit is not judged: ${cannot}`] };
  // The file is read before the call runs: an earlier command in it may write the file.
  if (fromFile && changed) return { reasons: [], notes: ["a commit whose message file an earlier command in the call may write is not judged"] };
  let indexCannot = cannot;
  if (changed) indexCannot ??= "something earlier in the call may change what it commits";
  if (paths) indexCannot ??= "it names pathspecs";
  const index = { cannot: indexCannot, replays: all ? [...replays, { cwd: here, args: ["-u"] }] : replays };
  return checkCommit(here, message, index);
}

async function judgePullRequest(args, { cwd, nested, changed }) {
  if (nested) return { reasons: [], notes: ["gh pr create in a subshell, pipeline or background is not judged"] };
  if (cwd === null) return { reasons: [], notes: ["gh pr create in a folder known only at run time is not judged"] };
  if (changed) return { reasons: [], notes: ["gh pr create after a command that may write its body is not judged"] };
  let body = null;
  let inline = null;
  for (let k = 0; k < args.length; k += 1) {
    const { v } = args[k];
    if (v === "--body-file" || v === "-F") body = args[(k += 1)] ?? { v: "", dyn: true };
    else if (v.startsWith("--body-file=")) body = { ...args[k], v: v.slice("--body-file=".length) };
    else if (v === "--body" || v === "-b") inline = args[(k += 1)] ?? { v: "", dyn: true };
    else if (v.startsWith("--body=")) inline = { ...args[k], v: v.slice("--body=".length) };
  }
  if (inline !== null) {
    if (inline.dyn) return { reasons: [], notes: ["gh pr create's --body is built at run time; it is not judged"] };
    return scratch(async (folder) => {
      writeFileSync(join(folder, "body.md"), inline.v);
      return checkPullRequest(join(folder, "body.md"), "--body");
    });
  }
  if (body === null) return { reasons: [], notes: ["gh pr create without --body-file is not judged"] };
  if (body.dyn || body.v === "-" || body.v === "") return { reasons: [], notes: ["gh pr create's body file is named at run time or read from standard input; it is not judged"] };
  return checkPullRequest(isAbsolute(body.v) ? body.v : join(cwd, body.v), body.v);
}

async function main() {
  let event;
  try {
    event = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const command = event?.tool_input?.command;
  if (event?.tool_name !== "Bash" || typeof command !== "string" || command.trim() === "") return;
  const cwd = typeof event.cwd === "string" && event.cwd !== "" ? event.cwd : process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const { reasons, notes } = await verdict(command, cwd);
  if (reasons.length > 0) {
    const permissionDecisionReason = `Shift-left (an early warning; publish and CI stay the walls): ${reasons.join(" ")}`;
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason } })}\n`);
  } else if (notes.length > 0) {
    process.stderr.write(`shift-left: ${notes.join("; ").replace(/\s+/g, " ")} (advisory; publish and CI still check)\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => process.stderr.write("shift-left: internal error; nothing was judged (publish and CI still check)\n"));
}
