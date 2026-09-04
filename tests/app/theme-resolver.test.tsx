// @vitest-environment jsdom
/**
 * AC-4(a)(b): the pre-paint theme resolver becomes hash-addressable, and the root document's
 * comments stop narrating the build.
 *
 * docs/design/root-document.md I-10 fixes the resolver as an INLINE script — the CSP path for one of
 * those is a `script-src 'sha256-…'` source, which cites the base64 SHA-256 of the script's exact
 * text. So the text needs a name and a published digest, and the layout has to render that very
 * string: a digest of one string beside a document carrying another is a header that blocks the
 * product's own script. That identity is what this file drives.
 *
 * What the resolver DOES under a dark and a light preference is already owned by
 * `tests/app/root-document.test.ts` (AC-2 there), which runs the document's inline scripts against a
 * stubbed `matchMedia` and must stay green unedited. Asserting it a second time here would be one
 * code path under two labels (Q-17), so this file asserts the one thing that file cannot: that the
 * script the document ships and the string the digest is taken of are the same string.
 */
import { createHash } from "node:crypto";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test } from "vitest";
import { productModule } from "../server/support/wire";
// white-box: AC-4(b) — Q-17 bans process narration from `src/` COMMENTS, and a comment has no
// runtime observable at all: nothing the layout or the resolver does can be made to reveal one.
import { lexed } from "./support/sources";

const RESOLVER = "src/app/theme-resolver.ts";
const LAYOUT = "src/app/layout.tsx";

/** Process narration Q-17 keeps out of `src/` comments: an increment id, and the word itself. */
const NARRATION: readonly { pattern: RegExp; what: string }[] = [
  { pattern: /inc-/i, what: "an increment id" },
  { pattern: /\bincrements?\b/i, what: "the word \"increment\"" },
];

interface ResolverModule {
  THEME_RESOLVER: string;
  THEME_RESOLVER_SHA256: string;
}

interface LayoutModule {
  default: (props: { children: ReactNode }) => ReactElement;
}

/** Every inline script in a rendered tree, as the code it carries. */
function inlineScripts(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap((child) => inlineScripts(child));
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode; dangerouslySetInnerHTML?: { __html?: string }; src?: string };
  const own = node.type === "script" && typeof props.dangerouslySetInnerHTML?.__html === "string" ? [props.dangerouslySetInnerHTML.__html] : [];
  return [...own, ...inlineScripts(props.children)];
}

describe("AC-4: the theme resolver is one string with a published digest", () => {
  test("AC-4: THEME_RESOLVER_SHA256 is the base64 SHA-256 a script-src source would cite", async () => {
    const resolver = await productModule<ResolverModule>(RESOLVER);
    expect(typeof resolver.THEME_RESOLVER, `${RESOLVER} must export THEME_RESOLVER — the resolver's text, named once`).toBe("string");
    expect(resolver.THEME_RESOLVER.trim().length, "a resolver with no code resolves nothing").toBeGreaterThan(0);

    const digest = createHash("sha256").update(resolver.THEME_RESOLVER, "utf8").digest("base64");
    expect(resolver.THEME_RESOLVER_SHA256, `THEME_RESOLVER_SHA256 must be the base64 SHA-256 of THEME_RESOLVER exactly — a 'sha256-…' source citing anything else blocks the product's own script`).toBe(digest);
  });

  test("AC-4: the root document renders exactly that string as its one inline script", async () => {
    const resolver = await productModule<ResolverModule>(RESOLVER);
    const layout = await productModule<LayoutModule>(LAYOUT);
    const scripts = inlineScripts(layout.default({ children: null }));

    expect(scripts.length, `the root document ships exactly one inline script — the pre-paint resolver (root-document.md I-10); it ships ${scripts.length}`).toBe(1);
    expect(scripts[0], "and it is THEME_RESOLVER itself, byte for byte — otherwise the published digest names a script the document does not carry (B-17)").toBe(resolver.THEME_RESOLVER);
  });
});

describe("AC-4: the root document's comments cite law, never the build", () => {
  for (const file of [LAYOUT, RESOLVER]) {
    test(`AC-4: ${file} narrates no increment`, () => {
      // white-box: AC-4(b) — Q-17's rule is about the comment channel itself; comments have no
      // runtime observable, so the lexer's comment reading is the only way to ask.
      const { comments } = lexed(file);
      for (const comment of comments) {
        for (const { pattern, what } of NARRATION) {
          expect(pattern.test(comment), `${file} carries ${what} in a comment (Q-17: comments cite Bible ids, never build organisation): "${comment}"`).toBe(false);
        }
      }
    });
  }
});
