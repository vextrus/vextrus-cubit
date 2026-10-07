---
paths:
  - "web/**"
---
# Web commands (from the checkout's root; `npm --prefix web run <script>`)

- `npm --prefix web ci`, then once `npx --prefix web playwright install chromium`. `dev`: 127.0.0.1:5410,
  the shared pieces at `/dev/specimen` (`?lang=en-XB`: the test-only right-to-left language).
- A parallel walk: `VEXTRUS_WEB_PORT` (default 5410) and `VEXTRUS_API_URL` (`/api`'s target, default
  `http://127.0.0.1:8000`) move `dev`; the API reads `VEXTRUS_WEB_PORT` too, for its trusted origins.
- `web.yml`'s checks: `typecheck`, `lint` (the catalogue and logical-CSS lints), `messages:check`, `npm
  --prefix web test`, `build`; and `lint:design-docs`, its own job. `messages:extract` after adding words; a
  backend code's English goes in `web/src/messages/<module>/<submodule>/en.po`. API types:
  `OPENAPI_SCHEMA=<file|URL> npm --prefix web run api:types`.
- A UI ticket walks m0-screens §8 by keyboard itself before its PR: keys, empty routes, focus rings.
- The seeded demo proves a UI ticket's mechanics only; G1's agent layer walks the real sets.
