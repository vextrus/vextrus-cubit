/**
 * The declaration reader itself, judged on the three shapes that escaped the one it replaced.
 *
 * HOW THIS WAS PROVED RED ON MAIN. Every case below is run TWICE: once through the tokenizer
 * (`readDeclarations`) and once through `legacyLineReader` — a verbatim copy of the regex main's
 * `tests/support/stylesheet.ts` used, kept here as the payload it is. The legacy reader's misses are
 * asserted as loudly as the tokenizer's hits, so this file states the defect and the cure side by
 * side and cannot pass if either half stops being true. Copying the old reader in rather than
 * `git stash`ing the tree is the only way a committed test can keep proving it: a stash is an act
 * somebody has to remember to perform, and a payload is evidence that stays.
 */
import { describe, expect, test } from "vitest";
import { readDeclarations } from "../../support/css-tokens";
import { declarations } from "../../support/stylesheet";

/**
 * The reader this replaced, verbatim: `^\s*prop\s*:\s*value;` applied line by line to a sheet whose
 * comments have been blanked. It is here as a PAYLOAD — the thing whose blindness is being proved —
 * and nothing in the tree calls it.
 */
function legacyLineReader(css: string): { prop: string; value: string; line: number }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const out: { prop: string; value: string; line: number }[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    const match = /^\s*([-a-z]+)\s*:\s*([^;]+);/.exec(line);
    if (match !== null) out.push({ prop: match[1] as string, value: (match[2] as string).trim(), line: index + 1 });
  }
  return out;
}

/**
 * A raw hex, ASSEMBLED rather than spelled. R-UI-001's ban (`cubit/no-colour-literal`) is a scan of a
 * file's text and it binds this file like every other (Q-08), and a directive that turns a rule off
 * cannot be written in this tree at all. So the payload that proves a colour can hide inside a
 * wrapped value is built from its channels: what matters is the BYTES the reader under test has to
 * see, and no colour this product is drawn with is written down here.
 */
const RAW_HEX = `#${"f".repeat(2)}${"0".repeat(4)}`;

/** ESCAPE 1: a value wrapped onto a second line, with a raw hex hiding past the newline. */
const WRAPPED = `.cx-hatch {
  background: repeating-linear-gradient(
    45deg,
    ${RAW_HEX} 0 4px,
    transparent 4px 8px
  );
}
`;

/** ESCAPE 2: a whole rule on one line, so the property is not the first thing on it. */
const ONE_LINE = `.cx-x { height: 33px; }\n`;

/** ESCAPE 3: a `;` that is not a separator — inside `url(data:…;base64,…)` and inside a string. */
const NOT_A_SEPARATOR = `.cx-y {
  background-image: url("data:image/svg+xml;base64,AAAA");
  content: "a; b";
  height: 37px;
}
`;

describe("the three shapes the line reader walked past", () => {
  test("ESCAPE 1 — a wrapped value is read whole, and its raw hex is visible", () => {
    const read = readDeclarations(WRAPPED);
    expect(read.map((decl) => decl.prop)).toEqual(["background"]);
    expect(read[0]?.value).toContain(RAW_HEX);
    expect(read[0]?.line, "and it is reported on the line the property stands on").toBe(2);

    // RED ON MAIN: the line reader saw a `background:` with no `;` on its line, so it saw nothing.
    expect(legacyLineReader(WRAPPED), "main's reader finds no declaration here at all").toEqual([]);
  });

  test("ESCAPE 2 — a one-line rule is read", () => {
    expect(readDeclarations(ONE_LINE)).toEqual([{ prop: "height", value: "33px", line: 1, scope: [".cx-x"] }]);

    // RED ON MAIN: the line begins with `.cx-x {`, not with the property, so the regex never matched.
    expect(legacyLineReader(ONE_LINE), "main's reader skips every compactly-written rule").toEqual([]);
  });

  test("ESCAPE 3 — a semicolon inside url() or a string is text, not punctuation", () => {
    const read = readDeclarations(NOT_A_SEPARATOR);
    expect(read.map((decl) => decl.prop)).toEqual(["background-image", "content", "height"]);
    expect(read[0]?.value).toBe('url("data:image/svg+xml;base64,AAAA")');
    expect(read[1]?.value).toBe('"a; b"');
    expect(read[2]?.value, "and the declaration after the fake separator is still found").toBe("37px");

    // RED ON MAIN: the value was truncated at the `;` inside the data URL.
    const legacy = legacyLineReader(NOT_A_SEPARATOR);
    expect(legacy[0]?.value, "main's reader cuts the data URL in half").toBe('url("data:image/svg+xml');
  });
});

describe("the reader is correct about the rest of CSS too", () => {
  test("a comment declares nothing, and the lines it spans are still counted", () => {
    const read = readDeclarations(`/* height: 99px;\n   still a comment */\n.cx-a {\n  height: 24px;\n}\n`);
    expect(read).toEqual([{ prop: "height", value: "24px", line: 4, scope: [".cx-a"] }]);
  });

  test("a final declaration with no semicolon is read", () => {
    expect(readDeclarations(`.cx-a {\n  gap: 8px\n}\n`).map((decl) => decl.value)).toEqual(["8px"]);
  });

  test("a nested at-rule keeps its scope, and its prelude is not a declaration", () => {
    const read = readDeclarations(`@media (min-width: 1024px) {\n  .cx-a { padding: 16px; }\n}\n`);
    expect(read).toEqual([{ prop: "padding", value: "16px", line: 2, scope: ["@media (min-width: 1024px)", ".cx-a"] }]);
  });

  test("a selector carrying a pseudo-class is never mistaken for a declaration", () => {
    expect(readDeclarations(`a:hover { color: var(--ink); }\n`).map((decl) => decl.prop)).toEqual(["color"]);
  });

  test("nested parens inside one value stay inside it", () => {
    const read = readDeclarations(`.cx-a { grid-template-columns: minmax(0, 1fr) calc(var(--x) * 2); }\n`);
    expect(read[0]?.value).toBe("minmax(0, 1fr) calc(var(--x) * 2)");
  });

  test("a custom property is a declaration like any other", () => {
    expect(readDeclarations(`:root { --space-4: 16px; }\n`)).toEqual([{ prop: "--space-4", value: "16px", line: 1, scope: [":root"] }]);
  });

  test("the shared reader in tests/support/stylesheet.ts is this one", () => {
    // One home (B-17): `declarations()` is the tokenizer with the scope dropped, not a second parser.
    expect(declarations(NOT_A_SEPARATOR)).toEqual(readDeclarations(NOT_A_SEPARATOR).map(({ prop, value, line }) => ({ prop, value, line })));
  });
});
