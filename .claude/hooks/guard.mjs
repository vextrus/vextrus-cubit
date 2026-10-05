#!/usr/bin/env node
// PreToolUse guard: refuses the few acts this repository forbids, naming the rule and the lawful path.
// Self-contained (Node built-ins only, no repo imports), so it runs in local and cloud sessions alike.
// Two kinds of rule (docs/specs/factory.md 3.6):
// - Most rules fail OPEN: anything they cannot read is let through, so the guard is never why a session cannot
//   work.
// - The push, leak-stamp, GitHub-body and READY rules fail CLOSED: an error or a git call that times out (2 s
//   each) refuses with GUARD_ERROR. They are file checks and a few git calls, never a scan, so they finish well
//   inside the 10 s hook timeout (a timed-out hook fails open).
// Seams (docs/specs/factory/contracts/leakscan-cli.md section 8): CLAUDE_PROJECT_DIR, CLAUDE_CODE_REMOTE,
// VEXTRUS_MAIN_CHECKOUT and VEXTRUS_LEAKSCAN_HOME are read from the hook's own environment, which a command
// cannot set; a command that names the last two is refused.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OWN_CHECKOUT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
// `||`, not `??`: an empty CLAUDE_PROJECT_DIR is no project (it would resolve to the cwd, issue C11).
const PROJECT = process.env.CLAUDE_PROJECT_DIR || "";
const root = PROJECT || OWN_CHECKOUT;
const MAIN_CHECKOUT = resolve(process.env.VEXTRUS_MAIN_CHECKOUT || "/home/riz/vextrus-cubit");
// The orchestrator's session: an explicit project folder that is the main checkout. Unset or empty is not.
const orchestrators = PROJECT !== "" && resolve(PROJECT) === MAIN_CHECKOUT;
const cloud = process.env.CLAUDE_CODE_REMOTE === "true";
const LEAK_HOME = resolve(process.env.VEXTRUS_LEAKSCAN_HOME || join(MAIN_CHECKOUT, ".private/work/leakscan"));

const CORPUS_FLOOR = 100;

/** A refusal raised inside a fail-closed rule. */
class GuardError extends Error {}

// ------------------------------------------------------------------------------------------------ shell reading

/** A shell command cut into simple commands; the original rules read each one at its command position. */
const segments = (command) =>
  command
    .split(/\n|;|&&|\|\||\|/)
    .map((part) => part.trim())
    .filter((part) => part !== "");

/** The command without quotes, backslashes and line continuations (a word split by quotes reads whole). */
const flatten = (command) => command.replace(/\\\n|["'\\]/g, "");

/** Index of the `)` closing the `(` at `open`, quote-aware; the text's end when unbalanced. */
function closing(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote !== null) {
      if (c === "\\" && quote === '"') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "\\") i++;
    else if (c === "'" || c === '"') quote = c;
    else if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return text.length;
}

/** Heredoc bodies cut out of the command: `{text, docs: [{opener, body}]}` (an opener is its command line). */
function cutHeredocs(command) {
  let out = "";
  const docs = [];
  let pending = [];
  let quote = null;
  let i = 0;
  while (i < command.length) {
    const c = command[i];
    if (quote === "'") {
      out += c;
      if (c === "'") quote = null;
      i++;
      continue;
    }
    if (c === "\\" && i + 1 < command.length) {
      out += c + command[i + 1];
      i += 2;
      continue;
    }
    if (quote === '"') {
      out += c;
      if (c === '"') quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "#" && (i === 0 || /\s/.test(command[i - 1]))) {
      const end = command.indexOf("\n", i);
      const stop = end < 0 ? command.length : end;
      out += command.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === "<" && command[i + 1] === "<" && command[i + 2] !== "<" && command[i - 1] !== "<") {
      const m = /^<<(-?)[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([A-Za-z0-9_.-]+))/.exec(command.slice(i));
      if (m) {
        pending.push({ strip: m[1] === "-", delim: m[2] ?? m[3] ?? m[4], quoted: m[4] === undefined || m[0].includes("\\"), start: out.lastIndexOf("\n") + 1 });
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    if (c === "\n" && pending.length > 0) {
      i++;
      for (const doc of pending) {
        const body = [];
        while (i < command.length) {
          let end = command.indexOf("\n", i);
          if (end < 0) end = command.length;
          const line = command.slice(i, end);
          i = end + 1;
          if ((doc.strip ? line.replace(/^\t+/, "") : line) === doc.delim) break;
          body.push(line);
        }
        docs.push({ opener: out.slice(doc.start), body: body.join("\n"), quoted: doc.quoted });
      }
      out += "\n";
      pending = [];
      continue;
    }
    out += c;
    i++;
  }
  return { text: out, docs };
}

/** The `$(…)` and backtick parts of text that bash expands as if double-quoted (an unquoted heredoc body). */
function substitutions(text) {
  const found = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
    } else if (text[i] === "$" && text[i + 1] === "(") {
      const end = closing(text, i + 1);
      found.push(text.slice(i + 2, end));
      i = end;
    } else if (text[i] === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== "`") j += text[j] === "\\" ? 2 : 1;
      found.push(text.slice(i + 1, j));
      i = j;
    }
  }
  return found;
}

/** Top-level simple commands of `text` (quote-aware), and the texts of its `$(…)`, `<(…)` and backtick parts. */
function splitTop(text) {
  const segs = [];
  const nested = [];
  let cur = "";
  let quote = null;
  const push = () => {
    if (cur.trim() !== "") segs.push(cur.trim());
    cur = "";
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (quote === "'") {
      cur += c;
      if (c === "'") quote = null;
      i++;
      continue;
    }
    if (c === "\\" && i + 1 < text.length) {
      cur += c + text[i + 1];
      i += 2;
      continue;
    }
    if (quote === null && c === "$" && text[i + 1] === "'") {
      let j = i + 2;
      while (j < text.length && text[j] !== "'") j += text[j] === "\\" ? 2 : 1;
      cur += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if ((c === "$" || ((c === "<" || c === ">") && quote === null)) && text[i + 1] === "(") {
      const end = closing(text, i + 1);
      nested.push(text.slice(i + 2, end));
      cur += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== "`") j += text[j] === "\\" ? 2 : 1;
      nested.push(text.slice(i + 1, j).replace(/\\`/g, "`"));
      cur += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (quote === '"') {
      cur += c;
      if (c === '"') quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      cur += c;
      i++;
      continue;
    }
    if (c === "#" && (cur.trim() === "" || /\s/.test(text[i - 1]))) {
      const end = text.indexOf("\n", i);
      i = end < 0 ? text.length : end;
      continue;
    }
    if ("\n;&|()".includes(c)) {
      const redirect = (c === "&" && (text[i - 1] === ">" || text[i - 1] === "<" || text[i + 1] === ">")) || (c === "|" && text[i - 1] === ">");
      if (redirect) {
        cur += c;
        i++;
        continue;
      }
      push();
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  push();
  return { segs, nested };
}

const ANSI_C = { n: "\n", t: "\t", r: "\r", a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", v: "\v", "\\": "\\", "'": "'", '"': '"', "?": "?" };

/** The words of one simple command, quotes removed and escapes applied, as bash would pass them. */
function words(text) {
  const out = [];
  let cur = "";
  let inWord = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "$" && text[i + 1] === "'") {
      let j = i + 2;
      while (j < text.length && text[j] !== "'") {
        if (text[j] === "\\" && j + 1 < text.length) {
          const e = text[j + 1];
          const hex = /^x([0-9a-fA-F]{1,2})/.exec(text.slice(j + 1));
          const oct = /^([0-7]{1,3})/.exec(text.slice(j + 1));
          const uni = /^[uU]([0-9a-fA-F]{1,8})/.exec(text.slice(j + 1));
          if (hex) {
            cur += String.fromCharCode(parseInt(hex[1], 16));
            j += 1 + hex[0].length;
          } else if (uni) {
            cur += String.fromCodePoint(parseInt(uni[1], 16));
            j += 1 + uni[0].length;
          } else if (oct) {
            cur += String.fromCharCode(parseInt(oct[1], 8));
            j += 1 + oct[0].length;
          } else {
            cur += ANSI_C[e] ?? `\\${e}`;
            j += 2;
          }
          continue;
        }
        cur += text[j];
        j++;
      }
      i = j + 1;
      inWord = true;
      continue;
    }
    if (c === "'") {
      const j = text.indexOf("'", i + 1);
      cur += j < 0 ? text.slice(i + 1) : text.slice(i + 1, j);
      i = j < 0 ? text.length : j + 1;
      inWord = true;
      continue;
    }
    if (c === '"' || (c === "$" && text[i + 1] === '"')) {
      let j = c === "$" ? i + 2 : i + 1;
      while (j < text.length && text[j] !== '"') {
        if (text[j] === "\\" && j + 1 < text.length && '"\\$`\n'.includes(text[j + 1])) {
          if (text[j + 1] !== "\n") cur += text[j + 1];
          j += 2;
          continue;
        }
        cur += text[j];
        j++;
      }
      i = j + 1;
      inWord = true;
      continue;
    }
    if (c === "\\") {
      if (i + 1 < text.length && text[i + 1] !== "\n") cur += text[i + 1];
      i += 2;
      inWord = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (inWord) out.push(cur);
      cur = "";
      inWord = false;
      i++;
      continue;
    }
    // A here-string is its own word whatever touches it (`sh<<<'x'`, `bash 0<<< 'x'`; a fd number is
    // dropped), and a process substitution starts a word (`bash<(…)`).
    if (c === "<" && text.startsWith("<<<", i)) {
      if (inWord && !/^\d+$/.test(cur)) out.push(cur);
      out.push("<<<");
      cur = "";
      inWord = false;
      i += 3;
      continue;
    }
    if ((c === "<" || c === ">") && text[i + 1] === "(" && inWord) {
      out.push(cur);
      cur = "";
    }
    cur += c;
    inWord = true;
    i++;
  }
  if (inWord) out.push(cur);
  return out;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const RESERVED = new Set(["!", "{", "}", "if", "then", "elif", "else", "fi", "do", "done", "while", "until", "time", "coproc", "case", "esac", "in"]);
const PLAIN_WRAPPERS = new Set(["command", "builtin", "exec", "nohup", "setsid", "unbuffer", "chronic", "caffeinate", "noglob"]);
const VALUE_OPTIONS = {
  env: ["-u", "--unset", "-C", "--chdir", "-S", "--split-string"],
  nice: ["-n", "--adjustment"],
  ionice: ["-c", "-n", "-p", "-t"],
  stdbuf: ["-i", "-o", "-e"],
  timeout: ["-s", "--signal", "-k", "--kill-after"],
  sudo: ["-u", "-g", "-C", "-D", "-h", "-p", "-r", "-t", "-U", "-R"],
  doas: ["-u", "-C"],
  xargs: ["-n", "-I", "-P", "-d", "-L", "-s", "-a", "-E", "--max-args", "--delimiter", "--arg-file", "--max-procs", "--max-lines", "--replace", "--eof"],
  flock: ["-w", "--wait", "--timeout", "-E", "--conflict-exit-code"],
  uv: ["--with", "--python", "-p", "--directory", "--project", "--package", "--extra", "--group", "--env-file", "--with-requirements", "--index", "--index-url", "--with-editable", "--only-group", "--no-group"],
};

/** The command a simple command runs, past assignments, reserved words and wrappers (`env`, `xargs`, `uv run`…). */
function commandOf(ws) {
  let i = 0;
  const assigns = [];
  const chdirs = [];
  const skipOptions = (kind) => {
    while (i < ws.length && ws[i].startsWith("-") && ws[i] !== "--") {
      const option = ws[i].split("=")[0];
      i += VALUE_OPTIONS[kind].includes(option) && !ws[i].includes("=") ? 2 : 1;
    }
    if (ws[i] === "--") i++;
  };
  for (let loops = 0; loops < 32 && i < ws.length; loops++) {
    const w = ws[i];
    const name = basename(w);
    if (ASSIGNMENT.test(w)) {
      assigns.push(w);
      i++;
    } else if (RESERVED.has(w)) {
      i++;
    } else if (w === "function") {
      i += 2;
    } else if (PLAIN_WRAPPERS.has(name)) {
      i++;
      while (i < ws.length && ws[i].startsWith("-")) i++;
    } else if (name === "env") {
      i++;
      while (i < ws.length && (ws[i].startsWith("-") || ASSIGNMENT.test(ws[i]))) {
        if (ASSIGNMENT.test(ws[i])) assigns.push(ws[i]);
        if (ws[i] === "-C" || ws[i] === "--chdir") chdirs.push(ws[i + 1] ?? "");
        else if (/^--chdir=/.test(ws[i])) chdirs.push(ws[i].slice(8));
        else if (/^-C./.test(ws[i])) chdirs.push(ws[i].slice(2));
        i += VALUE_OPTIONS.env.includes(ws[i]) ? 2 : 1;
      }
    } else if (name === "uv" && ws[i + 1] === "run") {
      i += 2;
      skipOptions("uv");
    } else if (name === "timeout") {
      i++;
      skipOptions("timeout");
      i++;
    } else if (name === "flock") {
      i++;
      skipOptions("flock");
      i++;
    } else if (["nice", "ionice", "stdbuf", "sudo", "doas", "xargs"].includes(name)) {
      i++;
      skipOptions(name);
    } else break;
  }
  const rest = ws.slice(i);
  return { name: rest.length > 0 ? basename(rest[0]) : "", args: rest.slice(1), words: rest, assigns, chdirs };
}

const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "mksh", "fish", "busybox", "rbash"]);
const RUNS_ITS_ARGUMENTS = new Set(["script", "su", "runuser", "sg", "watch", "parallel", "tmux", "screen", "ssh"]);
const INTERPRETER = /^(?:python[0-9.]*|pypy[0-9.]*|node|nodejs|deno|bun|perl|ruby|php|lua|tclsh|Rscript|osascript)$/;
const INTERPRETER_WORD = /(?:^|[\s|;&(/])(?:python[0-9.]*|pypy[0-9.]*|node|nodejs|deno|bun|perl|ruby|php)(?=\s|$)/;
const SHELL_WORD = /(?:^|[\s|;&(/])(?:ba|z|da|k|mk|rb)?sh(?=\s|$)/;

/** Code handed to an interpreter on its command line (`python -c`, `node -e`, `perl -e`, …), or null. */
function codeOf(cmd) {
  const { name, args } = cmd;
  if (!INTERPRETER.test(name)) return null;
  const flags = /^python|^pypy/.test(name) ? ["c"] : name === "php" ? ["r"] : ["e", "E", "p"];
  const codes = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (/^--(?:eval|print)$/.test(a)) codes.push(args[k + 1] ?? "");
    else if (/^--(?:eval|print)=/.test(a)) codes.push(a.slice(a.indexOf("=") + 1));
    else if (/^-[A-Za-z]+$/.test(a) && flags.includes(a[a.length - 1])) codes.push(args[k + 1] ?? "");
    else if (/^-[A-Za-z]/.test(a) && flags.includes(a[1]) && a.length > 2) codes.push(a.slice(2));
    else if (name === "deno" && a === "eval") codes.push(args[k + 1] ?? "");
  }
  return codes.length > 0 ? codes.join("\n") : null;
}

/** The cd target of a `cd`/`pushd` command, resolved; null when it cannot be known (a variable, `-`). */
function cdTarget(cmd, cwd) {
  const target = cmd.args.filter((a) => !a.startsWith("-") || a === "-")[0];
  if (cwd === null) return null;
  if (target === undefined || target === "~") return process.env.HOME ?? null;
  if (target === "-" || target.includes("$") || target.includes("`")) return null;
  if (target.startsWith("~/")) return process.env.HOME ? join(process.env.HOME, target.slice(2)) : null;
  return resolve(cwd, target);
}

/**
 * Every simple command the shell would run (with its working folder, null when a `cd` made it unknowable),
 * every code string handed to an interpreter, and every shell text looked at, following `$(…)`, backticks,
 * `bash -c`, `eval`, heredocs fed to a shell or an interpreter, `find -exec` and `xargs`.
 */
function analyse(command, startCwd) {
  const cmds = [];
  const codes = [];
  const units = [];
  const queue = [{ text: command, depth: 0, cwd: startCwd }];
  let budget = 300;
  let truncated = false;
  let fed = false;
  for (let pass = 0; pass < 2; pass++) {
  while (queue.length > 0) {
    if (budget-- <= 0) {
      truncated = true;
      break;
    }
    const unit = queue.shift();
    units.push(unit.text);
    const { text, docs } = cutHeredocs(unit.text);
    const { segs, nested } = splitTop(text);
    let cwd = unit.cwd;
    const add = (ws, raw) => {
      const cmd = commandOf(ws);
      cmd.raw = raw;
      cmd.depth = unit.depth;
      cmd.cwd = cwd;
      for (const d of cmd.chdirs) cmd.cwd = cmd.cwd === null || d.includes("$") ? null : resolve(cmd.cwd, d);
      cmds.push(cmd);
      const deeper = (inner) => {
        if (unit.depth < 8) queue.push({ text: inner, depth: unit.depth + 1, cwd });
        else truncated = true;
      };
      if (SHELLS.has(cmd.name)) {
        const k = cmd.args.findIndex((a) => /^-[A-Za-z]*c[A-Za-z]*$/.test(a));
        if (k >= 0 && cmd.args[k + 1] !== undefined) deeper(cmd.args[k + 1]);
      }
      if (cmd.name === "eval" || cmd.name === "source" || cmd.name === ".") deeper(cmd.args.join(" "));
      if (RUNS_ITS_ARGUMENTS.has(cmd.name)) deeper(cmd.args.filter((a) => !a.startsWith("-")).join(" "));
      // A here-string is the shell's or the interpreter's input: `sh <<< 'cmd'`, `python3 <<< 'code'`.
      if (SHELLS.has(cmd.name) || INTERPRETER.test(cmd.name)) {
        const k = cmd.words.findIndex((w) => w.startsWith("<<<"));
        const text = k < 0 ? null : cmd.words[k].length > 3 ? cmd.words[k].slice(3) : cmd.words[k + 1] ?? "";
        if (text !== null) {
          if (SHELLS.has(cmd.name)) deeper(text);
          else codes.push(text);
        }
      }
      const code = codeOf(cmd);
      if (code !== null) codes.push(code);
      if (cmd.name === "find") {
        for (let k = 0; k < cmd.args.length; k++) {
          if (/^-(?:exec|execdir|ok|okdir)$/.test(cmd.args[k])) {
            const end = cmd.args.findIndex((a, j) => j > k && (a === ";" || a === "+"));
            const sub = cmd.args.slice(k + 1, end < 0 ? undefined : end);
            if (sub.length > 0 && unit.depth < 8) add(sub, sub.join(" "));
          }
        }
      }
      if (cmd.name === "git") {
        const g = gitOf(cmd);
        if (g.verb === "submodule" && g.args.includes("foreach")) deeper(g.args.slice(g.args.indexOf("foreach") + 1).filter((a) => !a.startsWith("-")).join(" "));
        for (let k = 0; k < g.args.length; k++) {
          if ((g.verb === "rebase" && (g.args[k] === "--exec" || g.args[k] === "-x")) || (g.verb === "bisect" && g.args[k] === "run")) deeper(g.args.slice(k + 1).join(" "));
          if (g.verb === "rebase" && g.args[k].startsWith("--exec=")) deeper(g.args[k].slice(7));
        }
        // `git -c alias.x='!cmd' x` runs cmd through the shell.
        for (let k = 0; k < cmd.args.length; k++) {
          const value = cmd.args[k] === "-c" ? cmd.args[k + 1] : null;
          const alias = value ? /^alias\.[^=]+=!(.*)$/is.exec(value) : null;
          if (alias) deeper(alias[1]);
        }
      }
      return cmd;
    };
    for (const seg of segs) {
      const cmd = add(words(seg), seg);
      if (cmd.name === "cd" || cmd.name === "pushd") cwd = cdTarget(cmd, cwd);
    }
    for (const inner of nested) {
      if (unit.depth < 8) queue.push({ text: inner, depth: unit.depth + 1, cwd });
      else truncated = true;
    }
    for (const doc of docs) {
      // An unquoted heredoc (`<<EOF`) expands its `$(…)` and backticks, whatever command reads it.
      if (!doc.quoted) {
        for (const inner of substitutions(doc.body)) {
          if (unit.depth < 8) queue.push({ text: inner, depth: unit.depth + 1, cwd });
          else truncated = true;
        }
      }
      if (SHELL_WORD.test(doc.opener)) {
        if (unit.depth < 8) queue.push({ text: doc.body, depth: unit.depth + 1, cwd });
        else truncated = true;
      }
      if (INTERPRETER_WORD.test(doc.opener)) codes.push(doc.body);
    }
  }
  // A shell or an interpreter fed from stdin, a process substitution or a script written in the same
  // command runs what echo and printf produce: read their words as shell text and as code, once.
  if (fed || pass > 0) break;
  const flat = flatten(command);
  const readers = cmds.filter((cmd) => readsCommands(cmd, flat));
  if (readers.length === 0) break;
  fed = true;
  for (const producer of cmds.filter((cmd) => cmd.name === "echo" || cmd.name === "printf")) {
    const text = producer.args.filter((a) => !/^-[neE]+$/.test(a)).join(" ").replace(/\\n/g, "\n");
    if (readers.some((cmd) => SHELLS.has(cmd.name) || cmd.name === "source" || cmd.name === ".")) queue.push({ text, depth: 1, cwd: producer.cwd });
    if (readers.some((cmd) => INTERPRETER.test(cmd.name))) codes.push(text);
  }
  }
  return { cmds, codes, units, truncated };
}

// ------------------------------------------------------------------------------------------------ git reading

/** A git invocation: its global options and verb, or null for any other command. */
function gitOf(cmd) {
  // git's exec-path links (`/usr/lib/git-core/git-push`, `git-config`) run as `git <verb>`.
  const dashed = /^git-([a-z][a-z0-9-]*)$/.exec(cmd.name);
  if (!dashed && cmd.name !== "git") return null;
  // A folder bash may build at run time (`$`, a backtick, `~`, a glob, a brace, a quote, a space: any character
  // outside a plain path's) cannot be judged: it becomes one no repository can live in, so every judge run
  // against it fails closed (a literal `$OTHER` or `~` folder in the cwd is never read instead).
  const judgeable = (value) => (/[^A-Za-z0-9_./@+-]/.test(value) ? "/dev/null/unjudgeable" : value);
  const a = cmd.args;
  const config = [];
  const dirs = [];
  let gitDir = null;
  let workTree = null;
  let i = 0;
  while (!dashed && i < a.length && a[i].startsWith("-")) {
    const w = a[i];
    const eq = w.indexOf("=");
    const key = eq > 0 ? w.slice(0, eq) : w;
    if (w === "-C") {
      dirs.push(a[i + 1] ?? "");
      i += 2;
    } else if (w === "-c") {
      config.push(a[i + 1] ?? "");
      i += 2;
    } else if (/^-[cC]./.test(w)) {
      (w[1] === "c" ? config : dirs).push(w.slice(2));
      i++;
    } else if (key === "--git-dir" || key === "--work-tree" || key === "--config-env" || key === "--namespace" || key === "--exec-path" || key === "--super-prefix" || key === "--attr-source") {
      const value = eq > 0 ? w.slice(eq + 1) : a[i + 1];
      if (key === "--git-dir") gitDir = judgeable(value ?? "");
      if (key === "--work-tree") workTree = judgeable(value ?? "");
      if (key === "--config-env") config.push(value ?? "");
      i += eq > 0 ? 1 : 2;
    } else i++;
  }
  // GIT_DIR and GIT_WORK_TREE (bare or through `env`) name the repository both forms use.
  for (const assign of cmd.assigns) {
    if (assign.startsWith("GIT_DIR=")) gitDir = judgeable(assign.slice(8));
    if (assign.startsWith("GIT_WORK_TREE=")) workTree = judgeable(assign.slice(14));
  }
  const verb = dashed ? dashed[1] : a[i] ?? "";
  const rest = dashed ? a : a.slice(i + 1);
  return { verb, args: rest.map((arg) => longOption(verb, arg)), config, dirs, gitDir, workTree, assigns: cmd.assigns, cwd: cmd.cwd };
}

// Git accepts any unique prefix of a long option (`--mirr` is `--mirror`). The options the rules judge are
// expanded to their full names; a prefix that is ambiguous or names no option becomes "--?" (judged unknown).
const GIT_LONG_OPTIONS = {
  push: ["all", "branches", "mirror", "delete", "tags", "follow-tags", "force", "force-with-lease", "force-if-includes", "prune", "dry-run", "porcelain", "receive-pack", "exec", "repo", "set-upstream", "thin", "progress", "no-verify", "verify", "signed", "atomic", "push-option", "recurse-submodules", "ipv4", "ipv6", "quiet", "verbose"],
  commit: ["no-verify", "verify", "all", "amend", "message", "file", "no-edit", "edit", "author", "date", "signoff", "allow-empty", "allow-empty-message", "quiet", "verbose", "patch", "include", "only", "pathspec-from-file", "fixup", "squash", "reuse-message", "reedit-message", "cleanup", "status", "no-status", "gpg-sign", "no-gpg-sign", "trailer", "dry-run", "porcelain", "short", "branch", "long", "null", "template", "untracked-files", "reset-author", "interactive", "no-post-rewrite", "pathspec-file-nul"],
  merge: ["no-verify", "verify", "commit", "no-commit", "edit", "no-edit", "ff", "no-ff", "ff-only", "squash", "no-squash", "message", "file", "strategy", "strategy-option", "abort", "continue", "quit", "stat", "no-stat", "log", "no-log", "signoff", "allow-unrelated-histories", "autostash", "verify-signatures", "quiet", "verbose", "progress", "rerere-autoupdate", "into-name", "cleanup", "gpg-sign", "overwrite-ignore", "summary"],
  reset: ["hard", "soft", "mixed", "merge", "keep", "quiet", "no-quiet", "patch", "pathspec-from-file", "pathspec-file-nul", "recurse-submodules", "intent-to-add", "no-refresh", "refresh"],
  checkout: ["force", "quiet", "progress", "ours", "theirs", "track", "no-track", "guess", "no-guess", "detach", "orphan", "ignore-skip-worktree-bits", "merge", "conflict", "patch", "ignore-other-worktrees", "overwrite-ignore", "recurse-submodules", "overlay", "no-overlay", "pathspec-from-file", "pathspec-file-nul"],
  restore: ["source", "patch", "worktree", "staged", "quiet", "progress", "ours", "theirs", "merge", "conflict", "ignore-unmerged", "ignore-skip-worktree-bits", "recurse-submodules", "overlay", "no-overlay", "pathspec-from-file", "pathspec-file-nul"],
  branch: ["delete", "force", "move", "copy", "list", "all", "remotes", "verbose", "quiet", "track", "no-track", "set-upstream-to", "unset-upstream", "edit-description", "contains", "no-contains", "merged", "no-merged", "column", "no-column", "sort", "points-at", "format", "show-current", "create-reflog", "abbrev", "no-abbrev", "ignore-case", "omit-empty", "recurse-submodules", "color", "no-color"],
  worktree: ["force", "detach", "checkout", "no-checkout", "lock", "reason", "orphan", "track", "no-track", "guess-remote", "quiet", "verbose", "expire", "porcelain", "dry-run", "relative-paths", "z"],
  clean: ["force", "dry-run", "quiet", "exclude", "interactive"],
};

/** A long option of `verb` expanded from a unique prefix to its full name (or "--?" when it is not one). */
function longOption(verb, arg) {
  const names = GIT_LONG_OPTIONS[verb];
  if (names === undefined || !arg.startsWith("--") || arg === "--") return arg;
  const eq = arg.indexOf("=");
  const key = (eq > 0 ? arg.slice(2, eq) : arg.slice(2)).toLowerCase();
  const value = eq > 0 ? arg.slice(eq) : "";
  const all = [...new Set([...names, ...names.filter((n) => !n.startsWith("no-")).map((n) => `no-${n}`)])];
  if (all.includes(key)) return `--${key}${value}`;
  const matches = all.filter((n) => n.startsWith(key));
  return matches.length === 1 ? `--${matches[0]}${value}` : "--?";
}

/** Every git invocation in the analysed command. */
const gitsOf = (analysis) => analysis.cmds.map(gitOf).filter((g) => g !== null);

/** The folder a git invocation works in (its cwd and every `-C`), or null when it cannot be known. */
function gitFolder(g) {
  if (g.cwd === null) return null;
  let dir = g.cwd;
  for (const d of g.dirs) {
    if (d.includes("$")) return null;
    dir = resolve(dir, d);
  }
  return dir;
}

/** Runs git read-only in the invocation's repository; a failure to run (no folder, timeout) is a GuardError. */
function runGit(g, args) {
  const dir = gitFolder(g);
  if (dir === null) throw new GuardError("the working folder cannot be known (a cd to a variable or `-`)");
  const pre = [];
  if (g.gitDir !== null) pre.push(`--git-dir=${resolve(dir, g.gitDir)}`);
  if (g.workTree !== null) pre.push(`--work-tree=${resolve(dir, g.workTree)}`);
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_COUNT", "GIT_NAMESPACE"]) delete env[name];
  const run = spawnSync("git", [...pre, ...args], { cwd: dir, encoding: "utf8", timeout: 2000, env });
  if (run.error) throw new GuardError(`git ${args[0]} could not run in ${dir}`);
  return run;
}

/** The full sha a revision names in the invocation's repository, or null. */
function commitOf(g, rev) {
  if (rev.startsWith("-")) return null;
  const run = runGit(g, ["rev-parse", "--verify", "-q", "--end-of-options", `${rev}^{commit}`]);
  return run.status === 0 ? run.stdout.trim() : null;
}

/** The current branch's name, or "" when detached. */
function currentBranch(g) {
  const run = runGit(g, ["symbolic-ref", "-q", "--short", "HEAD"]);
  if (run.status === 0) return run.stdout.trim();
  if (run.status === 1) return "";
  throw new GuardError("git symbolic-ref failed");
}

/** A push's options and positional words. */
function pushOf(g) {
  const flags = new Set();
  const positional = [];
  let repoOption = null;
  let afterDashes = false;
  for (let i = 0; i < g.args.length; i++) {
    const a = g.args[i];
    if (afterDashes || !a.startsWith("-") || a === "-") {
      positional.push(a);
      continue;
    }
    if (a === "--") {
      afterDashes = true;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.split("=")[0];
      flags.add(key);
      if (key === "--repo") repoOption = a.includes("=") ? a.slice(7) : g.args[++i];
      else if (["--push-option", "--receive-pack", "--exec", "--recurse-submodules"].includes(key) && !a.includes("=")) i++;
      continue;
    }
    for (const letter of a.slice(1)) flags.add(`-${letter}`);
    if (/^-[A-Za-z]*o$/.test(a)) i++;
  }
  const remote = repoOption ?? positional[0] ?? null;
  const refspecs = repoOption !== null ? positional : positional.slice(1);
  return { flags, remote, refspecs, unknown: flags.has("--?") };
}

const isPush = (g) => g.verb === "push" || (g.verb === "subtree" && g.args.includes("push"));

// ------------------------------------------------------------------------------------------------ the records

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** The corpus file's sha256, computed here (there is no stored hash to trust). */
function corpusHash() {
  let data;
  try {
    data = readFileSync(join(LEAK_HOME, "corpus"));
  } catch {
    throw new GuardError(`there is no leak corpus at ${join(LEAK_HOME, "corpus")}: build it with \`uv run python -m tools.leakscan build\` in the main checkout`);
  }
  // An empty corpus makes every scan clean, so it vouches for nothing.
  const strings = data.toString("utf8").split("\n").filter((line) => line.length >= 8).length;
  // A corpus of a few strings vouches for almost nothing: the real one holds thousands. (The test seam
  // VEXTRUS_LEAKSCAN_HOME allows small invented corpora.)
  if (strings === 0 || (strings < CORPUS_FLOOR && !process.env.VEXTRUS_LEAKSCAN_HOME)) throw new GuardError(`the leak corpus holds ${strings} strings, under the floor of ${CORPUS_FLOOR}: rebuild it in the main checkout`);
  return sha256(data);
}

/**
 * Why the stamp `ok/<name>` does not vouch for what is sent, or null when it is valid (leakscan-cli.md 4):
 * exactly `{corpus, range}`; `corpus` is the corpus file's sha256 now; the range ends at `name`; for a push its
 * base is an ancestor of both origin/main and the pushed head.
 */
function stampProblem(name, push) {
  const file = join(LEAK_HOME, "ok", name);
  let stamp;
  try {
    if (!lstatSync(file).isFile()) return "the stamp is not a regular file";
    stamp = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return `no readable stamp ok/${name}`;
  }
  if (stamp === null || typeof stamp !== "object" || Array.isArray(stamp)) return "the stamp is not a JSON object";
  const keys = Object.keys(stamp).sort();
  if (keys.length !== 2 || keys[0] !== "corpus" || keys[1] !== "range") return "the stamp does not hold exactly corpus and range";
  if (typeof stamp.corpus !== "string" || typeof stamp.range !== "string") return "the stamp's fields are not strings";
  if (stamp.corpus !== corpusHash()) return "the stamp was made with another corpus (rebuilt since): scan again";
  if (push === undefined) return stamp.range === `sha256:${name}` ? null : "the stamp names other bytes";
  const m = /^([0-9a-f]{40})\.\.([0-9a-f]{40})$/.exec(stamp.range);
  if (m === null || m[2] !== name) return "the stamp's range does not end at the pushed head";
  for (const tip of ["refs/remotes/origin/main", name]) {
    const run = runGit(push, ["merge-base", "--is-ancestor", m[1], tip]);
    if (run.status !== 0) return "the stamp's range starts after origin/main, so it scanned less than the push sends";
  }
  return null;
}

// --- trailer reader: begin (copied verbatim from trailers.mjs)
/**
 * The factory trailers of one message: { outcome, reason, why, gated }, outcome "READY", "BLOCKED", "READY-NO-VERIFY"
 * (a malformed READY, or a factory line the reading does not take) or null. The read paragraph is the last paragraph
 * holding a `Factory-*` line (or a loose `factory state:` line) among the last two; such a line in any other paragraph
 * is READY-NO-VERIFY ("factory trailer not in the last paragraph"). `gated`: a READY-looking `Factory-State` line in the
 * last two paragraphs, which the guard's push gate and the stop gate treat as READY (and, on a head not READY, is
 * READY-NO-VERIFY). ASCII classes and `\n` splits only, written to agree with the Python reader on every input.
 */
function readTrailers(message, tree) {
  const WS = "[ \\t\\v\\f\\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";
  const TRAILER = /^([A-Za-z0-9-]+):[ \t]*([^\n]*?)[ \t]*$/;
  const LOOSE_STATE = new RegExp(`^${WS}*factory[-_ ]?state${WS}*:${WS}*([^\\n]*)$`, "i");
  const KEYS = new Set(["factory-state", "factory-verify", "factory-reason"]);
  const isFactory = (line) => {
    const m = TRAILER.exec(line);
    return (m !== null && m[1].toLowerCase().startsWith("factory-")) || LOOSE_STATE.test(line);
  };
  const looksReady = (line) => {
    const m = LOOSE_STATE.exec(line);
    return m !== null && /ready/i.test(m[1]);
  };
  const result = (outcome, reason = null, why = null, gated = false) => ({ outcome, reason, why, gated });
  const core = (lines) => {
    const found = new Map();
    for (const line of lines) {
      const m = TRAILER.exec(line);
      if (m === null || !m[1].toLowerCase().startsWith("factory-")) continue;
      const key = m[1].toLowerCase();
      if (!found.has(key)) found.set(key, []);
      found.get(key).push(m[2]);
    }
    if (found.size === 0) return result(null);
    if ([...found.values()].some((values) => values.length > 1)) return result(null, null, "a factory trailer is repeated");
    if ([...found.keys()].some((key) => !KEYS.has(key))) return result(null, null, "an unknown factory trailer");
    if (!found.has("factory-state")) return result(null, null, "factory trailers without Factory-State");
    const state = found.get("factory-state")[0];
    const verify = found.get("factory-verify")?.[0] ?? null;
    const reason = found.get("factory-reason")?.[0] ?? null;
    const verifyOk = verify === null || /^[0-9a-f]{40} ok$/.test(verify);
    if (state === "READY") {
      if (reason !== null) return result(null, null, "READY carries a Factory-Reason");
      if (verify === null) return result(null, null, "no Factory-Verify");
      if (!verifyOk) return result(null, null, "Factory-Verify is malformed");
      if (verify.slice(0, 40) !== tree) return result(null, null, "the Factory-Verify tree is not the head's tree");
      return result("READY");
    }
    if (state === "BLOCKED") {
      if (reason === null || !/^[^\r\n]{1,200}$/u.test(reason) || !verifyOk) return result(null, null, "BLOCKED without a one-line Factory-Reason");
      return result("BLOCKED", reason);
    }
    return result(null, null, "Factory-State is not READY or BLOCKED");
  };

  const paragraphs = message
    .replace(/\r/g, "")
    .split(/\n[ \t]*\n/)
    .filter((p) => /[^ \t\n]/.test(p))
    .map((p) => p.split("\n"));
  const holds = paragraphs.map((lines) => lines.some(isFactory));
  const lastTwo = [paragraphs.length - 1, paragraphs.length - 2].filter((i) => i >= 0);
  const readAt = lastTwo.find((i) => holds[i]) ?? -1;
  const gated = lastTwo.some((i) => paragraphs[i].some(looksReady));
  if (holds.some((held, i) => held && i !== readAt)) return result("READY-NO-VERIFY", null, "factory trailer not in the last paragraph", gated);
  const found = core(readAt < 0 ? [] : paragraphs[readAt]);
  if (found.outcome === "READY" || !gated) return result(found.outcome, found.reason, found.why, gated);
  return result("READY-NO-VERIFY", null, found.why ?? "a READY-looking Factory-State line outside the factory trailers", gated);
}
// --- trailer reader: end

/** Why a READY head may not be pushed, or null (spec 2.2; verify-record.schema.json). */
function readyProblem(g, sha) {
  const log = runGit(g, ["log", "-1", "--format=%B", sha, "--"]);
  if (log.status !== 0) throw new GuardError("could not read the pushed commit's message");
  const treeRun = runGit(g, ["rev-parse", "--verify", "-q", `${sha}^{tree}`]);
  if (treeRun.status !== 0) throw new GuardError("could not read the pushed tree or the git folder");
  const tree = treeRun.stdout.trim();
  if (!readTrailers(log.stdout, tree).gated) return null;
  const commonRun = runGit(g, ["rev-parse", "--git-common-dir"]);
  if (commonRun.status !== 0) throw new GuardError("could not read the pushed tree or the git folder");
  const file = join(resolve(gitFolder(g), commonRun.stdout.trim()), "vextrus", `verify-${tree}.json`);
  let record;
  try {
    record = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return `no readable verify record for tree ${tree}`;
  }
  const checks = record?.checks;
  if (record?.schema_version !== 1 || record?.tree !== tree || !Array.isArray(checks) || checks.length === 0) return "the verify record is malformed or names another tree";
  if (!checks.every((check) => check !== null && typeof check === "object" && check.exit_code === 0)) return "a check in the verify record did not pass";
  return null;
}

// ------------------------------------------------------------------------------------------------ the rules' parts

const SECRET_NAME = String.raw`[A-Z0-9_]*(?:API_KEY|_KEY|TOKEN|SECRET|PASSWORD)`;
const SECRET_EXPANSION = new RegExp(String.raw`\$(?:${SECRET_NAME}\b|\{!?${SECRET_NAME}(?:[^A-Za-z0-9_}][^}]*)?\})`);
const SECRET_FILES = /(?:~|\$HOME|\/home\/[^/\s]+)\/(?:\.bashrc|\.bash_profile|\.profile|\.zshrc|\.claude\/\.credentials\.json|\.pgpass|\.config\/gh)\b/;
// A secret file named by any verb, from any folder (`cp`, `base64`, `tar` and `ls` too; spec 3.6).
const SECRET_PATH =
  /(?:^|[^A-Za-z0-9_.-])\.(?:pgpass|bashrc|bash_profile|bash_login|bash_history|profile|zshrc|zprofile|zshenv|netrc|git-credentials)(?![A-Za-z0-9_.-])|\.claude\/\.credentials\.json|\.config\/gh(?![A-Za-z0-9_.-])|\/proc\/[^\s/]+\/environ\b/;
const SECRET_BASENAMES = [".pgpass", ".bashrc", ".bash_profile", ".bash_login", ".bash_history", ".profile", ".zshrc", ".zprofile", ".zshenv", ".netrc", ".git-credentials", ".credentials.json"];
const ENV_ACCESS = /\bos\.environ\b|\bgetenv\b|\bprocess\.env\b|\bENV\s*\[|\$ENV\{|\bDeno\.env\b|\bBun\.env\b|\benviron\b/;
const ENV_DUMP =
  /print\s*\(\s*(?:dict\s*\(\s*)?os\.environ|os\.environ\s*\)|environ\.items\s*\(|JSON\.stringify\s*\(\s*process\.env|console\.\w+\s*\(\s*process\.env\s*[,)]|Object\.(?:entries|values|keys)\s*\(\s*process\.env|util\.inspect\s*\(\s*process\.env/;

/** A shell glob word (`~/.pg*`) that could name a secret file. */
function globNamesSecret(word) {
  if (!/[*?[]/.test(word)) return false;
  if (/\.config\/g[*?[]|\.config\/[*?[]/.test(word)) return true;
  // Bash's `*`, `?` and `[…]` never match a leading dot: only a glob whose basename starts with "." reaches a
  // dotfile (`ls docs/*`, `wc -l tools/x/*` name no secret).
  if (!basename(word).startsWith(".")) return false;
  const name = basename(word).replace(/\[[^\]]*\]?/g, "?");
  const pattern = new RegExp(`^${name.replace(/[.+^${}()|\\\]]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return SECRET_BASENAMES.some((secret) => pattern.test(secret)) || /\.config\/g[*?[]|\.config\/[*?[]/.test(word);
}

/** The words of a command that are not a commit or tag message (a message may name a file without reading it). */
function wordsBesidesMessages(cmd) {
  const g = gitOf(cmd);
  if (g === null || !["commit", "tag", "merge", "notes", "stash"].includes(g.verb)) return cmd.words;
  const kept = [];
  for (let k = 0; k < cmd.words.length; k++) {
    const w = cmd.words[k];
    if (w === "-m" || w === "--message") k++;
    else if (!/^(?:-m.|--message=)/.test(w)) kept.push(w);
  }
  return kept;
}

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

/** True when the parsed command reads, copies, lists or prints a secret, or code prints one. */
function secretTouched(analysis) {
  for (const cmd of analysis.cmds) {
    for (const w of wordsBesidesMessages(cmd)) if (SECRET_PATH.test(w) || globNamesSecret(w)) return true;
    if (["echo", "printf", "cat", "tee", "base64", "xxd", "od", "hexdump", "rev", "tr", "fold", "logger", "strings"].includes(cmd.name) && SECRET_EXPANSION.test(cmd.raw)) return true;
    if (cmd.name === "printenv" && cmd.args.some((a) => new RegExp(`^${SECRET_NAME}$`).test(a))) return true;
    if (["awk", "gawk", "mawk", "nawk", "jq", "envsubst"].includes(cmd.name) && cmd.args.some((a) => /ENVIRON|\$ENV|\benv\b|getenv/.test(a) && (new RegExp(SECRET_NAME).test(a) || /ENVIRON\s*\)|for\s*\(\s*\w+\s+in\s+ENVIRON|\$ENV\b(?!\.)|env\s*$/.test(a)))) return true;
    if (cmd.name === "envsubst") return true;
    if (cmd.name === "gh" && cmd.args[0] === "auth" && (cmd.args[1] === "token" ? cmd.depth === 0 : cmd.args.includes("--show-token") || cmd.args.includes("-t"))) return true;
  }
  for (const code of analysis.codes) {
    if (SECRET_PATH.test(code)) return true;
    if (ENV_ACCESS.test(code) && (new RegExp(SECRET_NAME).test(code) || ENV_DUMP.test(code))) return true;
  }
  return false;
}

const RM_RECURSIVE = (cmd) => {
  if (cmd.name !== "rm") return false;
  for (const a of cmd.args) {
    if (a === "--") break;
    if (a === "--recursive" || /^-[a-zA-Z]*[rR]/.test(a)) return true;
  }
  return false;
};
const CODE_DELETE = /\b(?:rmtree|remove_tree|rm_rf|rm_r|rimraf|deleteRecursively)\b|(?:^|[\s"'`(;&|\\/,[])rm["',\s]+-{1,2}[a-zA-Z]*[rR]/;

function recursiveDelete(analysis) {
  for (const cmd of analysis.cmds) {
    if (RM_RECURSIVE(cmd)) return true;
    if (cmd.name === "find") {
      if (cmd.args.some((a) => a === "-delete")) return true;
      for (let k = 0; k < cmd.args.length; k++) {
        if (/^-(?:exec|execdir|ok|okdir)$/.test(cmd.args[k]) && basename(cmd.args[k + 1] ?? "") === "rm") return true;
      }
    }
    if (cmd.name === "rsync" && cmd.args.some((a) => /^--(?:delete|remove-source-files)/.test(a))) return true;
  }
  for (const code of analysis.codes) {
    if (CODE_DELETE.test(code)) return true;
    if (/\brm(?:dir)?(?:Sync)?\s*\(/.test(code) && /recursive/.test(code)) return true;
  }
  return false;
}

/** A `while`/`until` loop waiting on `pgrep -f` or `ps … | grep`, which matches its own command line. */
function selfMatchingWait(analysis) {
  return analysis.units.some(
    (text) =>
      /(?:^|[\s;&|(!])(?:while|until|for)\s/.test(text) &&
      (/\bpgrep\b[^;&|\n]*\s(?:-[A-Za-z]*f[A-Za-z]*|--full)\b/.test(text) || /\bps\b[^;&\n]*\|\s*(?:[ef]?grep|rg|ugrep|awk)\b/.test(text)),
  );
}

/** Folder of the repository that holds `dir` (the nearest one with `.git`), or `dir` itself. */
function repoTop(dir) {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return d;
    if (dirname(d) === d) return dir;
  }
}

const DRAWING = /\.(?:dwg|dxf|rvt|ifc)$/i;

/** True when the folder holds a drawing (or is too large to tell, which also refuses). */
function holdsDrawing(folder) {
  let seen = 0;
  const stack = [folder];
  while (stack.length > 0) {
    const d = stack.pop();
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (++seen > 20000) return true;
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      if (entry.isDirectory()) stack.push(join(d, entry.name));
      else if (DRAWING.test(entry.name)) return true;
    }
  }
  return false;
}

const SEED_DRAWING = /^(?:\.\/)?vextrus\/seed\/recorded\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.dwg$/;
const SEED_FOLDER = "vextrus/seed/recorded";

/** True when `git add` names a folder that may hold drawings, agent memory, or a pathspec it cannot judge. */
function stagesFolder(g) {
  if (g.verb !== "add" && g.verb !== "stage") return false;
  const base = gitFolder(g) ?? root;
  const top = repoTop(base);
  let afterDashes = false;
  for (const a of g.args) {
    if (!afterDashes && a === "--") {
      afterDashes = true;
      continue;
    }
    if (!afterDashes && a.startsWith("--pathspec-from-file")) return true;
    if (!afterDashes && a.startsWith("-")) continue;
    if (/(?:^|\/)\.claude\/agent-memory[^/]*(?:\/|$)/.test(a) || /^\.?\/?\.claude\/agent-memory/.test(a)) return true;
    if (SEED_DRAWING.test(a)) continue;
    if (a.startsWith(":") || /\$|`/.test(a)) return true;
    const literal = a.split(/[*?[]/)[0];
    const glob = literal !== a;
    const absolute = resolve(base, glob ? literal || "." : a);
    const rel = relative(top, absolute).split("\\").join("/");
    if (rel.startsWith("..") && !isAbsolute(a) && gitFolder(g) === null) continue;
    if (/(?:^|\/)\.claude\/agent-memory/.test(`/${rel}`)) return true;
    if (glob) {
      const relGlob = relative(top, resolve(base, a)).split("\\").join("/").replace(/\[[^\]]*\]?/g, "?");
      const pattern = new RegExp(`^${relGlob.replace(/[.+^${}()|\\\]]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*")}`);
      if ([".claude/agent-memory/x", ".claude/agent-memory-x/x", `${SEED_FOLDER}/x.dwg`].some((path) => pattern.test(path))) return true;
    }
    if (rel === "" || rel === "." || SEED_FOLDER === rel || SEED_FOLDER.startsWith(`${rel}/`) || (glob && `${rel}/`.startsWith(`${SEED_FOLDER}/`))) return true;
    let folder = false;
    try {
      folder = statSync(absolute).isDirectory();
    } catch {
      folder = false;
    }
    if ((folder || glob || a.endsWith("/")) && holdsDrawing(folder || glob ? absolute : dirname(absolute))) return true;
  }
  return false;
}

/** True when a git invocation discards work (spec 3.6 "Local discards"). */
function discards(g) {
  const { verb, args } = g;
  const opts = args.filter((a) => a.startsWith("-") && a !== "--");
  const dashes = args.indexOf("--");
  const paths = dashes >= 0 ? args.slice(dashes + 1) : [];
  const base = gitFolder(g);
  const wide = (p) => {
    if (p === "." || p === "./" || p === "*" || p === ":/" || p.startsWith(":") || p.endsWith("/") || /[*?[]/.test(p)) return true;
    if (base === null) return false;
    try {
      return statSync(resolve(base, p)).isDirectory();
    } catch {
      return false;
    }
  };
  if (verb === "reset") return opts.some((a) => a === "--hard" || a === "--merge");
  if (verb === "checkout" || verb === "switch") {
    if (opts.some((a) => a === "-f" || a === "--force" || a === "--discard-changes" || /^-[a-zA-Z]*f/.test(a) && !a.startsWith("--"))) return true;
    if (verb === "checkout") {
      const before = (dashes >= 0 ? args.slice(0, dashes) : args).filter((a) => !a.startsWith("-"));
      if (paths.some(wide)) return true;
      if (before.slice(dashes >= 0 ? 0 : 1).some((p) => p === "." || p === "./" || p === ":/" || p === "*")) return true;
      if (before.length >= 1 && dashes < 0 && (before[0] === "." || before[0] === "./")) return true;
    }
    return false;
  }
  if (verb === "restore") {
    const staged = opts.some((a) => a === "--staged" || a === "-S");
    const worktree = opts.some((a) => a === "--worktree" || a === "-W" || /^-[a-zA-Z]*W/.test(a));
    if (staged && !worktree) return false;
    const targets = [...paths, ...(dashes >= 0 ? args.slice(0, dashes) : args).filter((a, k, all) => !a.startsWith("-") && !/^(?:-s|--source)$/.test(all[k - 1] ?? ""))];
    return targets.some(wide);
  }
  if (verb === "branch") {
    const deletes = opts.some((a) => a === "--delete" || /^-[a-zA-Z]*d/.test(a) && !a.startsWith("--"));
    const force = opts.some((a) => a === "--force" || /^-[a-zA-Z]*f/.test(a) && !a.startsWith("--"));
    return opts.some((a) => /^-[a-zA-Z]*[DM]/.test(a) && !a.startsWith("--")) || (deletes && force);
  }
  if (verb === "worktree") return args[0] === "remove" && opts.some((a) => a === "--force" || a === "-f");
  if (verb === "stash") return args[0] === "drop" || args[0] === "clear";
  if (verb === "update-ref") return opts.some((a) => a === "-d" || a === "--delete" || /^-[a-z]*d/.test(a) && !a.startsWith("--"));
  return false;
}

/** The keys a git invocation sets for itself (`-c`, `--config-env`, GIT_CONFIG_* variables). */
const configKeys = (g) => g.config.map((kv) => kv.split("=")[0].toLowerCase());

/** True when a command sets core.hooksPath (or hides config from the guard), except the one lawful line. */
function hooksPathSet(analysis, command) {
  // The reads of core.hooksPath that pass are exactly these whole commands, matched on the command's text: no
  // wrapper, no expansion, nothing else in it but a trailing `|| echo <plain words>`. Bash and xargs can turn
  // what argv shows into a write (`core.hooksPath${IFS}/x`, `{core.hooksPath,/x}`, `xargs git config
  // core.hooksPath`), so any other shape naming the key keeps the write judgement below.
  const read = /^git( -C [A-Za-z0-9_./-]+)? config( --local| --global| --show-origin| --show-scope| --file [A-Za-z0-9_./-]+)*( --get| --get-all| get)? [cC][oO][rR][eE]\.[hH][oO][oO][kK][sS][pP][aA][tT][hH]( \|\| echo [A-Za-z0-9 _.-]*)?$/.test(command);
  const flat = flatten(command);
  if (/\bGIT_CONFIG_(?:PARAMETERS|COUNT|KEY_|VALUE_)/.test(flat)) return true;
  if (/(?:^|[\s/])\.git\/(?:config|worktrees\/[^\s/]+\/config\.worktree)\b/.test(flat) && (/[^<]>|\btee\b|\bsed\b[^|;&]*\s-i|\bperl\b[^|;&]*\s-[a-z]*i|\b(?:cp|mv|ln|install|dd|truncate|python[0-9.]*|node)\b/.test(flat))) return true;
  for (const g of gitsOf(analysis)) {
    if (g.assigns.some((a) => /^(?:HOME|XDG_CONFIG_HOME|GIT_CONFIG_GLOBAL|GIT_CONFIG_SYSTEM|GIT_CONFIG_NOSYSTEM|GIT_EXEC_PATH|GIT_TEMPLATE_DIR)=/.test(a))) return true;
    if (configKeys(g).some((k) => k === "core.hookspath" || k.startsWith("include"))) return true;
    if (g.assigns.some((a) => /^GIT_CONFIG(?:_PARAMETERS|_COUNT|_KEY_\d+|_VALUE_\d+|_GLOBAL|_SYSTEM)?=/.test(a) && !/^GIT_CONFIG_(?:GLOBAL|SYSTEM)=\/dev\/null$/.test(a))) return true;
    if (g.verb === "config" && g.args.some((a) => /core\.hookspath/i.test(a) || /^include(?:if)?\./i.test(a))) {
      if (read) continue;
      const lawful = orchestrators && !cloud && g.dirs.length === 0 && g.gitDir === null && JSON.stringify(g.args.filter((a) => a !== "--local")) === JSON.stringify(["core.hooksPath", "scripts/git-hooks"]);
      if (!lawful) return true;
    }
  }
  return false;
}

/** True when a command sets config that changes what a push sends or what a verb runs (aliases, push refspecs). */
function pushConfigSet(analysis) {
  for (const g of gitsOf(analysis)) {
    const keys = configKeys(g);
    if (keys.some((k) => k.startsWith("alias.") || /^remote\..*\.(?:push|mirror|pushurl)$/.test(k) || k === "push.default" || k === "push.followtags")) return true;
    if (g.verb === "config" && g.args.some((a) => /^(?:alias\.|remote\..*\.(?:push|mirror|pushurl)$|push\.(?:default|followtags)$)/i.test(a))) {
      if (g.args.some((a) => /^--(?:get|get-all|get-regexp|list|show-origin|show-scope)$/.test(a) || a === "-l")) continue;
      return true;
    }
  }
  return false;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rawSession(analysis) {
  if (analysis.units.some((u) => /(?:^|[\s/@])claude(?:-code)?\b[^;&|\n]*\s--cloud\b/.test(flatten(u)))) return true;
  for (const cmd of analysis.cmds) {
    if (cmd.name !== "claude") continue;
    const args = cmd.args;
    if (args.some((a) => a === "--cloud" || a.startsWith("--cloud="))) return true;
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      const value = a === "--resume" || a === "-r" ? args[k + 1] : a.startsWith("--resume=") ? a.slice(9) : undefined;
      if (value !== undefined && !value.startsWith("-") && !UUID.test(value)) return true;
    }
    if (args.some((a) => /^--(?:bg|background)(?:=|$)/.test(a)) && existsSync(join(MAIN_CHECKOUT, "scripts/factory/local.py"))) return true;
  }
  return false;
}

const LEDGER_TOOL = /scripts(?:\.|\/)ledger(?:\.py)?\b/;
const SCANNER = (cmd) => /^python[0-9.]*$/.test(cmd.name) && cmd.args[0] === "-m" && cmd.args[1] === "tools.leakscan";

/**
 * How a simple command runs the scanner: null when it does not, "exact" for `[uv run [--no-sync]]
 * python[3] -m tools.leakscan <command> …` with nothing else in front, "other" for any other way to reach it
 * (`-mtools.leakscan`, `tools.leakscan.__main__`, a script path, PYTHONPATH or a uv project), which could
 * run a different scanner or a corpus of the caller's choosing.
 */
function scannerRun(cmd) {
  const all = words(cmd.raw ?? "");
  const mention = all.some(
    (w, k) =>
      /^-m\s*(?:\S*[./])?leakscan\b/.test(w) ||
      (all[k - 1] === "-m" && /(?:^|[./])leakscan(?:$|[./])/.test(w)) ||
      (/^(?:\.\/)?tools\/leakscan\/\S*\.py$/.test(w) && k > 0 && /python|pypy|^uv$/.test(basename(all[k - 1]))),
  );
  if (!mention) return null;
  const prefix = all.slice(0, all.length - cmd.words.length).join(" ");
  const exact =
    cmd.assigns.length === 0 &&
    /^python3?(?:\.[0-9]+)?$/.test(cmd.name) &&
    cmd.words[0] === cmd.name &&
    cmd.args[0] === "-m" &&
    cmd.args[1] === "tools.leakscan" &&
    ["", "uv run", "uv run --no-sync"].includes(prefix);
  return exact ? "exact" : "other";
}

/** True when a scanner run writes a stamp, the corpus or the allowlist (not `--no-stamp` scans or reads). */
const scannerWrites = (cmd) =>
  cmd.args[2] === "build" || (["range", "file", "text"].includes(cmd.args[2]) && !cmd.args.includes("--no-stamp"));

/** A forged stamp, ledger record or corpus: naming them other than through their own tools (spec 3.6, 3.7). */
function recordForged(analysis, command) {
  const flat = flatten(command).replace(/\/(?:\.\/)+/g, "/").replace(/\/{2,}/g, "/");
  if (/\b(?:VEXTRUS_LEAKSCAN_HOME|VEXTRUS_LEAKSCAN_ALLOWLIST|VEXTRUS_MAIN_CHECKOUT)\s*=/.test(flat)) return true;
  if (!orchestrators && analysis.units.some((u) => /scripts(?:\.|\/)ledger(?:\.py)?\b[^;&|\n]*\brecord\b/.test(flatten(u)))) return true;
  if (analysis.codes.some((code) => /leakscan/.test(code))) return true;
  const scannerOnly = analysis.cmds.length === 1 && SCANNER(analysis.cmds[0]) && !/[<>]/.test(command);
  for (const cmd of analysis.cmds) {
    const run = scannerRun(cmd);
    if (run === "other") return true;
    if (run !== "exact") continue;
    if (cmd.args[2] === "build" && cmd.args.slice(3).some((a) => /^--s/.test(a))) return true;
    // A stamp or a corpus is written only by the main checkout's own scanner, from the orchestrator's
    // session: a worktree's scanner is that branch's code.
    if (scannerWrites(cmd) && !(orchestrators && cmd.cwd === MAIN_CHECKOUT)) return true;
  }
  if (/leakscan\/(?:ok|corpus)(?:\/|\b|$)|work\/leakscan(?:\/|\b|$)/.test(flat) && !scannerOnly) return true;
  const home = LEAK_HOME.replace(/\/+$/, "");
  if (home !== "" && flat.includes(home) && !scannerOnly) return true;
  for (const cmd of analysis.cmds) {
    if ((cmd.name === "cd" || cmd.name === "pushd") && cmd.cwd !== null) {
      const target = cdTarget(cmd, cmd.cwd);
      if (target !== null && (target === home || target.startsWith(`${home}/`) || /\/leakscan(?:\/|$)/.test(target))) return true;
    }
  }
  // The ledger folder: only scripts.ledger writes it.
  if (/factory\/ledger(?:\/|\b)/.test(flat) && !LEDGER_TOOL.test(flat)) {
    if (/>|\b(?:tee|cp|mv|ln|install|rsync|dd|touch|truncate|rm|sed|perl|python[0-9.]*|node)\b/.test(flat)) return true;
  }
  return false;
}

const TEST_RUNNERS = new Set(["npm", "npx", "pnpm", "pnpx", "yarn", "vitest", "jest", "bun", "bunx", "playwright", "node", "deno", "pytest", "tox", "nox", "make"]);
const REVIEW_FOLDER = /\.private\/work\/factory\/review(?:\/|$)/;

/** A test run (or any package script) inside a review folder, where a PR's code would run unreviewed. */
function reviewRun(analysis, eventCwd) {
  for (const cmd of analysis.cmds) {
    if (!TEST_RUNNERS.has(cmd.name) && !/^python[0-9.]*$/.test(cmd.name) && !SHELLS.has(cmd.name)) continue;
    const where = cmd.cwd ?? eventCwd ?? "";
    if (REVIEW_FOLDER.test(`${where}/`)) return true;
    if (cmd.args.some((a, k) => REVIEW_FOLDER.test(`${a}/`) || ((cmd.args[k - 1] === "--prefix" || cmd.args[k - 1] === "-C" || cmd.args[k - 1] === "--cwd" || cmd.args[k - 1] === "--dir") && REVIEW_FOLDER.test(`${resolve(where || "/", a)}/`)))) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ GitHub

/** True when curl, wget or httpie writes to GitHub's API (a body the guard cannot see). */
function webGitHubWrite(analysis) {
  for (const cmd of analysis.cmds) {
    if (!["curl", "wget", "http", "https", "xh", "httpie"].includes(cmd.name)) continue;
    if (!cmd.args.some((a) => /github(?:usercontent)?\.com/i.test(a))) continue;
    if (cmd.args.some((a, k) => /^(?:-d|--data(?:-\w+)?|-F|--form|-T|--upload-file|--json|--post-data|--post-file|--body-data|--body-file)(?:=|$)/.test(a) || /^-[dFT]./.test(a) || ((a === "-X" || a === "--request" || a === "--method") && !/^(?:GET|HEAD)$/i.test(cmd.args[k + 1] ?? "")) || /^-X(?!GET|HEAD)./i.test(a) || /^(?:POST|PUT|PATCH|DELETE)$/.test(a) || /:=|[^=:]=[^=]/.test(a) && cmd.name !== "curl" && cmd.name !== "wget")) return true;
  }
  return false;
}

const GH_READS = new Set(["view", "list", "status", "diff", "checks", "watch", "download"]);
const GH_BODY_LIMIT = 72;

/** `{group, action, args}` of a gh invocation, or null. */
function ghOf(cmd) {
  if (cmd.name !== "gh") return null;
  const positional = cmd.args.filter((a) => !a.startsWith("-"));
  return { group: positional[0] ?? "", action: positional[1] ?? "", args: cmd.args };
}

/** True when a cloud session would write to GitHub (spec 3.6 "GitHub writes"). */
function cloudGitHubWrite(analysis) {
  for (const cmd of analysis.cmds) {
    const gh = ghOf(cmd);
    if (gh === null) continue;
    if (gh.group === "api") {
      const write = gh.args.some((a, k) => /^(?:-f|-F|--field|--raw-field|--input)(?:=|$)/.test(a) || /^-[fF]./.test(a) || ((a === "-X" || a === "--method") && !/^get$/i.test(gh.args[k + 1] ?? "")) || /^(?:-X|--method=)(?!GET)/i.test(a) && a !== "-X" && a !== "--method");
      if (write || gh.args.some((a) => /comments/i.test(a))) return true;
      continue;
    }
    if (["auth", "search", "browse", "status", "help", "version", "completion"].includes(gh.group)) continue;
    if (!GH_READS.has(gh.action)) return true;
  }
  return false;
}

/** True when a gh invocation writes to GitHub (any pr/issue/release/gist action but a read, or an api write). */
function ghWrites(cmd) {
  const gh = ghOf(cmd);
  if (gh === null) return false;
  if (gh.group === "api") return gh.args.some((a, k) => /^(?:-f|-F|--field|--raw-field|--input)(?:=|$)/.test(a) || /^-[fF]./.test(a) || ((a === "-X" || a === "--method") && !/^get$/i.test(gh.args[k + 1] ?? "")) || (/^(?:-X|--method=)./.test(a) && !/^(?:-X|--method=)GET$/i.test(a)));
  return ["pr", "issue", "release", "gist", "label", "repo"].includes(gh.group) && gh.action !== "" && !GH_READS.has(gh.action);
}

/** Inline bodies and body files of a gh write: `{inline: [text], files: [path]}`. */
function ghBodies(cmd) {
  const gh = ghOf(cmd);
  const inline = [];
  const files = [];
  if (gh === null) return { inline, files };
  const a = gh.args;
  if (gh.group === "api") {
    for (let k = 0; k < a.length; k++) {
      const w = a[k];
      let field = null;
      if (/^(?:-f|-F|--field|--raw-field)$/.test(w)) field = a[++k] ?? "";
      else if (/^(?:--field|--raw-field)=/.test(w)) field = w.slice(w.indexOf("=") + 1);
      else if (/^-[fF]./.test(w)) field = w.slice(2);
      else if (w === "--input") files.push(a[++k] ?? "-");
      else if (w.startsWith("--input=")) files.push(w.slice(8));
      if (field === null) continue;
      const eq = field.indexOf("=");
      const key = eq < 0 ? field : field.slice(0, eq);
      const value = eq < 0 ? "" : field.slice(eq + 1);
      if (value.startsWith("@")) files.push(value.slice(1));
      else if (key === "query" && !/\bmutation\b/.test(value)) continue;
      else inline.push(value);
    }
    return { inline, files };
  }
  if (gh.group === "gist" && gh.action !== "" && !GH_READS.has(gh.action)) {
    inline.push("x".repeat(GH_BODY_LIMIT + 1));
    return { inline, files };
  }
  if (!["pr", "issue", "release"].includes(gh.group) || GH_READS.has(gh.action)) return { inline, files };
  const valued = gh.group === "release" ? ["--notes", "-n"] : ["--body", "-b", ...(gh.action === "close" || gh.action === "reopen" ? ["--comment", "-c"] : [])];
  const fileOptions = gh.group === "release" ? ["--notes-file", "-F"] : ["--body-file", "-F"];
  for (let k = 0; k < a.length; k++) {
    const w = a[k];
    const eq = w.indexOf("=");
    const key = w.startsWith("--") && eq > 0 ? w.slice(0, eq) : w;
    const value = w.startsWith("--") && eq > 0 ? w.slice(eq + 1) : null;
    if (valued.includes(key)) inline.push(value ?? a[++k] ?? "");
    else if (fileOptions.includes(key)) files.push(value ?? a[++k] ?? "-");
    else if (/^-[bcn]./.test(w) && valued.includes(w.slice(0, 2))) inline.push(w.slice(2));
    else if (/^-F./.test(w)) files.push(w.slice(2));
  }
  return { inline, files };
}

// ------------------------------------------------------------------------------------------------ the rules

// The only commands an agent may run as the key user (ADR 0041; scripts/owner/autonomy-setup.sh installs the
// matching password-free rules): the poster, with a run id or a design-gate verdict by item number, and the
// scorer, with one run id only. Each is matched against the whole command, so an appended `; cat …`,
// `$(…)` or redirect never matches; the programs (and sudoers, for the scorer) check the arguments again.
// Only the orchestrator's session, whose project is the main checkout, may run them: a builder's session
// (a worktree under .claude/worktrees/, or a cloud copy) never posts its own gate. Within one Unix user
// this is a tripwire, not a wall (ADR 0041).
// The demo seed's own synthetic drawings (vextrus/seed/kr01.py, written by the repo's writer; the owner's
// ruling, session 11: "Allow that path only"): exactly these, by name, and nothing under .private/.
const AS_KEY_USER = String.raw`^sudo -n -u vxkeys `;
// One plain argument (a run id, a PR number or a branch name): a letter or digit first, so never an option
// (issue #107); the sudoers rule autonomy-setup.sh installs for the scorer is this same pattern.
const ONE_ARGUMENT = String.raw`[0-9A-Za-z][0-9A-Za-z-]*`;
const KEY_USER_COMMANDS = [
  new RegExp(
    AS_KEY_USER +
      String.raw`/usr/local/lib/vextrus/post-status (?:-h|--help|real-drawings ${ONE_ARGUMENT}|design-gate [0-9]+ [0-9a-f]{40}(?: --(?:passed|failed|not-applicable)[ =][0-9,-]+)*)$`,
  ),
  new RegExp(AS_KEY_USER + String.raw`/usr/local/bin/vx-score ${ONE_ARGUMENT}$`),
];

const GIT = String.raw`^(?:[A-Z_]+=\S*\s+)*git\s+(?:-C\s+\S+\s+)?`;
const gitVerb = (verb) => new RegExp(`${GIT}${verb}\\b(.*)$`);
const args = (rest) => (rest ?? "").split(/\s+/).filter((arg) => arg !== "");

const STAGE_ALL_ARGS = ["-A", "--all", ".", "./", ":/", "*", "--no-ignore-removal", ":(top)", ":/*"];

/** Each rule: `{rule, fires(parts, command, ctx), reason, closed?}`; a `closed` rule's error refuses. */
const BASH_RULES = [
  {
    rule: "SECRET_PRINTED",
    fires: (parts, _command, ctx) => parts.some(secretPrint) || secretTouched(ctx.analysis),
    reason:
      'This would print, copy or read a secret. Secret files (~/.pgpass, ~/.bashrc and the other shell profiles, ~/.config/gh, ~/.claude/.credentials.json) are never named by a command, and TYPESAFE_API_KEY and every *_KEY/TOKEN/SECRET/PASSWORD are never printed, written or committed. Test presence with `[ -n "$TYPESAFE_API_KEY" ] && echo set`.',
  },
  {
    rule: "STAGE_ALL",
    fires: (parts, _command, ctx) =>
      parts.some((part) => {
        const add = gitVerb("add").exec(part);
        if (add && args(add[1]).some((a) => ["-A", "--all", ".", ":/", "*", "--no-ignore-removal"].includes(a))) return true;
        const commit = gitVerb("commit").exec(part);
        return commit !== null && args(commit[1]).some((a) => a === "--all" || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a));
      }) ||
      gitsOf(ctx.analysis).some(
        (g) =>
          ((g.verb === "add" || g.verb === "stage") && g.args.some((a) => STAGE_ALL_ARGS.includes(a) || /^-[a-zA-Z]*A/.test(a) && !a.startsWith("--"))) ||
          (g.verb === "commit" && g.args.some((a) => a === "--all" || (/^-[a-zA-Z]*a[a-zA-Z]*$/.test(a) && !a.startsWith("--")))),
      ),
    reason: "Stage explicit paths (`git add <file> …`). The owner's untracked files and .private/ never enter a commit.",
  },
  {
    rule: "PRIVATE_STAGED",
    fires: (parts, _command, ctx) =>
      parts.some((part) => {
        const add = gitVerb("add").exec(part);
        return (
          add !== null &&
          args(add[1]).some(
            (a) =>
              a === "-f" ||
              a === "--force" ||
              a.includes(".private") ||
              (/\.(dwg|dxf|rvt|ifc)$/i.test(a) && !SEED_DRAWING.test(a)),
          )
        );
      }) ||
      gitsOf(ctx.analysis).some(
        (g) =>
          (g.verb === "add" || g.verb === "stage") &&
          g.args.some((a) => a === "-f" || a === "--force" || (/^-[a-zA-Z]*f/.test(a) && !a.startsWith("--")) || a.includes(".private") || (DRAWING.test(a) && !SEED_DRAWING.test(a))),
      ),
    reason:
      "Real drawings (the Edison set, the Sample Project, client sets) and everything derived from them live in .private/ and never enter git. A forced add of an ignored path is refused for the same reason.",
  },
  {
    rule: "STAGE_DIR",
    fires: (_parts, _command, ctx) => gitsOf(ctx.analysis).some(stagesFolder),
    reason:
      "Stage files by name: a whole folder that holds (or could hold) drawings, such as vextrus/seed/ or vextrus/seed/recorded/, and agent memory (.claude/agent-memory*/) are never staged.",
  },
  {
    rule: "GIT_CLEAN",
    fires: (parts, _command, ctx) => parts.some((part) => gitVerb("clean").test(part)) || gitsOf(ctx.analysis).some((g) => g.verb === "clean"),
    reason: "`git clean` deletes untracked files, the owner's own files and .private/ among them. Remove the files you made by name.",
  },
  {
    rule: "RECURSIVE_DELETE",
    fires: (parts, _command, ctx) =>
      parts.some((part) => /(?:^|\s)rm\s+(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)(?:\s|$)/.test(part) || /(?:^|\s)rm\s+.*\s-[a-zA-Z]*[rR]/.test(part)) ||
      recursiveDelete(ctx.analysis),
    reason: "A recursive delete is refused in every spelling (`rm -r`, `find -delete`, `shutil.rmtree`, `rmSync(…recursive…)`; CLAUDE.md, the Permissions law). Delete the files you made by name, or leave build output in place and say so.",
  },
  {
    rule: "SELF_MATCHING_WAIT",
    fires: (_parts, _command, ctx) => selfMatchingWait(ctx.analysis),
    reason:
      "A `while`/`until` loop on `pgrep -f` or `ps … | grep` matches its own command line and never ends. Wait with the Monitor tool on a log file the job writes (or an until-loop on a file the job creates).",
  },
  {
    rule: "HISTORY_REWRITTEN",
    fires: (parts, _command, ctx) =>
      parts.some((part) => /\s(?:--force|-f|--force-with-lease)\b/.test(part) && gitVerb("push").test(part)) ||
      parts.some((part) => gitVerb("(?:filter-branch|filter-repo)").test(part)) ||
      gitsOf(ctx.analysis).some((g) => {
        if (["filter-branch", "filter-repo", "replace"].includes(g.verb)) return true;
        if (!isPush(g)) return false;
        const { flags, refspecs } = pushOf(g);
        const rewrite = ["--force", "-f", "--force-with-lease", "--force-if-includes", "--delete", "-d", "--mirror", "--prune", "--prune-tags"];
        return rewrite.some((flag) => flags.has(flag)) || refspecs.some((r) => r.startsWith("+") || r.startsWith(":") || r === "");
      }),
    reason: "History is append-only: no forced push, no deleted remote branch, no mirror push and no history rewrite. A wrong commit is corrected by the next commit.",
  },
  {
    rule: "HOOKS_SKIPPED",
    fires: (parts, _command, ctx) =>
      parts.some((part) => /^(?:[A-Z_]+=\S*\s+)*git\s/.test(part) && /\s--no-verify\b/.test(part)) ||
      gitsOf(ctx.analysis).some((g) => g.args.includes("--no-verify") || g.args.some((a) => /^--no-veri/.test(a)) || ((g.verb === "commit" || g.verb === "merge") && g.args.some((a) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a) && g.verb === "commit"))),
    reason: "`--no-verify` skips the checks a commit or push is owed. Fix what they refuse instead.",
  },
  {
    rule: "HOOKS_PATH",
    fires: (_parts, command, ctx) => hooksPathSet(ctx.analysis, command),
    reason:
      "`core.hooksPath` is set once, by the orchestrator in the main checkout, to `scripts/git-hooks` (the pre-push leak scan), and never pointed anywhere else, through `-c`, `git config` or GIT_CONFIG_* variables.",
  },
  {
    rule: "GIT_CONFIG",
    fires: (_parts, _command, ctx) => pushConfigSet(ctx.analysis),
    reason:
      "Git aliases and remote push settings (alias.*, remote.*.push, remote.*.mirror, push.default) change what a command or a push really does, so the guard would judge the wrong act. Run the git command itself.",
  },
  {
    rule: "DISCARD",
    fires: (_parts, _command, ctx) => gitsOf(ctx.analysis).some(discards),
    reason:
      "This discards work (`reset --hard`, `checkout -- <folder>`, `restore <folder>`, `branch -D`, `worktree remove --force`, `stash drop|clear`). Commit or stash it, restore single files by name, or ask the owner, who decides what is thrown away.",
  },
  {
    rule: "STATUS_POSTED",
    // The commit-status and check-run endpoints anywhere in the command, whatever runs it (a variable-split
    // `gh api`, a `curl` POST), after dropping quotes, backslashes and line continuations (s02 review R3). A
    // tripwire, not a wall: a path built in pieces at run time still passes; the status's author is what
    // holds. Merging is allowed (ADR 0041): the ruleset's required statuses are what a merge waits on.
    fires: (_parts, command) => /\/(?:statuses|check-runs)/i.test(flatten(command)),
    reason: "Commit statuses are posted only through the owner's GitHub App, by `post-status` run as the key user (ADRs 0030, 0041), and by main's not-applicable workflow; never through the API. Post a gate with the exact post-status command the orchestrate-wave skill gives.",
  },
  {
    rule: "PRIVILEGE_RAISED",
    // Anywhere in the command, not only at its start: `bash -c "sudo …"` is the same act. The one exception
    // is a whole command that is exactly the poster or the scorer run as the key user, non-interactively,
    // with plain arguments (ADR 0041): nothing before or after it, no shell metacharacter anywhere.
    fires: (parts, command) =>
      // Only bash's own separators (space, tab, newline) are trimmed: String.trim() also drops CR, NBSP
      // and the BOM, which bash keeps inside the argument (issue #107's refuter).
      !(orchestrators && KEY_USER_COMMANDS.some((allowed) => allowed.test(command.replace(/^[ \t\n]+|[ \t\n]+$/g, "")))) &&
      parts.some((part) => /(?:^|[\s"'`(=$])(?:sudo|su|doas|pkexec|(?:\S*\/)?wsl(?:\.exe)?)(?=\s|$|["'`;)])|vxkeys|vx-score/.test(part)),
    reason: "Agent sessions never raise privilege or name the key user, except the orchestrator's session (the main checkout) running exactly `post-status` or the scorer as the key user with `-n` (ADR 0041); a builder never posts its own gate. Answer Keys and the App's key stay with the key user (ADR 0026). If something needs root, say what and the owner runs it with `! <command>`.",
  },
  {
    rule: "RULESET_CHANGED",
    // The ruleset is what a merge waits on (ADR 0041), and the owner's token is an admin's: deleting or
    // editing it, branch protection, or an admin merge would skip every required status. Reads pass.
    fires: (parts, command) => {
      const flat = flatten(command);
      const write = /(?:-X|--method)[\s=]*(?:DELETE|PUT|POST|PATCH)\b|\s(?:-f|-F|--field|--raw-field|--input)[\s=]/i;
      return (
        (/\/(?:rulesets|protection)\b/i.test(flat) && write.test(flat)) ||
        /mutation[\s\S]*(?:Ruleset|BranchProtection)/i.test(flat) ||
        parts.some((part) => /^(?:[A-Z_]+=\S*\s+)*gh\s+pr\s+merge\b/.test(part) && /\s--admin\b/.test(part))
      );
    },
    reason: "The ruleset and branch protection are the owner's, and an admin merge skips the required checks (ADR 0041). Merge only with `gh pr merge <PR> --merge` once `uv run python -m scripts.merge_ready <PR>` passes.",
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
  {
    rule: "RAW_SESSION",
    fires: (_parts, _command, ctx) => rawSession(ctx.analysis),
    reason:
      "Sessions start only through the launcher, which leak-scans every prompt: use `uv run python -m scripts.factory.launch` (no raw `claude --cloud`, and no raw `--bg` once the local launcher exists). Resume a session by its full UUID.",
  },
  {
    rule: "RECORD_FORGED",
    fires: (_parts, command, ctx) => recordForged(ctx.analysis, command),
    reason:
      "Leak stamps, the leak corpus and ledger records are written only by their own tools: `uv run python -m tools.leakscan …` (never with --source, never with VEXTRUS_LEAKSCAN_* set) and, from the main checkout only, `uv run python -m scripts.ledger record …`. Nothing else names .private/work/leakscan/.",
  },
  {
    rule: "REVIEW_CODE_RUN",
    fires: (_parts, _command, ctx) => reviewRun(ctx.analysis, ctx.cwd),
    reason: "A review folder (.private/work/factory/review/) holds a PR's unmerged code: its tests and package scripts are never run there. Read it; run tests in your own worktree.",
  },
  {
    rule: "CLOUD_GH",
    fires: (_parts, _command, ctx) => cloud && (cloudGitHubWrite(ctx.analysis) || webGitHubWrite(ctx.analysis)),
    reason: "A cloud session writes nothing to GitHub but its own branch: no PR, issue, comment or review, and no `gh api` write. The orchestrator posts what is needed.",
  },
  {
    rule: "GH_BODY",
    closed: true,
    fires: (_parts, _command, ctx) => {
      // (_command is read when the reader could not follow the command.)
      if (ctx.analysis.truncated && /\bgh\b[\s\S]*(?:--body|\s-[bF]\b|--notes|\bapi\b)|\bcurl\b[\s\S]*github/.test(flatten(_command))) return { rule: "GH_BODY", reason: "This command is too nested to judge; run the GitHub write alone, with a scanned --body-file." };
      if (webGitHubWrite(ctx.analysis)) return { rule: "GH_BODY", reason: "A write to GitHub's API through curl or wget is not judged: use `gh` with a scanned `--body-file`." };
      for (const cmd of ctx.analysis.cmds) {
        const { inline, files } = ghBodies(cmd);
        if ((inline.length > 0 || files.length > 0 || ghWrites(cmd)) && cmd.words.slice(1).some((w) => /[$`]/.test(w))) return { rule: "GH_BODY", reason: "A GitHub write whose words are expanded at run time cannot be judged: spell every argument out." };
        if (inline.some((text) => text.length > GH_BODY_LIMIT || /\$|`/.test(text))) return { rule: "GH_BODY" };
        if (files.length > 0 && !alone(ctx.analysis, cmd)) return { rule: "GH_BODY", reason: "Run a `gh … --body-file` write alone in its call: the guard checks the file before the command runs, so nothing may change it in the same call." };
        for (const file of files) {
          if (file === "-" || file === "/dev/stdin" || file === "") return { rule: "GH_BODY" };
          const where = cmd.cwd ?? ctx.cwd;
          if (where === null) throw new GuardError("the body file's folder cannot be known");
          let bytes;
          try {
            bytes = readFileSync(resolve(where, file));
          } catch {
            return { rule: "LEAK_STAMP", reason: `the body file ${file} cannot be read, so its stamp cannot be checked.` };
          }
          const problem = stampProblem(sha256(bytes));
          if (problem !== null) return { rule: "LEAK_STAMP", reason: `${problem}. Scan the body first: \`uv run python -m tools.leakscan file ${file}\`, then write it unchanged.` };
        }
      }
      return false;
    },
    reason:
      "A GitHub body longer than a short title (72 characters) is never written inline: write it to a file, scan it with `uv run python -m tools.leakscan file <f>` (which stamps it), then pass `--body-file <f>`.",
  },
  {
    rule: "PUSH",
    closed: true,
    fires: (_parts, command, ctx) => {
      const flat = flatten(command);
      const dynamic =
        ctx.analysis.cmds.some(
          (cmd) =>
            /[$`]/.test(cmd.words[0] ?? "") ||
            cmd.name === "xargs" ||
            (cmd.name === "git" && /^$|[$`]/.test(gitOf(cmd).verb)) ||
            (cmd.name === "git" && gitOf(cmd).verb === "push" && cmd.words.slice(1).some((w) => /[$`]/.test(w))) ||
            readsCommands(cmd, flat),
        ) || ctx.analysis.codes.some((code) => /\bgit\b/.test(code) && /(?<![.\w$])push\b/.test(code));
      // A push needs git somewhere in the text (`G=git; $G push`, `["git","push"]`); a word "push" alone
      // (`a.push(x)`, `print('push')`) is not one.
      if ((dynamic || ctx.analysis.truncated) && /(?<![.\w$])push\b/.test(flat) && /\bgit\b|send-pack/.test(flat)) {
        const rule = orchestrators ? "LEAK_STAMP" : cloud ? "CLOUD_PUSH" : "LOCAL_PUSH";
        return { rule, reason: `A push whose command is built at run time cannot be judged. ${PUSH_REASONS[rule]}` };
      }
      for (const cmd of ctx.analysis.cmds) {
        const g = gitOf(cmd);
        if (g === null || (!isPush(g) && g.verb !== "send-pack")) continue;
        if ((orchestrators || cloud) && !alone(ctx.analysis, cmd)) {
          const rule = orchestrators ? "LEAK_STAMP" : "READY_UNVERIFIED";
          return { rule, reason: `Run a push alone in its call: the guard judges the head before the command runs, so a commit or checkout in the same call would push what was never judged. ${PUSH_REASONS[rule]}` };
        }
        const verdict = judgePush(g);
        if (verdict !== null) return verdict;
      }
      return false;
    },
    reason: "",
  },
];

// A judged write must stand alone: the guard sees the repository and the files before the command runs, so
// `git commit --amend … && git push` or `echo … >> body.md && gh … --body-file body.md` would send what was
// never judged. Only these read-only filters (and a cd, which the guard follows) may share its call.
const READ_ONLY_FILTERS = new Set(["cd", "tail", "head", "cat", "grep", "wc", "sort", "uniq", "true", "echo"]);
/** True when a simple command writes a file through a redirect (`> f`, `>> f`; not `2>&1` or /dev/null). */
const redirects = (raw) => /(?:^|[^<>&0-9])[0-9]*>{1,2}\|?\s*(?!&|\/dev\/null\b)\S/.test(raw.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''"));
const alone = (analysis, judged) =>
  !analysis.truncated && analysis.cmds.every((cmd) => cmd === judged || (READ_ONLY_FILTERS.has(cmd.name) && !redirects(cmd.raw)));

/**
 * True when a shell or an interpreter takes its commands from somewhere the guard does not read whole:
 * standard input, a here-string, a process substitution, `source`/`.`, or a script the same command writes.
 */
function readsCommands(cmd, flat) {
  const shell = SHELLS.has(cmd.name);
  const interpreter = INTERPRETER.test(cmd.name);
  if (cmd.name === "source" || cmd.name === ".") return true;
  if (!shell && !interpreter) return false;
  if (shell && cmd.args.some((a) => /^-[A-Za-z]*c[A-Za-z]*$/.test(a))) return false;
  if (interpreter && (codeOf(cmd) !== null || cmd.args.includes("-m"))) return false;
  const operands = cmd.args.filter((a) => (!a.startsWith("-") || a === "-") && !/^\d*(?:[<>]&?\d*|>>)$/.test(a));
  if (operands.length === 0 || operands[0] === "-" || operands[0].startsWith("<(") || operands[0].startsWith("<<<") || operands[0] === "/dev/stdin") return true;
  const script = operands[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`>\\s*(?:\\S*/)?${script}(?:[\\s;&|)]|$)`).test(flat);
}

const PUSH_REASONS = {
  LOCAL_PUSH: "A local builder never pushes: commit with explicit paths and finish with the Factory-State trailer; the orchestrator pushes your branch.",
  CLOUD_PUSH: "A cloud session pushes only HEAD (or its current branch) to its own branch on origin: `git push -u origin HEAD`. Never main, another branch, --all or --tags.",
  LEAK_STAMP: "A push from the main checkout needs a valid leak stamp for exactly the pushed head: run `uv run python -m tools.leakscan range <merge-base>..<head> --ref <branch>`, then push that head unchanged.",
  READY_UNVERIFIED: "This head carries `Factory-State: READY`, so it needs a green verify record for its tree (`<git-common-dir>/vextrus/verify-<tree>.json`, every exit code 0): run verify, or finish `Factory-State: BLOCKED` with a reason.",
};

/** The verdict on one push, by who pushes (spec 3.6 "Pushes"). */
function judgePush(g) {
  if (g.verb === "send-pack") return { rule: orchestrators ? "LEAK_STAMP" : cloud ? "CLOUD_PUSH" : "LOCAL_PUSH", reason: "Push with `git push`, which the guard can judge." };
  if (!orchestrators && !cloud) return { rule: "LOCAL_PUSH" };
  const { flags, remote, refspecs, unknown } = pushOf(g);
  if (unknown) {
    const rule = orchestrators ? "LEAK_STAMP" : "CLOUD_PUSH";
    return { rule, reason: `A push option that is ambiguous or unknown cannot be judged: spell options out in full. ${PUSH_REASONS[rule]}` };
  }
  const configured = runGit(g, ["config", "--get-regexp", String.raw`^(remote\..*\.(push|mirror)|push\.(default|followtags))$`]);
  if (configured.status !== 0 && configured.status !== 1) throw new GuardError("git config could not be read");
  const unusual = configured.stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .some((line) => !/^push\.default (?:simple|current)$/i.test(line.trim()));
  if (cloud && !orchestrators) {
    const branch = currentBranch(g);
    const forbidden = (name) => name === "main" || name === "master" || name === "refs/heads/main" || name === "refs/heads/master";
    if (remote !== null && remote !== "origin") return { rule: "CLOUD_PUSH" };
    if (["--all", "--branches", "--tags", "--follow-tags", "--mirror"].some((flag) => flags.has(flag))) return { rule: "CLOUD_PUSH" };
    if (branch === "" || forbidden(branch) || unusual) return { rule: "CLOUD_PUSH" };
    for (const spec of refspecs) {
      const [src, dst, extra] = spec.split(":");
      if (extra !== undefined) return { rule: "CLOUD_PUSH" };
      const own = (name) => name === branch || name === `refs/heads/${branch}`;
      if (!(src === "HEAD" || own(src))) return { rule: "CLOUD_PUSH" };
      if (dst !== undefined && !own(dst)) return { rule: "CLOUD_PUSH" };
    }
    const sha = commitOf(g, "HEAD");
    if (sha === null) throw new GuardError("HEAD does not name a commit");
    const ready = readyProblem(g, sha);
    return ready === null ? null : { rule: "READY_UNVERIFIED", reason: `${ready}. ${PUSH_REASONS.READY_UNVERIFIED}` };
  }
  // The main checkout: every pushed head needs its stamp, and a READY head its verify record.
  if (["--all", "--branches", "--tags", "--follow-tags", "--mirror"].some((flag) => flags.has(flag))) return { rule: "LEAK_STAMP", reason: `Push one ref at a time, each stamped. ${PUSH_REASONS.LEAK_STAMP}` };
  if (unusual) return { rule: "LEAK_STAMP", reason: `This repository has remote push or push.default settings, so the pushed refs cannot be judged. ${PUSH_REASONS.LEAK_STAMP}` };
  if ([...flags].some((flag) => flag === "--recurse-submodules") && !g.args.some((a) => /^--recurse-submodules=(?:no|check)$/.test(a))) return { rule: "LEAK_STAMP", reason: `Submodule commits are not scanned. ${PUSH_REASONS.LEAK_STAMP}` };
  const sources = refspecs.length === 0 ? ["HEAD"] : refspecs.map((spec) => spec.split(":")[0]);
  for (const src of sources) {
    if (src === "" || /[*?[]/.test(src)) return { rule: "LEAK_STAMP", reason: `A wildcard or empty refspec cannot be stamped. ${PUSH_REASONS.LEAK_STAMP}` };
    const sha = commitOf(g, src);
    if (sha === null) return { rule: "LEAK_STAMP", reason: `\`${src}\` names no commit here. ${PUSH_REASONS.LEAK_STAMP}` };
    const object = runGit(g, ["rev-parse", "--verify", "-q", "--end-of-options", src]);
    if (object.status !== 0 || object.stdout.trim() !== sha) return { rule: "LEAK_STAMP", reason: `\`${src}\` is a tag (or another object), whose message no scan covers: push branches. ${PUSH_REASONS.LEAK_STAMP}` };
    const problem = stampProblem(sha, g);
    if (problem !== null) return { rule: "LEAK_STAMP", reason: `${problem}. ${PUSH_REASONS.LEAK_STAMP}` };
    const ready = readyProblem(g, sha);
    if (ready !== null) return { rule: "READY_UNVERIFIED", reason: `${ready}. ${PUSH_REASONS.READY_UNVERIFIED}` };
  }
  return null;
}

const FILE_RULES = [
  {
    rule: "REFERENCE_EDITED",
    fires: (relative) => relative.startsWith(".private/reference/"),
    reason: "The owner's reference drawings are read-only originals. Convert and annotate into .private/work/ instead.",
  },
  {
    rule: "RECORD_FORGED",
    fires: (_relative, absolutes) =>
      absolutes.some((path) => /\/\.private\/work\/(?:leakscan|factory\/ledger)(?:\/|$)/.test(path) || path === LEAK_HOME || path.startsWith(`${LEAK_HOME}/`)),
    reason: "Leak stamps, the leak corpus and ledger records are written only by `python -m tools.leakscan` and `scripts.ledger`, never by an edit.",
  },
  {
    rule: "HOOKS_PATH",
    fires: (_relative, absolutes) => absolutes.some((path) => /\/\.git(?:\/|$)/.test(path)),
    reason: "Git's own folder (its config, hooks and refs) is never edited by hand: `core.hooksPath` is set once by the orchestrator, and refs move only through git.",
  },
];

/** The absolute forms of a file tool's path: as given, against the project, and through symlinks. */
function absolutesOf(path, cwd) {
  const forms = new Set();
  for (const base of [root, cwd].filter((b) => typeof b === "string" && b !== "")) forms.add(resolve(base, path));
  for (const form of [...forms]) {
    for (let probe = form, rest = ""; probe !== dirname(probe); rest = `/${basename(probe)}${rest}`, probe = dirname(probe)) {
      try {
        forms.add(realpathSync(probe) + rest);
        break;
      } catch {
        // not there yet: try its folder
      }
    }
  }
  return [...forms].map((p) => p.split("\\").join("/"));
}

function judge(tool, input, eventCwd) {
  if (tool === "Bash") {
    const command = typeof input.command === "string" ? input.command : "";
    const parts = segments(command);
    // A command the reader cannot follow keeps the text-only rules and counts as unjudgeable: the push and
    // GitHub-body rules refuse it (they fail closed).
    let analysis = { cmds: [], codes: [], units: [command], truncated: true };
    try {
      analysis = analyse(command, eventCwd);
    } catch {
      analysis.truncated = true;
    }
    const ctx = { analysis, cwd: eventCwd };
    for (const { rule, fires, reason, closed } of BASH_RULES) {
      let result;
      try {
        result = fires(parts, command, ctx);
      } catch (error) {
        if (!closed) continue;
        const why = error instanceof GuardError ? error.message : "an unexpected error";
        return { rule: "GUARD_ERROR", reason: `could not check this ${rule === "PUSH" ? "push" : "GitHub write"} (${why}), so it is refused. Run it from the repository's own folder, or say what you need.` };
      }
      if (result === true) return { rule, reason };
      if (result && typeof result === "object") {
        const name = result.rule ?? rule;
        return { rule: name, reason: result.reason ?? PUSH_REASONS[name] ?? reason };
      }
    }
    return null;
  }
  if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit" || tool === "MultiEdit") {
    const paths = [input.file_path, input.notebook_path].filter((p) => typeof p === "string" && p !== "");
    for (const path of paths) {
      const base = root.endsWith("/") ? root : `${root}/`;
      const rel = path.startsWith(base) ? path.slice(base.length) : path;
      let absolutes = [];
      try {
        absolutes = absolutesOf(path, eventCwd);
      } catch {
        absolutes = [resolve(root, path)];
      }
      for (const { rule, fires, reason } of FILE_RULES) if (fires(rel, absolutes)) return { rule, reason };
    }
  }
  return null;
}

let event;
try {
  event = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
let verdict = null;
try {
  const eventCwd = typeof event?.cwd === "string" && event.cwd !== "" ? resolve(root, event.cwd) : root;
  verdict = judge(String(event?.tool_name ?? ""), event?.tool_input ?? {}, eventCwd);
} catch {
  verdict = null;
}
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
