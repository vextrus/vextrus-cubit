// @vitest-environment jsdom
// The root document's theme resolver. R-UI-001 flips one root attribute before first paint, and the
// script that does it is inline — so the only way a CSP can ever admit it is by its own hash, which
// means the source has to be a value the product can hash and a suite can run.
import { createHash } from "node:crypto";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { expect, test } from "vitest";
import RootLayout from "../../src/app/layout";
import { commentsOf, productModule } from "./support/source-facts";

const RESOLVER = "src/app/theme-resolver.ts";
const LAYOUT = "src/app/layout.tsx";

interface ResolverModule {
  THEME_RESOLVER: string;
  THEME_RESOLVER_SHA256: string;
}

/** Every element of a rendered tree, so "the document holds exactly one inline script" is countable. */
function* elementsOf(node: ReactNode): Generator<ReactElement<Record<string, unknown>>> {
  if (Array.isArray(node)) {
    for (const child of node) yield* elementsOf(child as ReactNode);
    return;
  }
  if (!isValidElement(node)) return;
  const element = node as ReactElement<Record<string, unknown>>;
  yield element;
  yield* elementsOf(element.props["children"] as ReactNode);
}

/** The inline scripts the document renders, by the HTML each one carries. */
function inlineScripts(tree: ReactNode): string[] {
  const html: string[] = [];
  for (const element of elementsOf(tree)) {
    if (element.type !== "script") continue;
    const inner = element.props["dangerouslySetInnerHTML"] as { __html?: unknown } | undefined;
    if (typeof inner?.__html === "string") html.push(inner.__html);
  }
  return html;
}

test("AC-4(a): the resolver is a value with a CSP-citable digest, and the document renders that value", async () => {
  const { THEME_RESOLVER, THEME_RESOLVER_SHA256 } = await productModule<ResolverModule>(RESOLVER);

  expect(typeof THEME_RESOLVER, "the resolver is a string the product owns").toBe("string");
  expect(THEME_RESOLVER.length, "an empty resolver resolves nothing").toBeGreaterThan(0);
  expect(THEME_RESOLVER_SHA256, "the digest is the base64 sha256 a `script-src 'sha256-…'` source cites").toBe(
    createHash("sha256").update(THEME_RESOLVER, "utf8").digest("base64"),
  );

  const scripts = inlineScripts(RootLayout({ children: null }));
  expect(scripts.length, "the root document carries exactly one inline script").toBe(1);
  expect(scripts[0], "the script the document renders is the value that was hashed").toBe(THEME_RESOLVER);
});

test("AC-4(a): the resolver flips the attribute when dark is preferred and leaves it alone when it is not", async () => {
  const { THEME_RESOLVER } = await productModule<ResolverModule>(RESOLVER);
  const asked: string[] = [];
  const stub = (matches: boolean): void => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => {
        asked.push(query);
        return { matches, media: query, addEventListener: () => {}, removeEventListener: () => {} };
      },
    });
  };

  // The server renders the light theme; what the resolver does to it is the whole question.
  document.documentElement.setAttribute("data-theme", "light");
  stub(true);
  new Function(THEME_RESOLVER)();
  expect(document.documentElement.getAttribute("data-theme"), "a device that prefers dark is painted dark before first paint").toBe("dark");
  expect(asked.some((query) => query.includes("prefers-color-scheme")), "the flip is decided by the OS preference, not by storage").toBe(true);

  document.documentElement.setAttribute("data-theme", "light");
  stub(false);
  new Function(THEME_RESOLVER)();
  expect(document.documentElement.getAttribute("data-theme"), "a device that does not prefer dark keeps the server's own answer").toBe("light");
});

test("v22 §9.1: the served ground is dark, and the instrument is a capability the installation grants", async () => {
  const { THEME_INSTRUMENT_ATTRIBUTE } = (await productModule<Record<string, string>>(RESOLVER)) as unknown as {
    THEME_INSTRUMENT_ATTRIBUTE: string;
  };
  const html = [...elementsOf(RootLayout({ children: null }))].find((element) => element.type === "html");
  expect(html?.props["data-theme"], "the Bible's ground is dark, so dark is what the server renders (R-UI-001)").toBe("dark");
  // The journeys' stage arms it by name; a document that did not opt in must not read the query
  // string at all, or a URL would be a capability.
  expect(typeof THEME_INSTRUMENT_ATTRIBUTE, "the instrument attribute is a value the document and the resolver share").toBe("string");
});

test("v22 §9.1: the resolver settles BOTH ways, so the Surveyor's colour-scheme instrument works in both directions", async () => {
  const { THEME_RESOLVER } = await productModule<ResolverModule>(RESOLVER);
  const stub = (matches: boolean): void => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({ matches, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
    });
  };
  // The server now renders dark. A device that prefers light must be *written* light — the earlier
  // resolver only ever wrote "dark", so half of `page.emulateMedia({ colorScheme })` did nothing and
  // a light capture of a dark-default product would have come back dark.
  document.documentElement.setAttribute("data-theme", "dark");
  document.documentElement.removeAttribute("data-ui-instrument");
  document.cookie = "cx-theme=; max-age=0";
  stub(false);
  new Function(THEME_RESOLVER)();
  expect(document.documentElement.getAttribute("data-theme"), "a device that prefers light is painted light").toBe("light");

  stub(true);
  new Function(THEME_RESOLVER)();
  expect(document.documentElement.getAttribute("data-theme"), "a device that prefers dark is painted dark").toBe("dark");
});

test("v22 §9.1: a stored choice outranks the device, and the instrument's flag outranks both — but only where it is armed", async () => {
  const { THEME_RESOLVER } = await productModule<ResolverModule>(RESOLVER);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }),
  });

  document.cookie = "cx-theme=light";
  document.documentElement.removeAttribute("data-ui-instrument");
  document.documentElement.setAttribute("data-theme", "dark");
  new Function(THEME_RESOLVER)();
  expect(document.documentElement.getAttribute("data-theme"), "the person's own answer outranks the device").toBe("light");

  // jsdom's location carries no query here, so the flag is proven by the gate it has to pass: an
  // unarmed document never reads the query string, which is what makes the flag a capability.
  expect(THEME_RESOLVER.includes("__theme"), "the flag the Surveyor drives exists in the resolved order").toBe(true);
  expect(
    THEME_RESOLVER.indexOf("data-ui-instrument") < THEME_RESOLVER.indexOf("__theme"),
    "the query string is read only after the armed attribute is found",
  ).toBe(true);

  document.cookie = "cx-theme=; max-age=0";
});

test("AC-4(b): neither file narrates the build in its comments", () => {
  for (const file of [LAYOUT, RESOLVER]) {
    // white-box: AC-4(b) — Q-17 bans process artifacts in src/ comments; a comment has no runtime
    // observable at all, so its text is the only place the criterion can be judged.
    for (const comment of commentsOf(file)) {
      expect(/\binc-[a-z0-9]/i.test(comment), `${file} cites a build id: ${comment}`).toBe(false);
      expect(/\bincrements?\b/i.test(comment), `${file} narrates the build organisation: ${comment}`).toBe(false);
    }
  }
});
