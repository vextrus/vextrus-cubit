"""Ticket S14-F2 (issues #450, #397): root-only tests are skipped as root, `verify` reports a
failure listed in `.github/flaky-root.txt` as root-only, and the guard test ignores a leaked
`CLAUDE_CODE_REMOTE`."""
