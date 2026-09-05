/**
 * AC-6 of the src/core debt sweep: a comment states what the code does and cites the law it does it
 * under (Q-17, B-17, B-19).
 *
 * Every case here reads TEXT, and says so on the line: a comment that lies is invisible to every
 * call, so there is no behaviour to drive — that is the whole of the defect. The one exception is
 * AC-6(e), where the row's claim ("convention data no code reads") is answered by a call as well as
 * by a sentence. The reads go through src/core/__tests__/support/read-source.ts, this suite's own
 * comment-aware reader, so a Builder explaining a rule in prose is never graded as spelling it
 * twice.
 *
 * Nothing here transcribes the wording a fix must use: each case names the claim that must be gone
 * and the fact that must be stated, and the caller roster AC-6(d) asks for is derived from the tree
 * rather than listed, so a later caller is documented rather than silently unnamed (B-19).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, test } from "vitest";
import { dhakaDateParts } from "../format";
import { REPO_ROOT, commentsOf, sourceOf } from "./support/read-source";

const SEAM_MODULE = "src/core/db.ts";
const REFUSALS_MODULE = "src/core/acts/refusals.ts";
const ASSIGN_MODULE = "src/core/acts/assign-participant-role.ts";
const FORMAT_MODULE = "src/core/format.ts";
const TAXONOMY_SUITE = "src/core/errors/taxonomy.test.ts";
const SESSION_MODULE = "src/server/auth/session.ts";

/** Build-organisation narration, spelled from parts so this file is not itself an instance of it. */
const INCREMENT_ID = /\binc-\d{3}\b/;
const BUILD_NARRATION = ["this", "increment"].join(" ");

/** Where a read path's caller may live; the roster AC-6(d) needs is derived from these, not listed. */
const CALLER_ROOTS = ["src/modules", "src/server", "src/app"];

/** The call shape a read path makes: no act type to name, because a read moves nothing (L-ACT-03). */
const READ_PATH_CALL = "permissionNotHeld(null";

/**
 * The comment block sitting immediately above the first line that matches `declares` — the doc a
 * reader of that declaration actually sees, rather than anything else the file happens to say.
 */
function docAbove(relative: string, declares: RegExp, why: string): string {
  const lines = sourceOf(relative, why).split("\n");
  const at = lines.findIndex((line) => declares.test(line));
  expect(at, `${relative} declares ${String(declares)} — the doc this case grades hangs on it`).toBeGreaterThan(0);
  const doc: string[] = [];
  for (let above = at - 1; above >= 0; above -= 1) {
    const text = (lines[above] ?? "").trim();
    if (text === "") {
      if (doc.length === 0) continue;
      break;
    }
    if (text.startsWith("/*") || text.startsWith("*") || text.startsWith("//")) {
      doc.unshift(text);
      if (text.startsWith("/*")) break;
      continue;
    }
    break;
  }
  return doc.join("\n");
}

/** The lines of one declaration's block: from the line that opens it to the first same-indent close. */
function blockOf(relative: string, opens: RegExp, closes: string, why: string): string {
  const lines = sourceOf(relative, why).split("\n");
  const at = lines.findIndex((line) => opens.test(line));
  expect(at, `${relative} opens ${String(opens)}`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, index) => index > at && line === closes);
  expect(end, `${relative}'s ${String(opens)} block is bounded by a ${JSON.stringify(closes)}`).toBeGreaterThan(at);
  return lines.slice(at, end + 1).join("\n");
}

/** Every .ts/.tsx file under one of the caller roots — the denominator AC-6(d)'s roster derives from. */
function sourceFilesUnder(root: string): string[] {
  const absolute = join(REPO_ROOT, root);
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory)) {
      if (entry === "node_modules") continue;
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
    }
  };
  walk(absolute);
  return found;
}

describe("AC-6: comments cite the law and state what the code does", () => {
  test("AC-6(a): neither the taxonomy suite nor the session module carries build-organisation narration", () => {
    for (const relative of [TAXONOMY_SUITE, SESSION_MODULE]) {
      // white-box: AC-6(a) — Q-17 bans a process artifact from the TEXT of src/; a narrating comment
      // changes nothing a call can see, which is exactly why the ban has to be read.
      const source = sourceOf(relative, "AC-6(a) reads the file for the narration Q-17 bans");
      expect(source, `${relative} names an increment id — comments cite Bible ids, never build organisation (Q-17)`).not.toMatch(INCREMENT_ID);
      expect(source, `${relative} narrates the build organisation instead of the law (Q-17)`).not.toContain(BUILD_NARRATION);
    }
  });

  test("AC-6(b): inScope's doc states the round trips begin really costs, and why they are paid", () => {
    // white-box: AC-6(b) — the doc states the opposite of what the driver does; only the doc says so.
    const doc = docAbove(SEAM_MODULE, /^async function inScope</, "AC-6(b) reads the doc of the seam's scoping transaction");
    expect(doc, "inScope's doc no longer claims the transaction costs no round trip of its own").not.toMatch(/costs no round trip/i);
    expect(doc, "…it names the BEGIN the driver sends beyond the statement").toMatch(/\bBEGIN\b/);
    expect(doc, "…and the COMMIT that closes it, which is the second one").toMatch(/\bCOMMIT\b/);
  });

  test("AC-6(c): the users.email doc names the column as the fold key, and its untagging accessor", () => {
    // white-box: AC-6(c) — the column holds a tagged fold key and the doc calls it an address; the
    // value in the column is the same string either way, so no read can tell the two claims apart.
    const doc = docAbove(SEAM_MODULE, /email: text\("email"\)/, "AC-6(c) reads the doc of the account's identifying column");
    expect(doc, "the doc no longer calls the stored value the account's name").not.toMatch(/the address is the account's name/i);
    expect(doc, "…it names the accessor that writes the fold key (src/server/auth/folded-key.ts)").toContain("foldedKey");
    expect(doc, "…and the one that untags it back into an address a person is shown").toContain("presentedValue");
  });

  test("AC-6(d): permissionNotHeld's doc names every read path that calls it with no act type", () => {
    // white-box: AC-6(d) — "the null branch is dead" is a claim about the tree, answered by the tree's
    // own text; the roster is derived from the callers so a later one must be documented too (B-19).
    const callers = CALLER_ROOTS.flatMap(sourceFilesUnder)
      .filter((path) => readFileSync(path, "utf8").includes(READ_PATH_CALL))
      .map((path) => basename(path).replace(/\.tsx?$/, ""));
    expect(callers.length, `at least one read path calls ${READ_PATH_CALL} — the branch the row calls dead is live (L-ACT-03)`).toBeGreaterThan(0);

    const doc = docAbove(REFUSALS_MODULE, /export function permissionNotHeld/, "AC-6(d) reads the doc of the refusal a read path answers with");
    expect(doc, "the doc makes no claim that the read-path branch is dead").not.toMatch(/\bdead\b/i);
    for (const caller of new Set(callers)) {
      expect(doc, `the doc names ${caller}, a read path that answers with this refusal and no act type (L-ACT-03)`).toContain(caller);
    }
  });

  test("AC-6(e): BD_DOCUMENT.timeZone is read by the document-day formatter, and the record says so", () => {
    expect(dhakaDateParts(new Date("2026-01-01T18:30:00Z")), "the document day is read in the convention record's own zone, not the host's").toEqual({ year: 2026, month: 1, day: 2 });

    // white-box: AC-6(e) — the row's claim is "exported convention data no code reads". The call
    // above answers the second half; only the record's own comment can answer the first.
    const comments = commentsOf(FORMAT_MODULE, "AC-6(e) reads the convention record's own doc");
    expect(comments, `${FORMAT_MODULE} says which of its own engines reads timeZone, so the field is not left reading as convention data nobody uses (Q-17)`).toContain("timeZone");
  });

  test("AC-6(f): the participation attachment a first grant makes is recorded as an Interpretation", () => {
    // white-box: AC-6(f) — an Interpretation is a recorded reading, not a behaviour: the Consequence's
    // shape is deliberately unchanged (the digest, the dialog and the baselines all rest on it).
    const comments = commentsOf(ASSIGN_MODULE, "AC-6(f) reads the seam's record of what a first grant's subject describes");
    expect(comments, `${ASSIGN_MODULE} records that a first grant's subject before: [] IS the Consequence's description of the participation it attaches`).toContain("before: []");
    expect(comments, "…and cites the clause that reading rests on").toContain("L-ACT-03");
  });

  test("AC-6(g): participantRoles.actId's doc states the one lawful act-less grant, and no CHECK is added", () => {
    // white-box: AC-6(g) — the cure is a documented Interpretation, deliberately not a constraint: a
    // CHECK here would red merged staging that lawfully writes act-less grants.
    const block = blockOf(SEAM_MODULE, /^export const participantRoles = pgTable\(/, ");", "AC-6(g) reads the grant table's declaration");
    expect(block, "the declaration is still the participant_roles table").toContain('"participant_roles"');
    expect(block, "no CHECK is added over act_id — merged stagers lawfully insert act-less grants").not.toMatch(/check\(\s*["'][^"']*act/i);

    const doc = docAbove(SEAM_MODULE, /actId: uuid\("act_id"\),/, "AC-6(g) reads the doc of the grant's nullable act");
    expect(doc, "the doc names the one lawful act-less grant: the PRINCIPAL a project's creation installs").toContain("PRINCIPAL");
    expect(doc, "…citing the clause that installs it").toContain("L-ACT-03");
    expect(doc, "…and saying that no CHECK enforces it, because staged grants lawfully carry none").toMatch(/\bCHECK\b/);
  });
});
