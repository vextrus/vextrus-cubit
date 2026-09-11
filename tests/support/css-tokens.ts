/**
 * A real reader for CSS, because a line regex is not one.
 *
 * The reader this replaces matched `^\s*prop\s*:\s*value;` per LINE, and three shapes walked past it:
 *
 *   1. A WRAPPED VALUE. A `repeating-linear-gradient(45deg,` whose stops sit on the NEXT line
 *      states a colour, and the line the property stands on does not contain it. Every colour,
 *      every length and every font size hidden past the first newline of a value was invisible to
 *      every check built on that reader — which is most of the craft rubric's mechanical half.
 *   2. A ONE-LINE RULE. `.x { height: 33px; }` does not begin with its property, so the whole rule
 *      was skipped. A stylesheet could state any geometry it liked as long as it stated it compactly.
 *   3. A SEMICOLON THAT IS NOT A SEPARATOR — inside a string or inside `url(data:…;base64,…)`.
 *      The line reader split on the first `;` it saw and read the remainder as nothing.
 *
 * postcss is not resolvable as a direct import from this store (it is a transitive dependency of
 * Next, present under .pnpm and not hoisted), and no session adds a dependency the lockfile cannot
 * hold (B-24). So this is the tokenizer, written to be correct about exactly the four things a
 * declaration reader has to be correct about: comments, strings, nested parens, and blocks.
 *
 * It is a DECLARATION reader, not a CSS parser: it answers "what does this sheet declare, and
 * where", which is the only question the checks built on it ask.
 */

export interface CssDeclaration {
  /** The property, lowercased and trimmed (`background`, `--space-4`). */
  prop: string;
  /** The value as written, with newlines collapsed to single spaces and the whole thing trimmed. */
  value: string;
  /** The line the PROPERTY stands on, 1-based — the line an editor would open. */
  line: number;
  /** The selector or at-prelude stack this declaration stands under, outermost first. */
  scope: string[];
}

/** Where the walk is, so the cases below read as the states they are. */
interface Cursor {
  at: number;
  line: number;
}

/** Skip a block comment, counting the lines it spans. */
function skipComment(css: string, cursor: Cursor): void {
  const end = css.indexOf("*/", cursor.at + 2);
  const stop = end === -1 ? css.length : end + 2;
  for (let i = cursor.at; i < stop; i += 1) if (css[i] === "\n") cursor.line += 1;
  cursor.at = stop;
}

/**
 * Every declaration a sheet states, wherever it states it.
 *
 * The walk keeps three things: the paren depth (so a `;` or a `}` inside `url(…)` or `minmax(…)` is
 * text, not punctuation), the block stack (so a declaration knows what it is declared under), and
 * the buffer of the term being read. A term is flushed at `;`, at `}` and at the end of the sheet —
 * the last one is what reads `.x { height: 33px }`, whose final declaration has no semicolon.
 */
export function readDeclarations(css: string): CssDeclaration[] {
  const found: CssDeclaration[] = [];
  const scope: string[] = [];
  const cursor: Cursor = { at: 0, line: 1 };
  let buffer = "";
  let bufferLine = 1;
  let depth = 0;

  /** A term that holds a `:` at paren depth 0 is a declaration; anything else is a prelude. */
  const flush = (): void => {
    const term = buffer.trim();
    buffer = "";
    if (term === "" || term.startsWith("@")) return;
    // The FIRST colon at depth 0 splits it: `background: url(data:…)` splits once, not twice.
    let split = -1;
    let parens = 0;
    let quote = "";
    for (let i = 0; i < term.length; i += 1) {
      const ch = term[i] as string;
      if (quote !== "") {
        if (ch === "\\") i += 1;
        else if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") parens += 1;
      else if (ch === ")") parens -= 1;
      else if (ch === ":" && parens === 0) {
        split = i;
        break;
      }
    }
    if (split === -1) return;
    const prop = term.slice(0, split).trim().toLowerCase();
    const value = term.slice(split + 1).replace(/\s*\n\s*/g, " ").trim();
    if (prop === "" || !/^[-a-z]/.test(prop)) return;
    found.push({ prop, value, line: bufferLine, scope: [...scope] });
  };

  while (cursor.at < css.length) {
    const ch = css[cursor.at] as string;
    if (ch === "/" && css[cursor.at + 1] === "*") {
      skipComment(css, cursor);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let i = cursor.at + 1;
      buffer += ch;
      while (i < css.length && css[i] !== quote) {
        if (css[i] === "\\") {
          buffer += css[i] as string;
          i += 1;
        }
        if (css[i] === "\n") cursor.line += 1;
        buffer += (css[i] ?? "") as string;
        i += 1;
      }
      buffer += quote;
      cursor.at = i + 1;
      continue;
    }
    if (ch === "\n") cursor.line += 1;
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "{" || ch === "}" || ch === ";")) {
      if (ch === "{") {
        scope.push(buffer.trim().replace(/\s*\n\s*/g, " "));
        buffer = "";
      } else {
        flush();
        if (ch === "}") scope.pop();
      }
      cursor.at += 1;
      // The next term starts here, so it starts on the line the walk is now on.
      bufferLine = cursor.line;
      continue;
    }
    if (buffer.trim() === "" && !/\s/.test(ch)) bufferLine = cursor.line;
    buffer += ch;
    cursor.at += 1;
  }
  flush();
  return found;
}
