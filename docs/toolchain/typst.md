# Typst — the pin, the digest, and the recipe (C-06, SEAM-DOC)

The Bible pins Typst at **0.15.x, "pinned by version + sha256, subprocess"** (`docs/specs/cubit.bible.xml:307`),
and names it as the sole renderer behind SEAM-DOC: every issued PDF — bill + certificate, BBS, rate
analysis, bid book, marked-up drawings. R-SPINE-040 goes further and demands that *the same payload
renders byte-identical*, which is an assertion about a specific renderer build, not about a version
range. So the pin is two facts, not one: the version `checkup` can ask the binary for, and the
digest of the artifact that version was installed from.

The Bible states the *rule* (version + sha256) but no literal digest — it could not, because the
digest belongs to a release that did not exist when the clause was written. This file is that
digest's home.

## The pin

| fact | value |
| --- | --- |
| version | `0.15.1` |
| target | `x86_64-unknown-linux-musl` |
| release | <https://github.com/typst/typst/releases/tag/v0.15.1> (published 2026-07-17) |
| asset | `typst-x86_64-unknown-linux-musl.tar.xz` (17,462,992 bytes) |
| asset sha256 | `a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c` |
| binary sha256 | `29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237` |
| `typst --version` | `typst 0.15.1 (9dfd3a08)` |

`package.json`'s `cubit.tools.typst` holds the version alone, because that is the one fact
`scripts/checkup.mjs` can verify by running the tool (`pinnedTool`, an exact string compare — a
machine on any other version is refused). The two digests above are how an installer proves it
fetched the build this pin means, before the version is ever asked for.

## The recipe

Both digests are checked before anything is put on `PATH`; a mismatch is a stop, not a warning.

```sh
VERSION=0.15.1
TARGET=x86_64-unknown-linux-musl
ASSET_SHA256=a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c
BINARY_SHA256=29273eaa04f6d00edd0c2bec578f565fc9c65be856bfbffc894567c68ed0b237

cd "$(mktemp -d)"
curl -fsSL -o typst.tar.xz \
  "https://github.com/typst/typst/releases/download/v${VERSION}/typst-${TARGET}.tar.xz"
echo "${ASSET_SHA256}  typst.tar.xz" | sha256sum -c -
tar -xJf typst.tar.xz
echo "${BINARY_SHA256}  typst-${TARGET}/typst" | sha256sum -c -
install -m 0755 "typst-${TARGET}/typst" ~/.local/bin/typst
typst --version   # typst 0.15.1 (9dfd3a08)
```

The musl build is deliberate: it is statically linked, so the renderer does not inherit a glibc
version from whatever host the production image happens to be built on — and byte-identical output
(R-SPINE-040) is a promise that a dynamically-linked renderer cannot keep across hosts. The Bible's
production image (`node:24-slim + uv + typst + libredwg`) installs the same asset by the same
digest.

## What moved, and on what machine

This pin was `0.13.1` until v22 Wave B. 0.13.1 was what the development machine happened to carry
from the foundation series; it contradicts the Bible's `0.15.x`, and the contradiction had to be
settled *before* M3 renders its first golden PDF, not after — a golden committed under 0.13.1 is a
golden that the Bible's own renderer would fail.

The development machine now carries `0.15.1` at `~/.local/bin/typst`, installed by the recipe above
and verified against both digests. The superseded binary is kept beside it as
`~/.local/bin/typst-0.13.1` (sha256 `61f743dccaaf7d763072ae046ad71f2303752e78d499d319043248f894602f45`),
so the move is one `install -m 0755 ~/.local/bin/typst-0.13.1 ~/.local/bin/typst` away from being
undone — useful while other worktrees on this machine still pin the old version in their own
`package.json` and will report a red `typst` line from `pnpm checkup` until this branch merges.
`pnpm verify` is unaffected: checkup is not one of its lanes.

No product code reads Typst yet — there is no `src/core/documents/`, no `documents/` template tree
and no golden PDF in the tree — so this move changes the machine and the pin, and nothing else.
