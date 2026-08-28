# `cad/`

The extraction seam (L-CAD-01): file formats in, one EntityGraph artifact out, and nothing else.
It is invoked once per drawing revision and never re-opened by the app; everything that reads
meaning runs in TypeScript over the artifact.

```
uv run --project cad vextrus-cad ingest <input.dxf> --out <artifact.json>
```

Exit 0 writes the artifact. An unparseable input exits non-zero, names the file on stderr and
writes nothing to `--out`.

The artifact is EntityGraph v2, mirrored in Zod at `src/core/entitygraph/schema.ts` and in
`vextrus_cad.model` here; both sides parse the committed fixtures under `tests/fixtures/`.
Serialisation is byte-deterministic (UTF-8, LF, sorted keys, two-space indent, one trailing
newline), so those fixtures regenerate identically.

DXF is read by ezdxf (MIT). AGPL PDF libraries are banned from shipped code (L-CAD-04) and
`tests/test_licence.py` enforces it.
