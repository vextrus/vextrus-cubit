/**
 * A quote-aware scanner for the source questions this suite asks: what a file's COMMENTS say
 * (Q-17), and what its STRING LITERALS spell (B-17's "one spelling"). A regex stripper answers both
 * wrongly — `//` inside a URL literal opens a comment that never closes, and `/*` inside a glob or a
 * character class swallows the code after it — so the source is scanned character by character with
 * quote, template and regular-expression state tracked.
 *
 * CSS is scanned in its own dialect: it has block comments and quoted strings and no `//` comment at
 * all, so `url(https://…)` cannot be read as one.
 */

export type Dialect = "ts" | "css";

export interface Lexed {
  /** Every comment, whitespace-normalised; consecutive `//` lines are joined into one block. */
  readonly comments: readonly string[];
  /** The content of every string, template and CSS quoted literal, as written (escapes kept raw). */
  readonly strings: readonly string[];
  /** The source with every comment and literal blanked out, so code can be scanned on its own. */
  readonly code: string;
}

interface RawComment {
  text: string;
  line: number;
  endLine: number;
  kind: "line" | "block";
}

/** After these, a `/` opens a regular expression rather than dividing. */
const REGEX_MAY_FOLLOW = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "+", "-", "*", "%", "^", "~", "{", "}", ";", "<", ">", "\n"]);
const REGEX_MAY_FOLLOW_WORD = /\b(return|typeof|case|in|of|do|else|yield|await|delete|void|new)$/;

function regexCanStart(codeSoFar: string): boolean {
  const trimmed = codeSoFar.replace(/\s+$/, "");
  if (trimmed === "") return true;
  const last = trimmed.charAt(trimmed.length - 1);
  if (REGEX_MAY_FOLLOW.has(last)) return true;
  return REGEX_MAY_FOLLOW_WORD.test(trimmed);
}

/** Whitespace runs collapse to one space so a phrase that wraps across lines still reads as itself. */
export function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function lex(source: string, dialect: Dialect): Lexed {
  const comments: RawComment[] = [];
  const strings: string[] = [];
  const code: string[] = [];
  let line = 1;
  let index = 0;

  const blank = (text: string): void => {
    for (const character of text) code.push(character === "\n" ? "\n" : " ");
  };

  while (index < source.length) {
    const character = source.charAt(index);
    const next = source.charAt(index + 1);

    if (character === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      const end = close === -1 ? source.length : close + 2;
      const text = source.slice(index, end);
      const startLine = line;
      line += (text.match(/\n/g) ?? []).length;
      comments.push({ text: text.slice(2, close === -1 ? undefined : -2), line: startLine, endLine: line, kind: "block" });
      blank(text);
      index = end;
      continue;
    }

    if (dialect === "ts" && character === "/" && next === "/") {
      const breakAt = source.indexOf("\n", index);
      const end = breakAt === -1 ? source.length : breakAt;
      comments.push({ text: source.slice(index + 2, end), line, endLine: line, kind: "line" });
      blank(source.slice(index, end));
      index = end;
      continue;
    }

    if (character === '"' || character === "'" || (dialect === "ts" && character === "`")) {
      const quote = character;
      let cursor = index + 1;
      let content = "";
      while (cursor < source.length) {
        const inner = source.charAt(cursor);
        if (inner === "\\") {
          content += source.slice(cursor, cursor + 2);
          cursor += 2;
          continue;
        }
        if (inner === quote) {
          cursor += 1;
          break;
        }
        if (quote === "`" && inner === "$" && source.charAt(cursor + 1) === "{") {
          // A substitution is code, not text: close the piece and let the scanner read on from `${`.
          break;
        }
        content += inner;
        cursor += 1;
      }
      strings.push(content);
      const consumed = source.slice(index, cursor);
      line += (consumed.match(/\n/g) ?? []).length;
      blank(consumed);
      index = cursor;
      continue;
    }

    if (dialect === "ts" && character === "/" && regexCanStart(code.join(""))) {
      let cursor = index + 1;
      let inClass = false;
      while (cursor < source.length) {
        const inner = source.charAt(cursor);
        if (inner === "\\") {
          cursor += 2;
          continue;
        }
        if (inner === "\n") break;
        if (inner === "[") inClass = true;
        else if (inner === "]") inClass = false;
        else if (inner === "/" && !inClass) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      blank(source.slice(index, cursor));
      index = cursor;
      continue;
    }

    if (character === "\n") line += 1;
    code.push(character);
    index += 1;
  }

  // Consecutive `//` lines are one comment: a phrase the rows name can wrap across two of them, and
  // reading each line alone would let a rewrite hide narration in the fold.
  const grouped: RawComment[] = [];
  for (const comment of comments) {
    const previous = grouped[grouped.length - 1];
    if (previous !== undefined && previous.kind === "line" && comment.kind === "line" && comment.line === previous.endLine + 1) {
      previous.text = `${previous.text} ${comment.text}`;
      previous.endLine = comment.endLine;
      continue;
    }
    grouped.push({ text: comment.text, line: comment.line, endLine: comment.endLine, kind: comment.kind });
  }
  const merged = grouped.map((comment) => normalise(comment.text));

  return { comments: merged, strings, code: code.join("") };
}

/** The dialect a file is read in, from its extension. */
export function dialectOf(file: string): Dialect {
  return file.endsWith(".css") ? "css" : "ts";
}
