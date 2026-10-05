// Ticket T-GUARD-A, 3.2: RECORD_FORGED judges the command and its write targets, not the text (ticket 2.2;
// #307). Reading the stamp folder and the ledger, scanning with a value-less uv flag, and text that merely
// names the scanner or the ledger writer (a message, a heredoc body, a grep pattern, an echo) pass. Every
// write to a stamp, a ledger record or the corpus, every other route to the scanner, `--source`, the
// VEXTRUS_LEAKSCAN_* seams, code that spawns or imports the scanner or the ledger writer, a builder's ledger
// record, and printing the corpus's content (it holds strings taken from real drawings; ticket 4(b)(iv), the
// orchestrator's narrowing) stay refused.
// Today the allowed half is refused as RECORD_FORGED.
// Every path is relative to a temporary repository (or names a temporary leak home); nothing real is read.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leakHome, ruleOf, tempRepo } from "./_guard.mjs";

const { repo: main } = tempRepo();
const { repo: worktree } = tempRepo({ branch: "s12-fx-builder" });
// The main checkout's leak home is the guard's default, <main>/.private/work/leakscan.
const inMain = (command) => ruleOf({ input: { command }, project: main, cwd: main, main });
const inWorktree = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });

const STAMP = ".private/work/leakscan/ok/abc123";
const LEDGER = ".private/work/factory/ledger/12-0123abc.json";
const CORPUS = ".private/work/leakscan/corpus";

// ---------------------------------------------------------------- allowed: reads, listings and text

for (const command of [
  // Code whose text names the scanner or the ledger writer, with no spawn or import.
  "python3 - <<EOF\nopen('a','w').write('python -m tools.leakscan')\nEOF",
  "python3 - <<'EOF'\nopen('notes.md','a').write('see tools/leakscan/contract.md')\nEOF",
  `node -e 'console.log("tools/leakscan")'`,
  `python3 -c "print('run python -m tools.leakscan range a..b --no-stamp')"`,
  // A shell heredoc body naming the contract.
  "cat > .private/work/session-12/notes.md <<'EOF'\nread tools/leakscan/contract.md first\nEOF",
  "bash <<'EOF'\necho see tools/leakscan/contract.md\nEOF",
  // STATE lines naming the ledger and the stamp folder, appended outside them.
  'echo "STATE 12:00 ledger .private/work/factory/ledger/12-x.json PASS" >> .private/work/session-12/STATE.md',
  'echo "STATE 12:05 stamp .private/work/leakscan/ok/abc123 written" >> .private/work/session-12/STATE.md',
  "printf 'STATE 12:10 corpus .private/work/leakscan/corpus rebuilt\\n' >> .private/work/session-12/STATE.md",
  // Read-only viewers over the stamp folder and the ledger.
  "ls .private/work/leakscan/",
  "ls .private/work/leakscan/ok/",
  "ls -la .private/work/leakscan/ok 2>/dev/null",
  `cat ${STAMP}`,
  `head -c 200 ${STAMP}`,
  "grep -r x .private/work/leakscan/ok",
  "find .private/work/leakscan -name x",
  "find .private/work/leakscan/ok -type f",
  "ls .private/work/leakscan/ok | head",
  "ls .private/work/factory/ledger 2>/dev/null",
  `cat ${LEDGER} | python3 -m json.tool`,
  `cat ${LEDGER} | jq .verdict`,
  `jq -r .verdict ${LEDGER}`,
  "grep -rn rm .private/work/factory/ledger",
  `head -5 ${LEDGER}`,
  `wc -l ${LEDGER}`,
  `stat ${LEDGER}`,
  "find .private/work/factory/ledger -type f",
  "ls -la .private/work/factory/ledger > /tmp/out.txt",
  "grep -c PASS .private/work/factory/ledger/12-0123abc.json > /tmp/out.txt 2>&1",
  // Metadata viewers on the corpus file.
  `ls -l ${CORPUS}`,
  `wc -l ${CORPUS}`,
  `sha256sum ${CORPUS}`,
  `stat ${CORPUS}`,
  // The scanner with value-less uv flags (scans that write no stamp pass anywhere).
  "uv run --quiet python -m tools.leakscan range a..b --no-stamp",
  "uv run -q python -m tools.leakscan range a..b --no-stamp",
  "uv run --no-sync --quiet python -m tools.leakscan range a..b --no-stamp",
  "uv run --frozen python -m tools.leakscan range a..b --no-stamp",
  "uv run --locked python3 -m tools.leakscan file notes.md --no-stamp",
  "uv run --offline --no-progress python -m tools.leakscan range a..b --no-stamp",
]) {
  test(`a read, a listing or text naming a record passes: ${JSON.stringify(command)}`, () => {
    assert.equal(inMain(command), null, "main");
    assert.equal(inWorktree(command), null, "worktree");
  });
}

test("the main checkout's scanner stamps with value-less uv flags", () => {
  assert.equal(inMain("uv run --quiet python -m tools.leakscan range origin/main..HEAD --ref s12-x"), null);
  assert.equal(inMain("uv run -q python -m tools.leakscan file .private/work/pr-body.md"), null);
});

for (const command of [
  'git commit -m "docs: run python -m scripts.ledger record"',
  'grep -rn "scripts.ledger record" docs',
  "cat > .private/work/notes.md <<'EOF'\nthe orchestrator runs python -m scripts.ledger record --ticket x\nEOF",
  'echo "next: uv run python -m scripts.ledger record" >> .private/work/session-12/STATE.md',
  "python3 - <<'EOF'\nopen('n.md','w').write('python -m scripts.ledger record')\nEOF",
]) {
  test(`text naming the ledger writer passes in a builder's worktree: ${JSON.stringify(command)}`, () => {
    assert.equal(inWorktree(command), null);
  });
}

test("the leak home set by the hook's own environment is listed, not printed", () => {
  const { home } = leakHome();
  const withHome = (command) => ruleOf({ input: { command }, project: main, cwd: main, main, home });
  assert.equal(withHome(`ls ${home}/ok`), null);
  assert.equal(withHome(`sha256sum ${home}/corpus`), null);
  assert.notEqual(withHome(`cat ${home}/corpus`), null);
  assert.notEqual(withHome(`echo x > ${home}/ok/abc123`), null);
  assert.notEqual(withHome(`cp /tmp/s ${home}/corpus`), null);
});

// ---------------------------------------------------------------- refused: the scanner's other routes

for (const command of [
  // guard.test.mjs:469-486 and :613.
  "uv run python -m tools.leakscan build --sou /tmp/empty",
  "uv run python -m tools.leakscan build --s /tmp/empty",
  "uv run python -m tools.leakscan build --sou=/tmp/empty",
  "uv run -m tools.leakscan build --source /tmp/empty",
  "uv run python -mtools.leakscan build --source /tmp/empty",
  "uv run python -m tools.leakscan.__main__ build --source /tmp/empty",
  "PYTHONPATH=/tmp/evil uv run python -m tools.leakscan range a..b",
  "uv run --project /tmp/evil python -m tools.leakscan range a..b",
  "cd tools && PYTHONPATH=.. uv run python -m leakscan build --source /tmp/e",
  // --source in any spelling, behind value-less flags too.
  "uv run python -m tools.leakscan build --source /tmp/x",
  "uv run python -m tools.leakscan build --source=/tmp/x",
  "uv run --quiet python -m tools.leakscan build --source /tmp/x",
  "uv run -q --frozen python -m tools.leakscan build --sour /tmp/x",
  // A value-taking uv flag is another route.
  "uv run --directory /tmp/evil python -m tools.leakscan range a..b --no-stamp",
  "uv run --with evilpkg python -m tools.leakscan range a..b --no-stamp",
  "uv run --python /tmp/evil/python python -m tools.leakscan range a..b --no-stamp",
  "uv run --env-file /tmp/evil.env python -m tools.leakscan range a..b --no-stamp",
  "uv run --index-url https://example.invalid/simple python -m tools.leakscan range a..b --no-stamp",
  "uv run --quiet --project /tmp/evil python -m tools.leakscan range a..b --no-stamp",
  // The seams.
  "VEXTRUS_LEAKSCAN_HOME=/tmp/fake uv run python -m tools.leakscan file f.md",
  "VEXTRUS_LEAKSCAN_HOME=/tmp/fake uv run --quiet python -m tools.leakscan range a..b --no-stamp",
  "export VEXTRUS_LEAKSCAN_HOME=/tmp/fake",
]) {
  test(`another route to the scanner stays refused: ${command}`, () => {
    assert.equal(inMain(command), "RECORD_FORGED", "main");
    assert.equal(inWorktree(command), "RECORD_FORGED", "worktree");
  });
}

for (const command of [
  "uv run python -m tools.leakscan range origin/main..HEAD",
  "uv run --quiet python -m tools.leakscan range origin/main..HEAD",
  "uv run python -m tools.leakscan build",
  "uv run -q python -m tools.leakscan build",
  "uv run --no-sync --quiet python -m tools.leakscan file notes.md",
]) {
  test(`a builder's scanner never stamps or builds: ${command}`, () => {
    assert.equal(inWorktree(command), "RECORD_FORGED");
  });
}

// ---------------------------------------------------------------- refused: writes to a stamp, a record or the corpus

for (const [label, target] of [
  ["a stamp", STAMP],
  ["a ledger record", LEDGER],
  ["the corpus", CORPUS],
]) {
  const folder = target.slice(0, target.lastIndexOf("/"));
  for (const command of [
    `echo x > ${target}`,
    `echo x >> ${target}`,
    `echo x | tee ${target}`,
    `echo x | tee -a ${main}/${target}`,
    `cp /tmp/s ${target}`,
    `mv /tmp/s ${target}`,
    `ln -s /tmp/s ${target}`,
    `touch ${target}`,
    `mkdir -p ${folder}`,
    `sed -i s/a/b/ ${target}`,
    `rm ${target}`,
    `python3 -c "open('${target}','w').write('{}')"`,
    `node -e "require('fs').writeFileSync('${target}', '{}')"`,
    `cat /tmp/s > ${target}`,
    `ls ${folder} > ${folder}/list`,
  ]) {
    test(`a write to ${label} stays refused: ${command}`, () => {
      assert.notEqual(inMain(command), null, "main");
      assert.notEqual(inWorktree(command), null, "worktree");
    });
  }
}

for (const command of [
  "D=.private/work/factory/ledger; echo x > $D/a.json",
  "ls .private/work/factory/ledger | xargs rm",
  "ls .private/work/leakscan/ok | xargs touch",
  "find .private/work/leakscan -exec cp {} /tmp/x \\;",
  "find .private/work/factory/ledger -name x -delete",
  "find .private/work/leakscan/ok -fprint /tmp/list",
  "cd .private/work/factory/ledger && echo x > a.json",
  "cd .private/work/leakscan/ok && touch abc123",
  "ls .private/work/leakscan/ok > $OUT",
  `cat ${LEDGER} | tee /tmp/copy.json`,
  `cat ${STAMP} > ${LEDGER}`,
  `cp ${CORPUS} /tmp/corpus-copy`,
]) {
  test(`an indirect or unjudgeable write near the records stays refused: ${JSON.stringify(command)}`, () => {
    assert.notEqual(inMain(command), null, "main");
    assert.notEqual(inWorktree(command), null, "worktree");
  });
}

for (const tool of ["Edit", "Write"]) {
  for (const path of [`${main}/${STAMP}`, `${main}/${LEDGER}`, `${main}/${CORPUS}`]) {
    test(`${tool} on ${path.slice(main.length + 1)} stays refused as a forged record`, () => {
      const input = { file_path: path, content: "{}", old_string: "a", new_string: "b" };
      assert.equal(ruleOf({ tool, input, project: main, cwd: main, main }), "RECORD_FORGED", "main");
      assert.equal(ruleOf({ tool, input, project: worktree, cwd: worktree, main }), "RECORD_FORGED", "worktree");
    });
  }
}

// ---------------------------------------------------------------- refused: code that runs the scanner or the ledger writer

for (const command of [
  `python3 -c 'import subprocess; subprocess.run(["python","-m","tools.leakscan","build","--source","/tmp/x"])'`,
  `python3 -c 'from tools.leakscan import corpus'`,
  `python3 -c 'import tools.leakscan'`,
  `python3 -c 'import scripts.ledger'`,
  `python3 -c 'import os; os.system("python -m tools.leakscan build")'`,
  `python3 -c 'import os; os.popen("python -m scripts.ledger record")'`,
  `python3 -c '__import__("tools.leakscan")'`,
  `python3 -c 'import runpy; runpy.run_module("tools.leakscan")'`,
  `node -e 'require("child_process").execSync("python -m tools.leakscan build")'`,
  `node -e 'require("child_process").spawnSync("python3", ["-m", "scripts.ledger", "record"])'`,
  "python3 - <<'EOF'\nimport subprocess\nsubprocess.run(['python3', '-m', 'scripts.ledger', 'record'])\nEOF",
  "node --input-type=module <<'EOF'\nimport { execSync } from 'node:child_process';\nexecSync('python -m tools.leakscan range a..b');\nEOF",
  // Code that names a protected folder's path, reading or writing.
  `python3 -c "print(open('${LEDGER}').read())"`,
  `python3 -c "print(open('${CORPUS}').read())"`,
  `node -e "console.log(require('fs').readdirSync('.private/work/leakscan/ok'))"`,
]) {
  test(`code that runs the scanner or the ledger writer, or names a record's path, stays refused: ${JSON.stringify(command)}`, () => {
    assert.equal(inMain(command), "RECORD_FORGED", "main");
    assert.equal(inWorktree(command), "RECORD_FORGED", "worktree");
  });
}

// ---------------------------------------------------------------- the ledger writer: the main checkout only

for (const command of [
  "python -m scripts.ledger record --ticket x --event ready",
  "python3 -m scripts.ledger record --ticket x",
  "python3 scripts/ledger.py record --ticket x",
  "uv run python -m scripts.ledger record --ticket x",
  "uv run --quiet python -m scripts.ledger record --ticket x",
  "uv run --no-sync -q python3 scripts/ledger.py record --ticket x",
  "bash -c 'python -m scripts.ledger record --ticket x'",
  `sh -c "uv run --quiet python -m scripts.ledger record --ticket x"`,
]) {
  test(`a ledger record is refused from a builder and passes in the main checkout: ${command}`, () => {
    assert.equal(inWorktree(command), "RECORD_FORGED");
    assert.equal(inMain(command), null);
  });
}

// ---------------------------------------------------------------- the corpus's content is never printed

for (const command of [
  `cat ${CORPUS}`,
  `head -3 ${CORPUS}`,
  `tail -n 2 ${CORPUS}`,
  `grep ZEBRA ${CORPUS}`,
  `egrep -c 'A|B' ${CORPUS}`,
  `fgrep x ${CORPUS}`,
  `rg x ${CORPUS}`,
  `ugrep x ${CORPUS}`,
  `sort ${CORPUS}`,
  `uniq ${CORPUS}`,
  `less ${CORPUS}`,
  `more ${CORPUS}`,
  `jq -R . ${CORPUS}`,
  `diff ${CORPUS} /tmp/x`,
  `cmp ${CORPUS} /tmp/x`,
  `cat < ${CORPUS}`,
  `python3 -m json.tool ${CORPUS}`,
  `sed -n 1p ${CORPUS}`,
  `awk 1 ${CORPUS}`,
  `base64 ${CORPUS}`,
  `xxd ${CORPUS}`,
  `ls -l ${CORPUS} && cat ${CORPUS}`,
]) {
  test(`the corpus's content stays unprinted: ${command}`, () => {
    assert.notEqual(inMain(command), null, "main");
    assert.notEqual(inMain(command.split(CORPUS).join(`${main}/${CORPUS}`)), null, "main, absolute");
    assert.notEqual(inWorktree(command.split(CORPUS).join(`${main}/${CORPUS}`)), null, "worktree, the main checkout's corpus");
  });
}
