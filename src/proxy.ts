// The per-request Content-Security-Policy, minted once per answer (Q-12). This is Next 16's proxy
// convention — the file the framework runs before every matched request — and it is the ONE home of
// the CSP: the five static headers that carry no per-request value live in `next.config.ts`'s
// `headers()`, and nothing else in the tree writes a `Content-Security-Policy` (B-17).
//
// The policy is nonce-based, so it admits Next's own inline bootstraps (`self.__next_f.push`)
// without `'unsafe-inline'`. Next reads that nonce at render time off the REQUEST's
// `content-security-policy` header, so the same policy is set on a cloned request header set and
// forwarded, not only answered.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { THEME_RESOLVER_SHA256 } from "./app/theme-resolver";

/** The header the policy travels on, request and response alike. */
const CSP_HEADER = "Content-Security-Policy";

/** A nonce is 16 random bytes, base64-encoded — the length the CSP specification calls sufficient. */
const NONCE_BYTES = 16;

/**
 * The policy this product serves, for one answer's nonce.
 *
 * `script-src` admits three things and no more: the app's own bundles (`'self'`), Next's inline
 * runtime bootstraps (the nonce) and the one product-authored inline script, the pre-paint theme
 * resolver, by the digest of its own source. That digest is not transcribed here — it is the value
 * `src/app/theme-resolver.ts` derives from the very string the document renders (B-17), so the
 * policy and the script can never drift apart.
 *
 * `style-src` keeps `'unsafe-inline'`: the root document and the Datum token surfaces carry inline
 * `style` attributes, which a style nonce cannot cover. `img-src` admits `data:` and `blob:` for
 * the viewer's rasters and `worker-src 'self'` covers the Turbopack-built spatial worker, which is
 * served same-origin. Everything else the product fetches — the tRPC, upload, viewer and events
 * lanes, and signed thumbnails under `/storage/v1/…` — is same-origin, so `connect-src 'self'` and
 * `default-src 'self'` are the whole allow list.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'sha256-${THEME_RESOLVER_SHA256}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Every matched answer, given its policy.
 *
 * The same policy string is set twice on purpose and they are one value: on the cloned REQUEST
 * headers, which is where `app-render` looks to stamp `nonce=` onto the scripts it emits, and on
 * the RESPONSE, which is what the browser enforces. No other header is set here — the static five
 * are `next.config.ts`'s home.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = randomBytes(NONCE_BYTES).toString("base64");
  const policy = contentSecurityPolicy(nonce);

  const headers = new Headers(request.headers);
  headers.set(CSP_HEADER, policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(CSP_HEADER, policy);
  return response;
}

/**
 * Which answers carry the policy: all of them but the two immutable static prefixes. `/_next/static`
 * and `/_next/image` are fingerprinted assets and optimised images — they run no script and carry no
 * document, so minting a nonce for them would only defeat their caching. They still receive the five
 * static headers, which `next.config.ts` states on `/:path*`.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
