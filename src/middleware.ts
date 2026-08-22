/**
 * The request seam that lets the *server* answer `?theme=`.
 *
 * An App Router layout is never handed the query string — only a page is — and `<html>` exists
 * only in the root layout. Left there, the theme could only be applied by a script after the
 * document had already left the server saying `data-theme="light"`, so `GET /design?theme=dark`
 * without JavaScript (a crawler, a reader with scripting off, `curl`) got the light document
 * whatever it asked for. Middleware is the one place Next lets a request's URL reach a layout:
 * it reads `?theme=` off the incoming URL and forwards the resolved value as a request header,
 * which src/app/layout.tsx reads with `headers()` and renders directly onto `<html>`.
 *
 * The response is otherwise untouched — no redirect, no rewrite, no cookie.
 */
import { NextResponse } from 'next/server';
import { THEME_HEADER, resolveTheme } from './app/theme-request';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(THEME_HEADER, resolveTheme(request.nextUrl.searchParams.get('theme')));
  return NextResponse.next({ request: { headers } });
}

/**
 * Documents only. Next's own build output and the favicon carry no theme and gain nothing from
 * a header, and keeping them out of the matcher keeps the static pipeline untouched.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
