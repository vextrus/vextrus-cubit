# Vextrus — architecture

The decisions are ADRs 0018 and 0020–0023, and the evidence is in docs/research/stack-*.md. This page
is the map a build session reads first.

## The shape
One Django modular monolith (the web process plus worker processes from the same package), one
Postgres, one file store and one React web app. Nothing else until a measurement says otherwise.

```
browser (React SPA) ──REST/OpenAPI──▶ Django + Ninja (web) ──▶ Postgres (data, jobs, events, search)
                                            │                        ▲
                                            └─ enqueue ─▶ worker ────┘──▶ files (FS dev / S3 beta)
                                                           └─ engine (LibreDWG subprocess, ezdxf,
                                                              rules, IfcOpenShell, GLB)
                                            Jev (TypeSafe, US) ◀── platform.jev client
```

## The module map (higher layers import lower; modules on one line are independent)

| Layer | Modules | Own |
|---|---|---|
| 6 | `summary`, `exports`, `assistant`, `revisions` | Project Summary and Target Cost; Excel, PDF and the 3D link; the Level 2 assistant; the Revision Comparison |
| 5 | `boq` | Priced BOQ, Material Schedule |
| 4 | `measurement`, `rates`, `takeoff` | Rule Sets, Measurement Rules, Rod Ratios; Resources, Market Prices, Rate Analyses, Benchmark Rates; Takeoff Steps, Proposals, Confirmations, Questions |
| 3 | `building_model` | Confirmed elements with stable identity, storeys, Storey Bands, grid; IFC and GLB through `engine` |
| 2 | `drawings` | Drawing Sets, Revisions of files, Sheets, Disciplines; the read job; Trace anchors |
| 1 | `projects` | Project, Display Units, market, Target Cost value |
| 0 | `platform` | Tenancy and roles, auth, units and money formatting, storage, job-queue wrapper, the Jev client and its fallback |
| — | `engine` | Pure Python, no Django: `read/`, `recognise/`, `assemble/` |

Each module has the same anatomy: `models.py` and `migrations/` (private); `services.py` and
`schemas.py` (public); `http.py` (the Ninja router); `admin.py`; `tasks.py`; `tests/`.
import-linter enforces the layers, the independence of siblings, the privacy of models, and
`engine`'s isolation.

## Rules a build session follows
- A feature lives in one module. A cross-module feature is two slices: the lower module's service
  first, then the upper module.
- No ORM joins or signals across modules, and no in-process event bus. Slow work is a job.
- Money and quantities are Decimal in SI. Formatting to Display Units and lakh/crore happens only at
  the edge (ADR 0008).
- Every figure carries its Trace. Nothing enters the Priced BOQ unconfirmed (ADR 0007).
- Jev picks among candidates code has found. Code computes every number, and if Jev is unavailable
  the QS picks (ADR 0011).
- Generated files (the OpenAPI schema and TS types) are never committed.
- Each worktree gets its own database, named by an environment variable.

## Stages
Development is native and free; the beta runs in AWS Mumbai; scale grows on measured triggers
(ADR 0023).
