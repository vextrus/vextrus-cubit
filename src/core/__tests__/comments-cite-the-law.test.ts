/**
 * AC-6 of the src/core debt sweep: a comment states what the code does and cites the law it does it
 * under (Q-17, B-17).
 *
 * A comment that lies is invisible to every call — there is nothing to drive, which is the whole of
 * the defect this criterion names. Every case here is therefore a declared white-box read, marked on
 * the line, in the idiom src/core/format.test.ts:126 uses: the file is asserted present, read with
 * `readFileSync`, and only the doc block hanging on one named declaration is graded. AC-6(e) is the
 * one case with a runtime half, and that half is a call.
 *
 * Nothing here transcribes the wording a fix must use: each case names the claim that must be gone
 * and the fact that must be stated, never the sentence that states it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { dhakaDateParts } from "../format";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const SEAM_MODULE = "src/core/db.ts";
const REFUSALS_MODULE = "src/core/acts/refusals.ts";
const ASSIGN_MODULE = "src/core/acts/assign-participant-role.ts";
const FORMAT_MODULE = "src/core/format.ts";
const TAXONOMY_SUITE = "src/core/errors/taxonomy.test.ts";
const SESSION_MODULE = "src/server/auth/session.ts";

/** Build-organisation narration, spelled from parts so this file is not itself an instance of it. */
const INCREMENT_ID = /\binc-\d{3}\b/;
const BUILD_NARRATION = ["this", "increment"].join(" ");

/**
 * The read paths L-ACT-03 answers with a null act type, as AC-6(d) names them. The criterion fixes
 * these two surfaces; the doc has to name them, and a comment naming neither is the stale claim.
 */
const READ_PATH_SURFACES = ["lifecycle", "roster"];

/** A module's text, asserted present so a missing file names itself rather than reading as empty. */
function textOf(relative: string): string {
  const absolute = join(REPO_ROOT, relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it`).toBe(true);
  return readFileSync(absolute, "utf8");
}

/**
 * The comment block sitting immediately above the first line that matches `declares` — the doc a
 * reader of that declaration actually sees, rather than anything else the file happens to say.
 */
function docAbove(source: string, relative: string, declares: RegExp): string {
  const lines = source.split("\n");
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
function blockOf(source: string, relative: string, opens: RegExp, closes: string): string {
  const lines = source.split("\n");
  const at = lines.findIndex((line) => opens.test(line));
  expect(at, `${relative} opens ${String(opens)}`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, index) => index > at && line === closes);
  expect(end, `${relative}'s ${String(opens)} block is bounded by a ${JSON.stringify(closes)}`).toBeGreaterThan(at);
  return lines.slice(at, end + 1).join("\n");
}

describe("AC-6: comments cite the law and state what the code does", () => {
  test("AC-6(a): neither the taxonomy suite nor the session module carries build-organisation narration", () => {
    for (const relative of [TAXONOMY_SUITE, SESSION_MODULE]) {
      // white-box: AC-6(a) — "an increment id appears nowhere in these two files" is a property of
      // their text; Q-17 bans a process artifact from src/, and narration has no runtime observable.
      const source = textOf(relative);
      expect(source, `${relative} names an increment id — comments cite Bible ids, never build organisation (Q-17)`).not.toMatch(INCREMENT_ID);
      expect(source, `${relative} narrates the build organisation instead of the law (Q-17)`).not.toContain(BUILD_NARRATION);
    }
  });

  test("AC-6(b): inScope's doc states the round trips begin really costs, and why they are paid", () => {
    // white-box: AC-6(b) — the doc states the opposite of what the driver does. What the driver does
    // is already proven by every live suite in the tree; only the sentence about it can be wrong.
    const doc = docAbove(textOf(SEAM_MODULE), SEAM_MODULE, /^async function inScope</);
    expect(doc, "inScope's doc no longer claims the transaction costs no round trip of its own").not.toMatch(/costs no round trip/i);
    expect(doc, "…it names the BEGIN the driver sends beyond the statement").toMatch(/\bBEGIN\b/);
    expect(doc, "…and the COMMIT that closes it, which is the second one").toMatch(/\bCOMMIT\b/);
  });

  test("AC-6(c): the users.email doc names the column as the fold key, and its untagging accessor", () => {
    // white-box: AC-6(c) — the column holds a tagged fold key and the doc calls it an address. The
    // value in the column is the same string under either claim, so no read can tell them apart.
    const doc = docAbove(textOf(SEAM_MODULE), SEAM_MODULE, /email: text\("email"\)/);
    expect(doc, "the doc no longer calls the stored value the account's name").not.toMatch(/the address is the account's name/i);
    expect(doc, "…it names the accessor that writes the fold key (src/server/auth/folded-key.ts)").toContain("foldedKey");
    expect(doc, "…and the one that untags it back into an address a person is shown").toContain("presentedValue");
  });

  test("AC-6(d): permissionNotHeld's doc names the read paths that call it with no act type", () => {
    // white-box: AC-6(d) — "this branch is dead" is a claim ABOUT the tree, not a behaviour of it:
    // the branch answers the same refusal whether or not anything calls it, so only the doc is wrong.
    // (src/core may not import src/modules or src/server — ARCH-01 — so the callers cannot be driven
    // from here; the criterion names the two surfaces the doc must name.)
    const doc = docAbove(textOf(REFUSALS_MODULE), REFUSALS_MODULE, /export function permissionNotHeld/);
    expect(doc, "the doc makes no claim that the read-path branch is dead").not.toMatch(/\bdead\b/i);
    for (const surface of READ_PATH_SURFACES) {
      expect(doc.toLowerCase(), `the doc names the project ${surface} guard, a read path that answers with this refusal and no act type (L-ACT-03)`).toContain(surface);
    }
  });

  test("AC-6(e): BD_DOCUMENT.timeZone is read by the document-day formatter, and the record says so", () => {
    expect(dhakaDateParts(new Date("2026-01-01T18:30:00Z")), "the document day is read in the convention record's own zone, not the host's").toEqual({ year: 2026, month: 1, day: 2 });

    // white-box: AC-6(e) — the row's claim is "exported convention data no code reads". The call
    // above answers the second half; only the record's own doc can answer the first.
    const source = textOf(FORMAT_MODULE);
    // Either home is the record's own doc: the block over the whole record, or the field's own line.
    const doc = `${docAbove(source, FORMAT_MODULE, /^export const BD_DOCUMENT/)}\n${docAbove(source, FORMAT_MODULE, /^\s+timeZone: /)}`;
    expect(doc, `${FORMAT_MODULE} says which of its own engines reads timeZone, so the field is not left reading as convention data nobody uses (Q-17)`).toContain("timeZone");
  });

  test("AC-6(f): the participation attachment a first grant makes is recorded as an Interpretation", () => {
    // white-box: AC-6(f) — an Interpretation is a recorded reading, not a behaviour: the Consequence's
    // shape is deliberately unchanged (its digest, the dialog copy and the baselines all rest on it),
    // so the only thing this criterion can move is the sentence beside the insert.
    const source = textOf(ASSIGN_MODULE);
    expect(source, `${ASSIGN_MODULE} records that a first grant's subject before: [] IS the Consequence's own description of the participation it attaches`).toContain("before: []");
    expect(source, "…and cites the clause that reading rests on").toContain("L-ACT-03");
  });

  test("AC-6(g): participantRoles.actId's doc states the one lawful act-less grant, and no CHECK is added", () => {
    // white-box: AC-6(g) — the cure is a documented Interpretation, deliberately NOT a constraint: a
    // CHECK here would red merged stagers that lawfully write act-less grants, so there is no
    // behaviour to change and the declaration's own doc is the whole of the fix.
    const source = textOf(SEAM_MODULE);
    const block = blockOf(source, SEAM_MODULE, /^export const participantRoles = pgTable\(/, ");");
    expect(block, "the declaration is still the participant_roles table").toContain('"participant_roles"');
    expect(block, "no CHECK is added over act_id — merged stagers lawfully insert act-less grants").not.toMatch(/check\(\s*["'][^"']*act/i);

    const doc = docAbove(source, SEAM_MODULE, /actId: uuid\("act_id"\),/);
    expect(doc, "the doc names the one lawful act-less grant: the PRINCIPAL a project's creation installs").toContain("PRINCIPAL");
    expect(doc, "…citing the clause that installs it").toContain("L-ACT-03");
    expect(doc, "…and saying that no CHECK enforces it, because staged grants lawfully carry none").toMatch(/\bCHECK\b/);
  });
});
