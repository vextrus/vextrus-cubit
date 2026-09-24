// jsdom ships a SYNCHRONOUS XMLHttpRequest, which it serves by blocking on a worker. Playwright bundles
// source-map-support, which on load sees `window` and `XMLHttpRequest` and takes the page for a
// browser: it then fetches source maps by synchronous XHR, and the suite sits idle ~11 s before its
// first test (measured, session 9: the CPU profile is `trySendSyncWorkerRequest`, XMLHttpRequest-impl).
// A jsdom suite that loads Playwright imports this FIRST — ES modules evaluate in import order — and
// the constructor it never uses is gone before Playwright looks for it.
delete (globalThis as Record<string, unknown>)["XMLHttpRequest"];
