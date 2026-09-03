/**
 * ONE lexical machine for every source question the suites ask of a file (B-17: one invariant, one
 * home). Two readings are derived from it and nothing re-derives them: dropping or reading
 * COMMENTS (Q-17), and masking a file down to its CODE so a phrase counted in code is never a
 * phrase written in prose or in a literal.
 *
 * A regex stripper answers both wrongly — `//` inside a URL literal opens a comment that never
 * closes, `/*` inside a glob or a character class swallows the code after it, and a quote inside a
 * regular expression opens a literal that swallows the rest of the file — so the source is scanned
 * character by character with comment, quote, template, regular-expression and JSX state tracked.
 *
 * Dialects, because the same questions are asked of three languages:
 *  - `css`  — block comments and quoted strings only; there is no `//` comment, so `url(https://…)`
 *             cannot be read as one, and there are no templates or regular expressions.
 *  - `ts`   — line and block comments, `'`/`"`/`` ` `` literals, `${…}` substitutions (which nest),
 *             and regular expressions with their character classes.
 *  - `tsx`  — everything `ts` has, plus JSX: inside element children a quote is ordinary text and
 *             `//` opens nothing, an attribute value lexes as a string, and `{` re-enters TS.
 *
 * Where the scan cannot decide it says so rather than guessing quietly: a `'`/`"` run that reaches
 * a newline or the end of the file is not a literal in TS at all, so it is rewound to code and
 * RECORDED as a diagnostic. A scan that silently blanks a span is how a comment check passes by not
 * looking; a diagnostic makes that a red naming the file and the line instead (B-19).
 *
 * That rewind is what answers "a literal must not swallow a comment": a `'` in rendered copy can no
 * longer run past its own line, and in `tsx` it is copy rather than a literal at all. Flagging every
 * literal that merely CONTAINS `//` is not the same rule and is not adopted — `href="https://…"`
 * is a decided, ordinary attribute, and reddening it would freeze today's tree (B-19).
 */

/** The language a file is read in. */
export type Dialect = "ts" | "tsx" | "css";

/** The lexical mode a character of a source file sits in. */
export type ScanMode = "code" | "line" | "block" | "single" | "double" | "template" | "regex" | "jsx-text";

/** Which end of its run a character is: the delimiters that open or close it, or neither. */
export type ScanEdge = "open" | "close" | null;

export interface ScannedChar {
  readonly index: number;
  readonly char: string;
  readonly mode: ScanMode;
  readonly edge: ScanEdge;
}

/** A place the scan could not decide, named so the suite can go red instead of green. */
export interface LexDiagnostic {
  readonly line: number;
  readonly reason: string;
}

export interface Lexed {
  /** Every comment, whitespace-normalised; consecutive `//` lines are joined into one block. */
  readonly comments: readonly string[];
  /** The content of every string, template piece and CSS quoted literal, as written (escapes raw). */
  readonly strings: readonly string[];
  /** The source with every comment and literal blanked out, so code can be scanned on its own. */
  readonly code: string;
  /** Every place the scan could not decide. A non-empty list is a red, never a shrug. */
  readonly diagnostics: readonly LexDiagnostic[];
}

/** After these, a `/` opens a regular expression rather than dividing, and a `<` opens JSX. */
const VALUE_MAY_FOLLOW = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "+", "-", "*", "%", "^", "~", "{", "}", ";", "<", ">", "\n"]);
const VALUE_MAY_FOLLOW_WORD = /\b(return|typeof|case|in|of|do|else|yield|await|delete|void|new)$/;
/** Enough trailing code to decide the predicate above — the longest word in it is nine characters. */
const TAIL_LENGTH = 32;

/** A `/` here opens a regular expression, and a `<` here opens a JSX element, rather than operating. */
function valueCanStart(codeSoFar: string): boolean {
  const trimmed = codeSoFar.replace(/\s+$/, "");
  if (trimmed === "") return true;
  const last = trimmed.charAt(trimmed.length - 1);
  if (VALUE_MAY_FOLLOW.has(last)) return true;
  return VALUE_MAY_FOLLOW_WORD.test(trimmed);
}

/** A JSX element name, a fragment or a closing tag may follow the `<` that opens one. */
function opensJsxTag(next: string): boolean {
  return next === ">" || next === "/" || /[A-Za-z_$]/.test(next);
}

/** Whitespace runs collapse to one space so a phrase that wraps across lines still reads as itself. */
export function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The dialect a file is read in, from its extension: JSX is its own, never folded into `ts`. */
export function dialectOf(file: string): Dialect {
  if (file.endsWith(".css")) return "css";
  return file.endsWith(".tsx") ? "tsx" : "ts";
}

/** Where the scanner is: TS code, inside a JSX tag, in element children, or inside a template. */
type Context = "code" | "tag" | "text" | "template";

/** What an expression returns to when its `}` closes: a template's text, a tag, or children. */
interface Frame {
  readonly back: Context;
  /** Braces opened since the frame was pushed; the `}` that closes the frame is the one at zero. */
  braces: number;
  /** The JSX nesting depth the frame suspended, restored when it pops. */
  readonly depth: number;
}

/**
 * Every character of a source file with the mode it belongs to and whether it delimits its run.
 * Every index of the source is yielded exactly once and in order, so a mask built from this stream
 * is the same length as the file and an index into it is an index into the file.
 */
export function* scanned(source: string, dialect: Dialect = "ts", report: (diagnostic: LexDiagnostic) => void = () => {}): Generator<ScannedChar> {
  const ts = dialect !== "css";
  const jsx = dialect === "tsx";
  const frames: Frame[] = [];
  let context: Context = "code";
  let depth = 0;
  let line = 1;
  let tail = "";
  let index = 0;

  function* emit(from: number, to: number, mode: ScanMode, openTo = from, closeFrom = to): Generator<ScannedChar> {
    for (let at = from; at < to; at += 1) {
      const char = source.charAt(at);
      const edge: ScanEdge = at < openTo ? "open" : at >= closeFrom ? "close" : null;
      if (char === "\n") line += 1;
      // A literal stands in the tail as an operand ("x"), so a `/` after `"a"` divides rather than
      // opening a regular expression; a comment leaves no trace, so `a /* … */ / 2` divides too.
      if (mode === "code" || mode === "jsx-text") tail = `${tail}${char}`.slice(-TAIL_LENGTH);
      else if (mode !== "line" && mode !== "block") tail = `${tail}x`.slice(-TAIL_LENGTH);
      yield { index: at, char, mode, edge };
    }
  }

  /** A `'` or `"` run, or a rewind: in TS neither may span a line, so an unclosed one is not one. */
  function* quoted(quote: string): Generator<ScannedChar> {
    let cursor = index + 1;
    while (cursor < source.length) {
      const inner = source.charAt(cursor);
      if (inner === "\\") {
        cursor += 2;
        continue;
      }
      if (inner === quote) {
        yield* emit(index, cursor + 1, quote === "'" ? "single" : "double", index + 1, cursor);
        index = cursor + 1;
        return;
      }
      if (inner === "\n" && ts) break;
      cursor += 1;
    }
    // Unterminated: rewind. The quote is an ordinary character of the code (in TS it cannot open a
    // literal that spans a line), and the scan says so rather than blanking the rest of the file.
    report({ line, reason: `a ${quote === "'" ? "single" : "double"}-quoted run is never closed on its line — it is not a literal, and the characters after it were nearly read as one` });
    yield* emit(index, index + 1, "code");
    index += 1;
  }

  while (index < source.length) {
    const char = source.charAt(index);
    const next = source.charAt(index + 1);

    // A comment reads the same in code and between a tag's attributes, where JSX admits one too.
    if (context === "code" || context === "tag") {
      if (char === "/" && next === "*") {
        const close = source.indexOf("*/", index + 2);
        if (close === -1) report({ line, reason: "a block comment is never closed" });
        const end = close === -1 ? source.length : close + 2;
        yield* emit(index, end, "block", index + 2, close === -1 ? end : close);
        index = end;
        continue;
      }
      if (ts && char === "/" && next === "/") {
        const breakAt = source.indexOf("\n", index);
        const end = breakAt === -1 ? source.length : breakAt + 1;
        yield* emit(index, end, "line", index + 2, breakAt === -1 ? end : breakAt);
        index = end;
        continue;
      }
    }

    if (context === "text") {
      if (char === "<") {
        if (next === "/") {
          const close = source.indexOf(">", index);
          const end = close === -1 ? source.length : close + 1;
          yield* emit(index, end, "code");
          index = end;
          depth -= 1;
          context = depth > 0 ? "text" : "code";
          continue;
        }
        yield* emit(index, index + 1, "code");
        index += 1;
        context = "tag";
        continue;
      }
      if (char === "{") {
        frames.push({ back: "text", braces: 0, depth });
        depth = 0;
        yield* emit(index, index + 1, "code");
        index += 1;
        context = "code";
        continue;
      }
      yield* emit(index, index + 1, "jsx-text");
      index += 1;
      continue;
    }

    if (context === "tag") {
      if (char === '"' || char === "'") {
        yield* quoted(char);
        continue;
      }
      if (char === "{") {
        frames.push({ back: "tag", braces: 0, depth });
        depth = 0;
        yield* emit(index, index + 1, "code");
        index += 1;
        context = "code";
        continue;
      }
      if (char === "/" && next === ">") {
        yield* emit(index, index + 2, "code");
        index += 2;
        context = depth > 0 ? "text" : "code";
        continue;
      }
      if (char === ">") {
        yield* emit(index, index + 1, "code");
        index += 1;
        depth += 1;
        context = "text";
        continue;
      }
      yield* emit(index, index + 1, "code");
      index += 1;
      continue;
    }

    if (context === "template") {
      if (char === "\\") {
        yield* emit(index, Math.min(index + 2, source.length), "template");
        index += 2;
        continue;
      }
      if (char === "`") {
        yield* emit(index, index + 1, "template", index, index);
        index += 1;
        context = "code";
        continue;
      }
      if (char === "$" && next === "{") {
        frames.push({ back: "template", braces: 0, depth });
        depth = 0;
        yield* emit(index, index + 2, "code");
        index += 2;
        context = "code";
        continue;
      }
      yield* emit(index, index + 1, "template");
      index += 1;
      continue;
    }

    // context === "code"
    if (char === '"' || char === "'") {
      yield* quoted(char);
      continue;
    }

    if (ts && char === "`") {
      yield* emit(index, index + 1, "template", index + 1, index + 1);
      index += 1;
      context = "template";
      continue;
    }

    if (ts && char === "/" && valueCanStart(tail)) {
      let cursor = index + 1;
      let inClass = false;
      let closed = false;
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
          closed = true;
          break;
        }
        cursor += 1;
      }
      if (closed) {
        yield* emit(index, cursor, "regex", index + 1, cursor - 1);
        index = cursor;
        continue;
      }
      // Not a regular expression after all (it reaches a line break): an ordinary division.
      yield* emit(index, index + 1, "code");
      index += 1;
      continue;
    }

    if (jsx && char === "<" && opensJsxTag(next) && valueCanStart(tail)) {
      yield* emit(index, index + 1, "code");
      index += 1;
      context = "tag";
      continue;
    }

    if (char === "{" && frames.length > 0) {
      (frames[frames.length - 1] as Frame).braces += 1;
    } else if (char === "}" && frames.length > 0) {
      const frame = frames[frames.length - 1] as Frame;
      if (frame.braces === 0) {
        frames.pop();
        yield* emit(index, index + 1, "code");
        index += 1;
        context = frame.back;
        depth = frame.depth;
        continue;
      }
      frame.braces -= 1;
    }

    yield* emit(index, index + 1, "code");
    index += 1;
  }

  if (context === "template") report({ line, reason: "a template literal is never closed" });
}

/** The comment and literal runs of a source, and the same source masked down to its code. */
export function lex(source: string, dialect: Dialect = "ts"): Lexed {
  const diagnostics: LexDiagnostic[] = [];
  const mask = new Array<string>(source.length).fill(" ");
  const comments: { text: string; line: number; endLine: number; kind: "line" | "block" }[] = [];
  const strings: string[] = [];
  let run: { mode: ScanMode; text: string; line: number; endLine: number } | null = null;
  let line = 1;

  const closeRun = (): void => {
    if (run === null) return;
    if (run.mode === "line" || run.mode === "block") comments.push({ text: run.text, line: run.line, endLine: run.endLine, kind: run.mode });
    else strings.push(run.text);
    run = null;
  };

  for (const { index, char, mode, edge } of scanned(source, dialect, (diagnostic) => diagnostics.push(diagnostic))) {
    const collecting = mode === "line" || mode === "block" || mode === "single" || mode === "double" || mode === "template";
    if (collecting) {
      if (run === null || run.mode !== mode || edge === "open") {
        closeRun();
        run = { mode, text: "", line, endLine: line };
      }
      if (edge === null) run.text += char;
      run.endLine = line;
      mask[index] = char === "\n" ? "\n" : " ";
    } else {
      closeRun();
      mask[index] = mode === "code" || mode === "jsx-text" || char === "\n" ? char : " ";
    }
    if (char === "\n") line += 1;
  }
  closeRun();

  // Consecutive `//` lines are one comment: a phrase can wrap across two of them, and reading each
  // line alone would let a rewrite hide narration in the fold.
  const grouped: typeof comments = [];
  for (const comment of comments) {
    const previous = grouped[grouped.length - 1];
    if (previous !== undefined && previous.kind === "line" && comment.kind === "line" && comment.line === previous.endLine + 1) {
      previous.text = `${previous.text} ${comment.text}`;
      previous.endLine = comment.endLine;
      continue;
    }
    grouped.push({ ...comment });
  }

  return {
    comments: grouped.map((comment) => normalise(comment.text)),
    strings,
    code: mask.join(""),
    diagnostics,
  };
}

/**
 * The same reading, keyed by the file it came from: the dialect follows the extension, and a scan
 * that could not decide is a red naming the file and the line rather than a quiet blank span.
 */
export function lexFile(file: string, source: string): Lexed {
  const lexed = lex(source, dialectOf(file));
  if (lexed.diagnostics.length > 0) {
    const named = lexed.diagnostics.map((diagnostic) => `${file}:${diagnostic.line}: ${diagnostic.reason}`).join("\n");
    throw new Error(`the source scan could not decide how to read this file, so its comments cannot be graded:\n${named}`);
  }
  return lexed;
}
