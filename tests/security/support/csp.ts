/**
 * Acceptance support for inc-120 (the security headers).
 *
 * Everything here reads a POLICY — the text of a `Content-Security-Policy` header the product
 * minted — and never the source that minted it. The proxy is imported as a module and called with a
 * `NextRequest`, exactly as Next calls it; the config is imported for its exported value. The one
 * filesystem question the criteria ask (AC-2: `src/middleware.ts` does not exist) is asked of the
 * checkout's shape, not of any file's text.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";

/** The declared homes (increment interfaces / test contract). */
export const PROXY_MODULE = "src/proxy.ts";
export const MIDDLEWARE_MODULE = "src/middleware.ts";
export const NEXT_CONFIG_MODULE = "next.config.ts";
export const LAYOUT_MODULE = "src/app/layout.tsx";
export const THEME_RESOLVER_MODULE = "src/app/theme-resolver.ts";

/** The address the criteria build their requests on (AC-1) — the journeys' stage. */
export const STAGE_ORIGIN = "http://127.0.0.1:3211";

/** The routes AC-1 drives the proxy at. */
export const POLICY_ROUTES = ["/", "/sign-in", "/api/trpc/spine.auth.listSessions"] as const;

/** The header the policy travels on, and the header a shadow policy would travel on (out of scope). */
export const CSP_HEADER = "Content-Security-Policy";
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

/** The header Next carries a forwarded request header on (AC-2). */
export const FORWARDED_CSP_HEADER = "x-middleware-request-content-security-policy";

/** A response, seen through the only surface these assertions need. */
export interface ResponseLike {
  headers: { get(name: string): string | null };
}

export interface ProxyModuleShape {
  proxy?: unknown;
  contentSecurityPolicy?: unknown;
  config?: unknown;
}

export interface LayoutModuleShape {
  default?: unknown;
  dynamic?: unknown;
}

export interface ThemeResolverModuleShape {
  THEME_RESOLVER?: unknown;
}

export interface HeaderPair {
  key?: unknown;
  value?: unknown;
}

export interface HeaderRule {
  source?: unknown;
  headers?: unknown;
}

export interface NextConfigShape {
  headers?: unknown;
}

export const loadProxy = (): Promise<ProxyModuleShape> => productModule<ProxyModuleShape>(PROXY_MODULE);
export const loadLayout = (): Promise<LayoutModuleShape> => productModule<LayoutModuleShape>(LAYOUT_MODULE);
export const loadThemeResolver = (): Promise<ThemeResolverModuleShape> => productModule<ThemeResolverModuleShape>(THEME_RESOLVER_MODULE);

/** The Next config's default export — the home of the five static headers (AC-3). */
export async function loadNextConfig(): Promise<NextConfigShape> {
  const module = await productModule<{ default?: unknown }>(NEXT_CONFIG_MODULE);
  expect(module.default, `${NEXT_CONFIG_MODULE} must have a default export — Next reads the config from it`).toBeTypeOf("object");
  return module.default as NextConfigShape;
}

/** Whether the checkout holds a file at all (AC-2 asks for the absence of one). */
export function checkoutHolds(relative: string): boolean {
  return existsSync(join(REPO_ROOT, relative));
}

/** The proxy, asserted to be the exported function the interface names. */
export async function shippedProxy(): Promise<(request: unknown) => ResponseLike> {
  const module = await loadProxy();
  expect(typeof module.proxy, `${PROXY_MODULE} must export \`proxy(request: NextRequest): NextResponse\` — Next 16's proxy convention`).toBe("function");
  return module.proxy as (request: unknown) => ResponseLike;
}

/** The policy builder, asserted to be the exported function the interface names. */
export async function shippedPolicyBuilder(): Promise<(nonce: string) => string> {
  const module = await loadProxy();
  expect(typeof module.contentSecurityPolicy, `${PROXY_MODULE} must export \`contentSecurityPolicy(nonce: string): string\``).toBe("function");
  return module.contentSecurityPolicy as (nonce: string) => string;
}

/** A header off a response, asserted present — the message names the route it was asked for. */
export function headerOf(response: ResponseLike, name: string, where: string): string {
  const value = response.headers.get(name);
  expect(value, `${where}: no ${name} header is set on the answer`).toBeTypeOf("string");
  return value as string;
}

/**
 * A policy as its directives: name (lower-cased, as CSP names are case-insensitive) → its sources,
 * in the order the policy states them. A directive stated twice is a defect of the policy — the
 * second is ignored by every UA — so it is reported rather than merged.
 */
export function directivesOf(policy: string, where: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const part of policy.split(";")) {
    const tokens = part.trim().split(/\s+/).filter((token) => token.length > 0);
    if (tokens.length === 0) continue;
    const name = (tokens[0] as string).toLowerCase();
    expect(found.has(name), `${where}: the policy states ${name} twice — a repeated directive is ignored by the browser`).toBe(false);
    found.set(name, tokens.slice(1));
  }
  return found;
}

/** One directive's sources, asserted stated at all. */
export function sourcesOf(directives: Map<string, string[]>, name: string, where: string): string[] {
  const sources = directives.get(name);
  expect(sources, `${where}: the policy states no ${name} directive (it holds: ${[...directives.keys()].join(", ")})`).toBeTruthy();
  return sources as string[];
}

/** A base64 payload, as a CSP source spells one — `+`, `/` and up to two `=` of padding. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The sources of a directive that carry a keyword prefix, e.g. `'nonce-` or `'sha256-`. */
function prefixed(sources: string[], prefix: string): string[] {
  return sources.filter((source) => source.startsWith(`'${prefix}`) && source.endsWith("'"));
}

/** The payload of a `'<keyword>-<base64>'` source, asserted to be base64 at all. */
export function payloadOf(source: string, prefix: string, where: string): string {
  const payload = source.slice(prefix.length + 2, -1);
  expect(BASE64.test(payload), `${where}: ${source} is not a '${prefix}-<base64>' source`).toBe(true);
  return payload;
}

/** The one `'nonce-…'` source a directive carries, asserted to be exactly one. */
export function theNonceSource(sources: string[], where: string): string {
  const nonces = prefixed(sources, "nonce-");
  expect(nonces.length, `${where}: script-src must carry exactly one 'nonce-…' source (it carries: ${sources.join(" ")})`).toBe(1);
  return nonces[0] as string;
}

/** The one `'sha256-…'` source a directive carries, asserted to be exactly one. */
export function theHashSource(sources: string[], where: string): string {
  const hashes = prefixed(sources, "sha256-");
  expect(hashes.length, `${where}: script-src must carry exactly one 'sha256-…' source (it carries: ${sources.join(" ")})`).toBe(1);
  return hashes[0] as string;
}

/** What one accepted policy states, for the criteria that go on to compare two of them. */
export interface AcceptedPolicy {
  /** The `'nonce-<base64>'` source, as the policy spells it. */
  nonceSource: string;
  /** Its base64 payload — what AC-2 decodes. */
  nonce: string;
  /** The `'sha256-<base64>'` source, as the policy spells it. */
  hashSource: string;
}

/** The sources `img-src` and `worker-src` may draw from (AC-1). */
const FETCHABLE = new Set(["'self'", "data:", "blob:"]);

/**
 * AC-1, as one reading of a policy: every directive the criterion names, stated with exactly the
 * sources it names. Nothing here is a transcription of a policy the product happens to mint today —
 * the nonce and the hash are found by their shape, and the whole check is driven by the criterion's
 * own enumeration.
 */
export function assertAcceptedPolicy(policy: string, where: string): AcceptedPolicy {
  const directives = directivesOf(policy, where);
  const exactly = (name: string, sources: string[]): void => {
    expect([...sourcesOf(directives, name, where)].sort(), `${where}: ${name} must be exactly \`${sources.join(" ")}\``).toEqual([...sources].sort());
  };

  exactly("default-src", ["'self'"]);
  exactly("style-src", ["'self'", "'unsafe-inline'"]);
  exactly("connect-src", ["'self'"]);
  exactly("font-src", ["'self'"]);
  exactly("frame-ancestors", ["'none'"]);
  exactly("object-src", ["'none'"]);
  exactly("base-uri", ["'self'"]);
  exactly("form-action", ["'self'"]);

  const script = sourcesOf(directives, "script-src", where);
  expect(script.includes("'self'"), `${where}: script-src must hold 'self' (it holds: ${script.join(" ")})`).toBe(true);
  expect(script.includes("'unsafe-inline'"), `${where}: script-src must never hold 'unsafe-inline' — the inline resolver is admitted by hash`).toBe(false);
  expect(script.includes("'unsafe-eval'"), `${where}: script-src must never hold 'unsafe-eval'`).toBe(false);
  const nonceSource = theNonceSource(script, where);
  const hashSource = theHashSource(script, where);
  expect([...script].sort(), `${where}: script-src is 'self', the nonce and the one hash, and nothing else (the increment's interface)`).toEqual([...new Set(["'self'", nonceSource, hashSource])].sort());

  for (const name of ["img-src", "worker-src"]) {
    const sources = sourcesOf(directives, name, where);
    expect(sources.includes("'self'"), `${where}: ${name} must hold 'self' (it holds: ${sources.join(" ")})`).toBe(true);
    const foreign = sources.filter((source) => !FETCHABLE.has(source));
    expect(foreign, `${where}: ${name} may draw only from 'self', data: and blob:`).toEqual([]);
  }

  return { nonceSource, nonce: payloadOf(nonceSource, "nonce", where), hashSource };
}

/**
 * A Next matcher pattern as a regular expression over a pathname, supporting the two forms Next
 * documents: a parenthesised raw group (`/((?!_next/static|_next/image).*)`) and path-to-regexp
 * parameters (`/:path*`). A group is copied through verbatim — it IS a regular expression — while
 * everything outside one is literal text, with `:name`, `:name*`, `:name+` and `*` translated.
 */
export function matcherRegExp(pattern: string, where: string): RegExp {
  let out = "";
  let at = 0;
  let afterGroup = false;
  while (at < pattern.length) {
    const char = pattern[at] as string;
    if (char === "(") {
      let depth = 0;
      let end = at;
      for (; end < pattern.length; end += 1) {
        if (pattern[end] === "(") depth += 1;
        else if (pattern[end] === ")") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      expect(depth, `${where}: the matcher pattern ${JSON.stringify(pattern)} has an unbalanced group`).toBe(0);
      out += pattern.slice(at, end + 1);
      at = end + 1;
      afterGroup = true;
      continue;
    }
    if (afterGroup && (char === "*" || char === "+" || char === "?")) {
      out += char;
      at += 1;
      continue;
    }
    afterGroup = false;
    if (char === ":") {
      const parameter = /^:[A-Za-z0-9_]+([*+?]?)/.exec(pattern.slice(at));
      if (parameter !== null) {
        const modifier = parameter[1] as string;
        out += modifier === "*" ? "(?:.*)" : modifier === "+" ? "(?:.+)" : modifier === "?" ? "(?:[^/]*)" : "(?:[^/]+)";
        at += parameter[0].length;
        continue;
      }
    }
    if (char === "*") {
      out += "(?:.*)";
      at += 1;
      continue;
    }
    out += char.replace(/[.+?^${}|[\]\\]/g, "\\$&");
    at += 1;
  }
  return new RegExp(`^${out}$`);
}

/** The matcher's patterns, as Next accepts them: a string, an array of strings, or `{ source }`. */
export function matcherPatterns(matcher: unknown, where: string): string[] {
  const entries = Array.isArray(matcher) ? matcher : [matcher];
  return entries.map((entry) => {
    const pattern = typeof entry === "string" ? entry : (entry as { source?: unknown } | null)?.source;
    expect(pattern, `${where}: every matcher entry is a pattern string or a { source } object (got ${JSON.stringify(entry)})`).toBeTypeOf("string");
    return pattern as string;
  });
}

/** Whether the proxy runs for a pathname — the union of its matcher's patterns. */
export function matcherRuns(patterns: string[], pathname: string, where: string): boolean {
  return patterns.some((pattern) => matcherRegExp(pattern, where).test(pathname));
}
