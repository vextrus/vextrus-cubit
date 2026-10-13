"""Ticket S26-FX10 (session 26, 13 Oct 2026): verify runs exactly CI's harness node command (the same
globs) whenever a changed path is one those node tests can read (under `.claude/`, `scripts/`,
`tools/mod/`, `.github/` or `docs/`), and a committed check keeps verify's globs equal to ci.yml's."""
