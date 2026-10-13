"""Ticket S26-FX11 (session 26, 13 Oct 2026): verify runs CI's slowed-fake web pass. CI's web job runs
`npm test` twice, once plain and once with `VITE_FAKE_API_LATENCY_MS` (web.yml, "Vitest with the fake
API slowed"); verify ran only the plain pass, so a latency race passed verify and failed only in CI."""
