// Ticket f2, A2: secret files and secret variables are refused by any verb, and code strings that print them
// (spec 3.7 row 1, "the guard covers scripts"). Today `.pgpass` and `hosts.yml` are not secret files, only
// reader verbs count, and `python3 -c` / `node -e` code is not read. Run as a builder's worktree.
// The commands are test inputs only; nothing here runs them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mainAndWorktree, ruleOf } from "./_guard.mjs";

const { main, worktree } = mainAndWorktree();
const inWorktree = (command) => ruleOf({ input: { command }, project: worktree, cwd: worktree, main });

const REFUSED = [
  "cat ~/.pgpass",
  "cat /home/riz/.pgpass",
  `python3 -c "print(open('/home/riz/.pgpass').read())"`,
  "cp ~/.bashrc /home/riz/x",
  "base64 ~/.bashrc",
  "cat ~/.config/gh/hosts.yml",
  "cp ~/.config/gh/hosts.yml /home/riz/x",
  "base64 /home/riz/.config/gh/hosts.yml",
  `python3 -c "print(open('/home/riz/.config/gh/hosts.yml').read())"`,
  "ls -l ~/.pgpass",
  "stat ~/.config/gh/hosts.yml",
  "tar czf /home/riz/x.tgz ~/.bashrc",
  "cp $HOME/.pgpass .private/work/x",
  `python3 -c "import os;print(os.environ['TYPESAFE_API_KEY'])"`,
  `node -e "console.log(process.env.GH_TOKEN)"`,
];

for (const command of REFUSED) {
  test(`a secret is refused: ${command}`, () => {
    assert.equal(inWorktree(command), "SECRET_PRINTED");
  });
}

const ALLOWED = [
  `[ -n "$TYPESAFE_API_KEY" ] && echo set`,
  "grep -n pgpass docs/x.md",
  "cat docs/pgpass-notes.md",
  "psql -h 127.0.0.1 -c 'select 1'",
];

for (const command of ALLOWED) {
  test(`ordinary work naming no secret passes: ${command}`, () => {
    assert.equal(inWorktree(command), null);
  });
}
