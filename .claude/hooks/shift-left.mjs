#!/usr/bin/env node
// PreToolUse, Bash: the shift-left checks (S29-F2b; docs/plans/factory-s29.md item 2). The leak scan, the acceptance
// check and the Cut check ran only at push, in CI and at merge, so a builder met them after committing; this hook runs
// them before the call does:
// - `git commit`: the leak scan of what the commit adds and of its message (`python -m tools.leakscan staged`), and the
//   acceptance check's per-commit rules on the staged files and the message (`python -m tools.lint.acceptance
//   --staged`). A `git add`/`git rm` earlier in the same call is replayed into a copy of the index first, as are
//   `commit -a` and a commit's pathspecs, so staging in the same call does not skip the scan; anything else before the
//   commit in that call (it could change the index) is refused: run the commit alone or after `cd` and `git add` only.
// - `gh pr create`: its body comes from `--body-file`, which is leak-scanned (`tools.leakscan file --no-stamp`) and
//   holds a `## Cut` section whose items link an issue (`python -m scripts.merge_ready --cut-body`).
// It denies as the guard does (exit 0, `permissionDecision: "deny"`), naming the check and `<path>:<line>`, never the
// hit's text; it allows with no output. With no leak corpus (a cloud session) it allows, saying on stderr that the
// scan was skipped; publish and CI still scan. A check that cannot start or overruns its time is not claimed: the call
// is allowed with one stderr line saying so (this hook is the early warning; the push, CI and merge gates stay).
// It reads the call as the shell would, as far as a reader can: `cd` per subshell, `git -C`, `env -C`, wrappers before
// git, substitutions, heredoc messages, git's abbreviated options, aliases. A call it cannot read plainly (git named at
// run time, an alias that commits, GIT_DIR set, staging under xargs) is refused with the rule, never guessed. Not
// judged (an early check, not the gate; the push, CI and merge are): a commit another program runs (`bash -c`, `eval`,
// `source`, a script), and what the scanner itself does not see.
// The checks are found by this file's own location (VEXTRUS_PYTHON, else that checkout's .venv, else python3, run
// with -P so the target folder's own `tools/` never shadows them); VEXTRUS_LEAKSCAN_HOME and _ALLOWLIST pass through.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const OWN = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const VENV = join(OWN, ".venv/bin/python");
const PYTHON = process.env.VEXTRUS_PYTHON || (existsSync(VENV) ? VENV : "python3");
// Registered with a 15 s timeout, and a timed-out hook allows: the checks run in parallel and the hook ends inside 13 s.
const DEADLINE_MS = 13_000;
const SHOWN = 5;

// ------------------------------------------------------------------------------------------------ the command's words

/** A word: its value as the shell would pass it, and whether part of it is only known at run time. */
const word = () => ({ v: "", dyn: false, any: false, brace: false });

// `$(cat <<'EOF' ... EOF)`: the usual way to pass a long commit message; its body is the value.
const CAT_HEREDOC = /^\$\(\s*cat\s+<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[ \t]*\n([\s\S]*?)\n[ \t]*\2[ \t]*\n\s*\)/;

/** The end of a `$(` substitution opened at `i` (the index after its `)`), skipping quotes and nested ones. */
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

/** The call as simple commands in the order they run: `{ words, heredoc, redirected, scope, detached }` each, split at
 * `&& || ; | & ( )` and line breaks. `scope` names the subshell a command runs in (`""` the call's own shell; a `( )`
 * group or a `$( )`/backquote substitution opens one, whose commands come before the command holding it), so a `cd`
 * lasts only in its scope; `detached` marks a pipeline member or a background command, whose `cd` lasts nowhere. */
export function commands(text, prefix = "") {
  const found = [];
  const fresh = () => ({ words: [], heredoc: null, redirected: false, scope: "", detached: false });
  let current = fresh();
  let w = word();
  let pending = [];
  let skipNext = false;
  const open = [];
  let opened = 0;
  let piped = false;
  const scope = () => [prefix, ...open].filter(Boolean).join("/");
  const nested = (inner) => {
    w.dyn = true;
    w.any = true;
    found.push(...commands(inner, `${scope()}${scope() ? "/" : ""}${prefix}s${opened++}`));
  };
  const endWord = () => {
    if (w.any) {
      // Brace expansion ({a,b}, {1..3}) makes words the call alone knows: never replayed as written.
      if (w.brace && /\{[^{}]*(?:,|\.\.)[^{}]*\}/.test(w.v)) w.dyn = true;
      if (skipNext) skipNext = false;
      else current.words.push(w);
    }
    w = word();
  };
  const endCommand = (detached = false) => {
    endWord();
    current.scope = scope();
    current.detached ||= detached || piped;
    piped = false;
    if (current.words.length > 0) found.push(current);
    current = fresh();
  };
  const dollar = (i) => {
    const heredoc = text.slice(i).match(CAT_HEREDOC);
    if (heredoc) {
      w.v += heredoc[3];
      if (heredoc[1] === "" && /[$`\\]/.test(heredoc[3])) w.dyn = true;
      w.any = true;
      return i + heredoc[0].length;
    }
    w.dyn = true;
    w.any = true;
    if (text[i + 1] === "(") {
      const end = substitutionEnd(text, i + 1);
      nested(text.slice(i + 2, end - 1));
      return end;
    }
    if (text[i + 1] === "{") return text.indexOf("}", i) === -1 ? text.length : text.indexOf("}", i) + 1;
    const name = text.slice(i + 1).match(/^(?:[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/);
    return i + 1 + (name ? name[0].length : 0);
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "\n") {
      endCommand();
      i += 1;
      for (const { delimiter, owner } of pending) {
        const lines = text.slice(i).split("\n");
        const end = lines.findIndex((line) => line.replace(/^\t+/, "") === delimiter);
        const body = lines.slice(0, end === -1 ? lines.length : end);
        owner.heredoc = body.join("\n") + "\n";
        i += body.join("\n").length + 1 + (end === -1 ? 0 : delimiter.length + 1);
      }
      pending = [];
    } else if (c === " " || c === "\t") {
      endWord();
      i += 1;
    } else if (c === "#" && !w.any) {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (c === "\\") {
      if (text[i + 1] !== "\n") {
        w.v += text[i + 1] ?? "";
        w.any = true;
      }
      i += 2;
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1);
      w.v += text.slice(i + 1, end === -1 ? text.length : end);
      w.any = true;
      i = end === -1 ? text.length : end + 1;
    } else if (c === '"') {
      w.any = true;
      i += 1;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && '"\\$`\n'.includes(text[i + 1])) {
          if (text[i + 1] !== "\n") w.v += text[i + 1];
          i += 2;
        } else if (text[i] === "$" && /[A-Za-z_({0-9@*#?!-]/.test(text[i + 1] ?? "")) i = dollar(i);
        else if (text[i] === "`") {
          const end = text.indexOf("`", i + 1);
          nested(text.slice(i + 1, end === -1 ? text.length : end));
          i = end === -1 ? text.length : end + 1;
        } else {
          w.v += text[i];
          i += 1;
        }
      }
      i += 1;
    } else if (c === "$" && /[A-Za-z_({0-9@*#?!'-]/.test(text[i + 1] ?? "")) {
      i = text[i + 1] === "'" ? ((w.dyn = true), (w.any = true), text.indexOf("'", i + 2) === -1 ? text.length : text.indexOf("'", i + 2) + 1) : dollar(i);
    } else if (c === "`") {
      const end = text.indexOf("`", i + 1);
      nested(text.slice(i + 1, end === -1 ? text.length : end));
      i = end === -1 ? text.length : end + 1;
    } else if (c === "<" && text[i + 1] === "<" && text[i + 2] !== "<") {
      endWord();
      i += text[i + 2] === "-" ? 3 : 2;
      while (text[i] === " " || text[i] === "\t") i += 1;
      const delimiter = text.slice(i).match(/^(['"]?)([^\s'"<>|&;()]+)\1/);
      if (delimiter) {
        pending.push({ delimiter: delimiter[2], owner: current });
        i += delimiter[0].length;
      }
    } else if (c === ">" || c === "<" || (c === "&" && text[i + 1] === ">")) {
      if (/^[0-9]+$/.test(w.v) && !w.dyn) w = word();
      else endWord();
      current.redirected ||= c === ">";
      i += 1;
      while (text[i] === ">" || text[i] === "&" || text[i] === "<") i += 1;
      skipNext = true;
    } else if ((c === "&" || c === "|") && text[i + 1] === c) {
      endCommand();
      i += 2;
    } else if (c === "|") {
      endCommand(true);
      piped = true;
      i += text[i + 1] === "&" ? 2 : 1;
    } else if (c === "&") {
      endCommand(true);
      i += 1;
    } else if (c === "(") {
      endCommand();
      open.push(`${prefix}p${opened++}`);
      i += 1;
    } else if (c === ")") {
      endCommand();
      open.pop();
      i += 1;
    } else if (c === ";") {
      endCommand();
      i += 1;
    } else {
      if (c === "{") w.brace = true;
      w.v += c;
      w.any = true;
      i += 1;
    }
  }
  endCommand();
  return found;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const LEADING = new Set(["!", "{", "}", "if", "then", "elif", "else", "do", "while", "until", "time", "command", "builtin", "exec", "nohup"]);

/** The words a command runs, leading reserved words, wrappers and assignments dropped; `.chdir`: `env -C`'s folder. */
function program(words) {
  let k = 0;
  let chdir = null;
  while (k < words.length) {
    const { v, dyn } = words[k];
    if (dyn) break;
    if (LEADING.has(v) || ASSIGNMENT.test(v)) k += 1;
    else if (v === "env") {
      k += 1;
      while (k < words.length && (ASSIGNMENT.test(words[k].v) || words[k].v.startsWith("-"))) {
        if (words[k].v === "-C" || words[k].v === "--chdir") chdir = words[(k += 1)] ?? { v: "", dyn: true };
        else if (words[k].v.startsWith("--chdir=")) chdir = { v: words[k].v.slice(8), dyn: words[k].dyn };
        k += 1;
      }
    } else break;
  }
  const ws = words.slice(k);
  ws.chdir = chdir;
  return ws;
}

// Git's options before the verb that take a value in the next word.
const GIT_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"]);

/** `{ globals, folders, verb, args }` of a git command, or null. `folders` are its `-C` values in order. */
function gitOf(words) {
  if (words.length === 0 || words[0].dyn || basename(words[0].v) !== "git") return null;
  const globals = [];
  const folders = [];
  let k = 1;
  while (k < words.length && words[k].v.startsWith("-")) {
    const option = words[k];
    if (GIT_VALUE.has(option.v) && k + 1 < words.length) {
      if (option.v === "-C") folders.push(words[k + 1]);
      else globals.push(option, words[k + 1]);
      k += 2;
    } else {
      globals.push(option);
      k += 1;
    }
  }
  if (k >= words.length) return null;
  return { globals, folders, verb: words[k], args: words.slice(k + 1) };
}

// ------------------------------------------------------------------------------------------------ the checks

function run(file, args, options) {
  return spawnSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

/** A check run in parallel with the others: resolves to `{ status, stdout, timedOut }`, killed at the deadline. */
function python(args, cwd, env = {}) {
  return new Promise((done) => {
    let stdout = "";
    let timedOut = false;
    let child;
    try {
      child = spawn(PYTHON, ["-P", ...args], { cwd, stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, PYTHONPATH: OWN, ...env } });
    } catch {
      done({ status: null, stdout: "", timedOut: false });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, Math.max(500, DEADLINE_MS - performance.now()));
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", () => {});
    child.on("close", (status) => {
      clearTimeout(timer);
      done({ status, stdout, timedOut });
    });
  });
}

function gitOut(cwd, ...args) {
  const done = run("git", args, { cwd, timeout: 5_000 });
  return done.status === 0 ? done.stdout.trim() : null;
}

/** The leak scan's JSON answer: `{ deny?, note? }` (deny: the reason; note: one stderr line). */
function leakVerdict(done, label, where = (w) => w) {
  let answer;
  try {
    answer = JSON.parse(done.stdout.trim().split("\n").pop());
  } catch {
    return { note: `leak scan not run (${done.timedOut ? "it did not answer in time" : "it did not start"}); publish and CI still scan` };
  }
  const { status, reason } = answer.summary ?? {};
  if (status === "skipped" || (status === "cannot-scan" && reason === "no-corpus")) return { note: "leak scan skipped: no corpus" };
  if (status === "cannot-scan") return { deny: `the leak scan cannot scan ${label} (${reason}): fix the corpus or the repository, then run again.` };
  if (status !== "hits") return {};
  const places = answer.hits.map((hit) => where(hit.where));
  const more = places.length > SHOWN ? ` and ${places.length - SHOWN} more` : "";
  return {
    deny: `the leak scan found ${answer.summary.hits} hit(s) in ${label} at ${places.slice(0, SHOWN).join(", ")}${more}: remove them (never quote them), then run again.`,
  };
}

/** Problem lines a check printed (exit 1), or a note when it did not run. */
function lines(done, check, prefix = "") {
  const printed = done.stdout.split("\n").filter((line) => line.trim() !== "");
  if (done.status === 0) return {};
  if (done.status === 1 && printed.length > 0) return { deny: `the ${check}: ${printed.map((line) => line.replace(prefix, "")).join("; ")}` };
  return { note: `${check} not run (${done.timedOut ? "it did not answer in time" : `exit ${done.status}`}); CI still runs it` };
}

const ADD_INTERACTIVE = /^-[A-Za-z]*[pie][A-Za-z]*$/;
const ADD_INTERACTIVE_LONG = ["--patch", "--interactive", "--edit", "--pathspec-from-file"];
// git takes any unique prefix of a long option (`--mess` for `--message`): read each as git would.
const COMMIT_LONG = ["--message", "--file", "--reuse-message", "--reedit-message", "--trailer", "--fixup", "--squash", "--author", "--date", "--cleanup", "--template", "--pathspec-from-file", "--pathspec-file-nul", "--gpg-sign", "--no-gpg-sign", "--untracked-files", "--all", "--amend", "--no-amend", "--include", "--only", "--allow-empty", "--allow-empty-message", "--no-verify", "--verify", "--signoff", "--no-signoff", "--edit", "--no-edit", "--dry-run", "--short", "--branch", "--porcelain", "--long", "--null", "--quiet", "--verbose", "--status", "--no-status", "--reset-author", "--interactive", "--patch", "--no-post-rewrite", "--ahead-behind"];
function longName(name, known) {
  if (known.includes(name)) return name;
  const matches = known.filter((option) => option.startsWith(name));
  return matches.length === 1 ? matches[0] : name;
}
const addInteractive = (v) => ADD_INTERACTIVE.test(v) || (v.startsWith("--") && v.length > 3 && ADD_INTERACTIVE_LONG.includes(longName(v.split("=")[0], ADD_INTERACTIVE_LONG)));

/** The commit's message, its replays and its base, read from `git commit`'s arguments. */
function commitOf(g, cwd, heredoc) {
  const parts = [];
  const trailers = [];
  const paths = [];
  let message = null; // null: unknown; a string once a part is known
  let fixup = false; // --fixup/--squash: git writes the subject, so only the leak scan reads the message
  let fromFile = false;
  let all = false;
  let amend = false;
  let reuse = null;
  let file = null;
  const value = (k) => g.args[k];
  for (let k = 0; k < g.args.length; k += 1) {
    const { v, dyn } = g.args[k];
    const take = () => {
      const next = value(k + 1);
      k += 1;
      return next ?? { v: "", dyn: true };
    };
    if (v === "--") {
      paths.push(...g.args.slice(k + 1));
      break;
    }
    if (!v.startsWith("-") || v === "-") paths.push(g.args[k]);
    else if (v.startsWith("--")) {
      const [given, inline] = v.includes("=") ? [v.slice(0, v.indexOf("=")), { v: v.slice(v.indexOf("=") + 1), dyn }] : [v, null];
      const name = longName(given, COMMIT_LONG);
      const arg = () => inline ?? take();
      if (name === "--message") parts.push(arg());
      else if (name === "--file") file = arg();
      else if (name === "--reuse-message" || name === "--reedit-message") reuse = arg();
      else if (name === "--trailer") trailers.push(arg());
      else if (name === "--fixup" || name === "--squash") (arg(), (fixup = true));
      else if (["--author", "--date", "--cleanup", "--template", "--pathspec-from-file", "--gpg-sign", "--untracked-files"].includes(name)) {
        if (inline === null && !["--gpg-sign", "--untracked-files"].includes(name)) take();
        if (name === "--pathspec-from-file") fromFile = true;
      } else if (name === "--all") all = true;
      else if (name === "--amend") amend = true;
    } else {
      for (let c = 1; c < v.length; c += 1) {
        const flag = v[c];
        const rest = v.slice(c + 1);
        const arg = () => (rest !== "" ? { v: rest, dyn } : take());
        if (flag === "a") all = true;
        else if ("mFCct".includes(flag)) {
          const got = arg();
          if (flag === "m") parts.push(got);
          else if (flag === "F") file = got;
          else if (flag === "C" || flag === "c") reuse = got;
          break;
        } else if ("Su".includes(flag)) break;
      }
    }
  }
  if (parts.length > 0) {
    message = parts.some((p) => p.dyn) ? null : parts.map((p) => p.v).join("\n\n");
  } else if (file !== null) {
    if (file.dyn) message = null;
    else if (file.v === "-") message = heredoc;
    else {
      try {
        message = readFileSync(isAbsolute(file.v) ? file.v : join(cwd, file.v), "utf8");
      } catch {
        message = null;
      }
    }
  } else if (reuse !== null) message = reuse.dyn ? null : gitOut(cwd, "log", "-1", "--format=%B", reuse.v);
  else if (amend) message = gitOut(cwd, "log", "-1", "--format=%B", "HEAD");
  if (message !== null && trailers.length > 0) {
    message = trailers.some((t) => t.dyn) ? null : `${message.replace(/\n+$/, "")}\n\n${trailers.map((t) => t.v).join("\n")}`;
  }
  const replays = [];
  if (all) replays.push({ cwd, globals: g.globals, args: ["add", "-u"] });
  if (paths.length > 0 || fromFile) replays.push({ cwd, globals: g.globals, args: ["add", "--", ...paths.map((p) => p.v)], dyn: fromFile || paths.some((p) => p.dyn) });
  return { message: fixup ? null : message, scanned: message, replays, amend };
}

/** The verdict on one `git commit`: the reasons to deny and the notes for stderr. */
async function checkCommit(cwd, globals, commit, replays) {
  const top = gitOut(cwd, ...globals, "rev-parse", "--show-toplevel");
  if (top === null) return { reasons: [], notes: [] };
  const folder = mkdtempSync(join(tmpdir(), "shift-left-"));
  const index = join(folder, "index");
  const messageFile = join(folder, "message");
  const env = {};
  try {
    const all = [...replays, ...commit.replays];
    if (all.length > 0) {
      const real = gitOut(cwd, ...globals, "rev-parse", "--git-path", "index");
      if (real !== null && existsSync(resolve(cwd, real))) copyFileSync(resolve(cwd, real), index);
      env.GIT_INDEX_FILE = index;
      for (const replay of all) {
        run("git", [...replay.globals.map((g) => g.v), ...replay.args], { cwd: replay.cwd, env: { ...process.env, GIT_INDEX_FILE: index }, stdio: "ignore", timeout: 10_000 });
      }
    }
    const base = commit.amend ? gitOut(top, "rev-parse", "-q", "--verify", "HEAD^") : null;
    const baseArgs = base ? ["--base", base] : [];
    const messageArgs = [];
    if (commit.scanned !== null) {
      writeFileSync(messageFile, commit.scanned);
      messageArgs.push("--message-file", messageFile);
    }
    const [leak, acceptance] = await Promise.all([
      python(["-m", "tools.leakscan", "staged", "--json", ...baseArgs, ...messageArgs], top, env),
      commit.message === null ? null : python(["-m", "tools.lint.acceptance", "--staged", ...messageArgs, ...baseArgs], top, env),
    ]);
    const verdicts = [leakVerdict(leak, "the staged commit")];
    if (commit.scanned === null) verdicts.push({ note: "the commit message was not scanned (the call builds it at run time or reads it from standard input); the push and CI scan it" });
    if (acceptance !== null) verdicts.push(lines(acceptance, "acceptance check"));
    return { reasons: verdicts.map((v) => v.deny).filter(Boolean), notes: verdicts.map((v) => v.note).filter(Boolean) };
  } finally {
    for (const name of [index, `${index}.lock`, messageFile]) {
      try {
        unlinkSync(name);
      } catch {}
    }
    try {
      rmdirSync(folder);
    } catch {}
  }
}

/** The verdict on one `gh pr create`. */
async function checkPullRequest(cwd, args) {
  let body = null;
  for (let k = 0; k < args.length; k += 1) {
    const { v } = args[k];
    if (v === "--body-file" || v === "-F") body = args[k + 1] ?? { v: "", dyn: true };
    else if (v.startsWith("--body-file=")) body = { v: v.slice("--body-file=".length), dyn: args[k].dyn };
    else if (/^-F./.test(v)) body = { v: v.slice(2), dyn: args[k].dyn };
  }
  if (body === null || body.dyn || body.v === "-" || body.v === "") {
    return { reasons: ["the Cut check: `gh pr create` takes its body from a file, `--body-file <f>` spelled out, with a `## Cut` section ('None.' when nothing was cut)."], notes: [] };
  }
  const path = isAbsolute(body.v) ? body.v : join(cwd, body.v);
  if (!existsSync(path)) return { reasons: [`the Cut check cannot read ${body.v}: write the body file first, then run \`gh pr create\` alone in its call.`], notes: [] };
  const [leak, cut] = await Promise.all([
    python(["-m", "tools.leakscan", "file", path, "--json", "--no-stamp"], cwd),
    python(["-m", "scripts.merge_ready", "--cut-body", path], cwd),
  ]);
  const verdicts = [leakVerdict(leak, "the PR body", (w) => w.replace(/^file:/, `${body.v}:`)), lines(cut, "Cut check", /^merge-ready: /)];
  return { reasons: verdicts.map((v) => v.deny).filter(Boolean), notes: verdicts.map((v) => v.note).filter(Boolean) };
}

const READ_ONLY_GIT = new Set(["status", "diff", "log", "show", "rev-parse", "ls-files", "branch", "describe", "fetch"]);
const KNOWN_GIT = new Set([...READ_ONLY_GIT, "add", "rm", "commit", "push", "pull", "merge", "rebase", "checkout", "switch", "reset", "restore", "stash", "mv", "tag", "cherry-pick", "revert", "worktree", "config", "remote", "clone", "init", "apply", "am"]);
const HARMLESS = new Set(["true", "pwd", "ls", "date", "echo", "printf", "set", "export", "unset"]);
// Git's environment that moves the repository or the index: a commit under it is judged elsewhere than it runs.
const GIT_ENV = /^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|COMMON_DIR|NAMESPACE|CEILING_DIRECTORIES|CONFIG\w*)=/;
const GIT_PLACE = /^--(?:git-dir|work-tree|namespace|config-env)(?:=|$)/;
const TOOLS = new Set(["git", "gh"]);
// Wrappers that append words of their own to the command they run: its operands are never what is written.
const APPENDS = /^(?:xargs|find|parallel)$/;
const AUTOCORRECT_OFF = /^(?:0|false|no|off|never|prompt|show)?$/i;
const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** The reasons to deny the call, and the notes for stderr. */
export async function verdict(command, startCwd) {
  const reasons = [];
  const notes = [];
  const folders = new Map([["", startCwd]]); // each scope's folder after its cd's
  const folderOf = (scope) => {
    for (let at = scope; ; at = at.includes("/") ? at.slice(0, at.lastIndexOf("/")) : "") {
      if (folders.has(at)) return folders.get(at);
      if (at === "") return startCwd;
    }
  };
  let changed = false; // something earlier in the call may change the index or the files a replay reads
  let gitEnv = false; // git's environment set earlier in the call
  const replays = [];
  for (const { words, heredoc, redirected, scope, detached } of commands(command)) {
    const setsGitEnv = words.some((w) => !w.dyn && GIT_ENV.test(w.v));
    if (setsGitEnv && !detached) gitEnv = true;
    const ws = program(words);
    if (ws.length === 0) continue;
    let cwd = folderOf(scope);
    if (!ws[0].dyn && ws[0].v === "cd") {
      // A cd lasts in its own scope only, and only when its folder is a folder (else the shell stays put).
      let t = 1;
      while (ws[t] && !ws[t].dyn && /^(?:-[LPe@]+|--)$/.test(ws[t].v)) t += 1;
      const target = ws[t];
      if (detached) continue;
      if (target === undefined || target.dyn || target.v === "-") folders.set(scope, null);
      else if (cwd !== null) {
        const next = resolve(cwd, target.v.replace(/^~(?=\/|$)/, process.env.HOME ?? "~"));
        if (isDirectory(next)) folders.set(scope, next);
      }
      continue;
    }
    if (ws.chdir) cwd = ws.chdir.dyn || cwd === null ? null : resolve(cwd, ws.chdir.v);
    // A wrapper (nice, timeout, xargs ...) runs git or gh as a later word: judge it wherever it stands.
    const at = ws.findIndex((w) => !w.dyn && TOOLS.has(basename(w.v)));
    if (at === -1) {
      if (ws[0].dyn && ws.slice(1).some((w) => !w.dyn && w.v === "commit")) {
        reasons.push("the shift-left checks cannot read a command named at run time: spell `git commit` out.");
      } else if (!(ws.every((w) => !w.dyn) && HARMLESS.has(ws[0].v) && !redirected)) changed = true;
      continue;
    }
    const tool = ws.slice(at);
    const appended = ws.slice(0, at).some((w) => APPENDS.test(basename(w.v)) || w.v === "-exec" || w.v === "-execdir");
    const g = gitOf(tool);
    const gh = basename(tool[0].v) === "gh" && tool[1]?.v === "pr" && tool[2]?.v === "create";
    if (basename(tool[0].v) === "gh" && !gh) {
      changed = true; // gh pr checkout and its kind change the tree
      continue;
    }
    if (gh) {
      if (cwd === null) reasons.push("the Cut check cannot read this call's folder: run `gh pr create` from a folder spelled out.");
      else if (changed) reasons.push("the Cut check reads the body file before the call runs: run `gh pr create` alone in its call.");
      else {
        const found = await checkPullRequest(cwd, tool.slice(3));
        reasons.push(...found.reasons);
        notes.push(...found.notes);
      }
      continue;
    }
    if (g === null || g.verb.dyn) {
      if (!(ws.every((w) => !w.dyn) && HARMLESS.has(ws[0].v) && !redirected)) changed = true;
      continue;
    }
    let here = cwd;
    for (const folder of g.folders) here = folder.dyn || here === null ? null : resolve(here, folder.v);
    let verb = g.verb.v;
    const placed = gitEnv || setsGitEnv || g.globals.some((o) => GIT_PLACE.test(o.v));
    if (!KNOWN_GIT.has(verb)) {
      // An alias (in the config or `-c alias.x=...`, followed through chains) that commits or runs a shell, or an
      // unknown verb git may autocorrect, is a commit the hook cannot read.
      if (here === null) {
        reasons.push(`the shift-left checks cannot read this call's folder to resolve \`git ${verb}\`: spell the folder out.`);
        continue;
      }
      const config = (key) => gitOut(here, ...g.globals.map((o) => o.v), "config", "--get", key);
      let name = verb;
      let expands = null;
      for (let hop = 0; hop < 8 && !KNOWN_GIT.has(name); hop += 1) {
        const alias = config(`alias.${name}`);
        if (alias === null) break;
        expands = alias;
        if (/^\s*!/.test(alias)) break;
        name = alias.trim().split(/\s+/)[0];
      }
      if (expands !== null ? /^\s*!/.test(expands) || name === "commit" : !AUTOCORRECT_OFF.test((config("help.autocorrect") ?? "").trim())) {
        reasons.push("the shift-left checks do not follow a git alias that commits or runs a shell, nor a verb git may autocorrect: run `git commit` itself.");
        continue;
      }
    }
    if (verb === "add" || verb === "rm") {
      const args = g.args;
      if (here === null || changed || appended || args.some((a) => a.dyn || (verb === "add" && addInteractive(a.v)))) changed = true;
      else replays.push({ cwd: here, globals: g.globals, args: verb === "rm" ? ["rm", "--cached", "-q", ...args.map((a) => a.v)] : ["add", ...args.map((a) => a.v)] });
      continue;
    }
    if (verb !== "commit") {
      if (!READ_ONLY_GIT.has(verb) || redirected) changed = true;
      continue;
    }
    if (placed) {
      reasons.push("the shift-left checks judge the repository and index the call names plainly: run `git commit` without GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE or --git-dir set in the call.");
      continue;
    }
    if (here === null || changed || appended || g.globals.some((o) => o.dyn)) {
      reasons.push(
        "the shift-left checks judge the staged tree before the call runs, so run `git commit` alone in its call, or after only `cd` and `git add` (spelled out): something earlier in this call could change what it commits.",
      );
      continue;
    }
    const commit = commitOf(g, here, heredoc);
    if (commit.replays.some((r) => r.dyn)) {
      reasons.push("the shift-left checks cannot read this commit's pathspecs: spell them out.");
      continue;
    }
    const found = await checkCommit(here, g.globals.map((o) => o.v), commit, replays);
    reasons.push(...found.reasons);
    notes.push(...found.notes);
  }
  return { reasons: [...new Set(reasons)], notes: [...new Set(notes)] };
}

async function main() {
  let event;
  try {
    event = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const command = event?.tool_input?.command;
  if (event?.tool_name !== "Bash" || typeof command !== "string" || !/\b(?:git|gh)\b/.test(command)) return;
  const cwd = typeof event.cwd === "string" && event.cwd !== "" ? event.cwd : process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const { reasons, notes } = await verdict(command, cwd);
  for (const note of notes) process.stderr.write(`shift-left: ${note}\n`);
  if (reasons.length === 0) return;
  const permissionDecisionReason = `Shift-left: ${reasons.join(" ")}`;
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason } })}\n`);
}

main().catch(() => process.stderr.write("shift-left: internal error; the checks were not run (publish and CI still run them)\n"));
