/**
 * The outbox has ONE reader, and the tree is asked rather than trusted (ARCH-02, B-17).
 *
 * The repair this law guards is not a bug fix, it is a shape: FOUR places used to `readdir` the mail
 * outbox and `JSON.parse` every file they found — and only three of them were known when this
 * repair began; the fourth is what a law asked of the whole tree is FOR, so the five zero-byte files a power cut left at
 * 10:38 on 2026-09-12 turned J-000 red in both lanes, eight db-lane cases red and the rehearsal's
 * gate red — every one of them reporting `SyntaxError: Unexpected end of JSON input` and naming
 * nothing. Migrating those three readers is worth exactly as much as the next reader not being
 * written the same way, and only a test asked of the whole tree can say that.
 *
 * The question is asked of CODE, never of text: comments and string literals are blanked out by the
 * tree's own lexer (tests/support/source-lex.ts), so a file that merely TALKS about the outbox — this
 * one does — is not a reader of it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { lexFile } from "../support/source-lex";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** The one reader every consumer of the outbox goes through. */
const THE_READER = "tests/support/outbox.ts";

/** This law's own file: it names the shapes it forbids, and naming them is how it forbids them. */
const THE_LAW = "tests/auth/outbox-one-reader.test.ts";

/**
 * The fixture corpus is deliberate payload for the lint laws, not code this tree runs, and
 * node_modules is nobody's source.
 */
const NOT_OURS = ["tests/lint-fixtures/"];

/** A file this tree writes. */
const SOURCE = /\.tsx?$/;

/** The three readings that together make a file a second reader of the outbox. */
const LISTS = /\breaddirSync\b/;
const PARSES = /\bJSON\s*\.\s*parse\b/;
const NAMES_THE_OUTBOX = /\b(?:MAIL_OUTBOX_DIR|outboxDir)\b/;
const OUTBOX_PATH = /mail-outbox/;

function everySource(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE.test(entry.name)) found.push(relative(ROOT, full).replace(/\\/g, "/"));
    }
  };
  for (const root of ["src", "tests", "db", "scripts"]) walk(join(ROOT, root));
  return found.filter((file) => !NOT_OURS.some((tree) => file.startsWith(tree))).sort();
}

describe("only one reader parses the mail outbox", () => {
  test("no file but the one reader lists the outbox directory and parses what it finds", () => {
    const offenders: string[] = [];
    for (const file of everySource()) {
      if (file === THE_READER || file === THE_LAW) continue;
      const lexed = lexFile(file, readFileSync(join(ROOT, file), "utf8"));
      const names = NAMES_THE_OUTBOX.test(lexed.code) || lexed.strings.some((literal) => OUTBOX_PATH.test(literal));
      if (names && LISTS.test(lexed.code) && PARSES.test(lexed.code)) offenders.push(file);
    }
    expect(
      offenders,
      `these files read the mail outbox themselves — a directory that can hold a zero-byte or torn file left by a killed writer, which each of them would throw on. Read it through ${THE_READER}: it skips such a file and names it (ARCH-02)`,
    ).toEqual([]);
  });

  test("and that one reader really is one — the law cannot pass because nothing matches any more", () => {
    const lexed = lexFile(THE_READER, readFileSync(join(ROOT, THE_READER), "utf8"));
    expect(LISTS.test(lexed.code), `${THE_READER} lists the outbox directory`).toBe(true);
    expect(PARSES.test(lexed.code), `${THE_READER} is the one place a mail is parsed`).toBe(true);
    expect(NAMES_THE_OUTBOX.test(lexed.code), `${THE_READER} reads the outbox the writer names, not a path of its own`).toBe(true);
  });

  test("the three readers that used to parse it reach the outbox through that reader", () => {
    const migrated = [
      "tests/e2e/support/outbox.ts",
      "tests/invitations/support/browser.ts",
      "db/__tests__/auth-door.test.ts",
      "db/__tests__/auth-reset-supersedes-links-breaker.test.ts",
    ];
    for (const file of migrated) {
      const lexed = lexFile(file, readFileSync(join(ROOT, file), "utf8"));
      expect(/\breadOutbox\b/.test(lexed.code), `${file} reads the outbox through ${THE_READER}`).toBe(true);
    }
  });
});
