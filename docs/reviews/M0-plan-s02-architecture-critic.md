# The revised M0 plan (session 02), attacked: the architecture critic

28 Sep 2026. Read-only; database tests on the local PostgreSQL 16.15 inside rolled-back transactions (not
re-run on 18). P = docs/plans/M0.md, DM = docs/data-model.md, S = docs/specs/M0.md. Written by the
orchestrator from the agent's report.

## Critical
**A1 · The row-level security change to ticket 02 does not work, and opens a cross-tenant write.** Under
FORCE, a SECURITY DEFINER function owned by the table owner is still filtered, so the "Which Developer?"
chooser returns nothing (measured: 0 rows; owned by a BYPASSRLS role it works); Membership's `user_id`
clause is not limited to reading (WITH CHECK defaults to USING), so the app role inserted itself as `md`
into another Developer (measured, succeeded); three more cross-tenant reads have no path (staff picking a
Developer in the admin; accepting an invitation, whose Membership has no user yet; the global `User`
table exposing every tenant's users' email and phone); the admin pick lets staff create their own
Membership without an invitation, against ADR 0034. Only superusers or BYPASSRLS roles can create
BYPASSRLS roles; Cloud SQL's `postgres` user is not a superuser, so a bypass role on the beta is
unverified. Evidence P:449-458, 380-382, 460-461; DM:231-232. Fix: every widening clause (Library, user)
its own `FOR SELECT` policy, writes own-tenant only; each cross-tenant read a named narrow function with a
test (`user_developers`, `staff_developers`, `invitation_by_token`), `search_path` pinned, EXECUTE only to
`vextrus_app`; drop FORCE (A2) or keep it and use a join-free `app.member_tenants` array setting
(measured as an index condition); staff may create only a Developer's first MD invitation; tests that the
cross-tenant insert fails and that a tenant cannot write the Library; the global User table's exposure
recorded as an accepted risk.

## Major
**A2 · FORCE makes migrations blind; the bypass role may not exist; "per transaction" is not wired.** With
FORCE, the owner adding a foreign key with no tenant set validates nothing (measured: `convalidated = t`
over an orphan) and with a tenant set falsely fails against Library rows; NO FORCE → add key → FORCE in one
transaction validated correctly. Django middleware runs outside the transaction, so a transaction-local
`set_config` there is lost before the view; TRUNCATE bypasses RLS, and pytest-django's flush will tempt a
TRUNCATE grant into production. FORCE is not an owner ruling (ADR 0034 requires a policy and a non-owner
app role). Fix (recommended): ENABLE without FORCE, `vextrus` the migration role and owner of the few
SECURITY DEFINER functions; web and worker refuse to start unless `current_user = vextrus_app` (no
BYPASSRLS, owning no table), tested in CI; the tenant middleware opens `transaction.atomic()` and sets all
settings `is_local = true`, 09's step runner likewise; no TRUNCATE grant, tests flush through an owner
alias, a test asserting the grant's absence; 01c's `prepare_postgres` runs `db-roles.sql` itself.

**A3 · The sandbox and the ezdxf exception cannot run as specified here.** Python 3.14, `dwgread` and .NET
live under the owner's home, which the sandbox does not mount; an offline source build of ezdxf needs its
unpinned build backend (uv does not lock build dependencies: issue #5190 open; manual build-dependency
hashes merged 15 Sep 2026); ezdxf ships a `py3-none-any` wheel; the cloud rebuild on 3.14 and 18 is
untested and uv's Python download host is not on the allowlist item. Fix: an owner script installs the
toolchain under `/opt/vextrus/{python,libredwg,dotnet}`, bound read-only, `test_toolchain` asserting the
paths; a `toolchain-ezdxf` workflow builds the cp314 wheel once per pin with pinned, hashed build
constraints, installed by hash (the check then builds nothing); or the pure wheel until upstream's (the
owner's call); rebuild one cloud environment on 3.14 and 18 with a throwaway setup before wave 0.

**A4 · One drop folder collides; "not applicable" can be self-posted; three posting runs measure
nothing.** Every run clears one shared folder while waves 3–4 run pipelines at once; a `pull_request`
workflow runs the PR's copy and the ruleset is not pinned to the owner's App; 14, 21a, 21b are engine PRs
whose code the harness never runs before 21c. Fix: `--no-post` runs write to the session's scratch;
posting runs use `/srv/vextrus-drop/<run-id>/`, one at a time under a lock; the poster posts only when the
run's commit equals the PR's head; the not-applicable workflow on `pull_request_target`, reading only the
changed-file list; until 21c the engine-path list and code hash cover `engine/`, `tools/acadsharp-dump/`,
`toolchain/` and `uv.lock`; 21c widens both.

**A5 · Message codes have no owner across waves and cross the layers.** 07, 09, 14, 19a add codes whose
English lives in later web tickets' catalogues, turning unrelated PRs red; DomainEvent act codes belong to
`takeoff` but platform's activity API cannot import them; 07 and 09 share `platform/schemas/messages.py`;
03's type generation edits 01b's `web.yml`. Fix: each backend ticket words its own codes in the same PR in
`web/src/messages/<module>/en.po` (stubs by 01b), feature catalogues keeping UI chrome only;
`vextrus/api.py` assembles the event-code enum from each module's `messages.py`; messages a package with
one submodule per ticket; 03's `web.yml` edit named as a shared edit.

**A6 · Ticket 28's "every table" decides ahead of M1; its references do not close; Library identity is
unsettled.** Empty tables gain nothing from "no key on a populated table", and M1 completes them anyway;
the widening beyond ADR 0037 is a delegated default that pre-empts M1 ticket 08; ViewPlacement lacks a
Building; ElementState cannot refer to ModelVersion; Library tables keyed by bare keys fail the
tenant-led index rule or break foreign keys once two Market Libraries exist; FamilyAttribute's reference
to a versioned definition is unstated. Fix: one rule in DM §2 (every Library table's identity is
`(tenant_id, key)`, a tenant row references a Library row by id; Market `code` globally unique,
allowlisted); narrow 28 to the owner's ruling (Attribute Definition, Family Attribute, Record,
classification systems and references, Element Relation, plus the Element Family and Element rows they
point to); the rest back to M1 ticket 08.

**A7 · Two contracts force a rewrite in M1 or break wave 1.** `sheets.find(artefact, file_discipline)`
takes no conventions though M1's `recognise` takes a Drafting Profile and the export records none; 06b's
export needs 04's ReadArtefact fields, unfixed; `types.py` carries anchors from an `anchor.py` not yet
written; "peak RSS per file" in one process is impossible (`ru_maxrss` only rises). Fix: `SheetConventions`
(and `ViewConventions`) in 06b's `types.py`, shaped as the sheet part of a Drafting Profile's conventions;
`find(artefact, file_discipline, conventions)`; the export gains `conventions_applied`; the ReadArtefact
summary fields, anchor class names and "one child process per file, rusage from `wait4`" fixed in the
contracts; 18 may not change the buffer format's version while 16 decodes it in the same wave.

## Minor
**A8 · Guest and Project scope rest on each endpoint remembering `require`.** Fix: 07 ships an operation
decorator declaring each endpoint's act; a test walks every Ninja operation and fails on any without one.
**A9 · Library rows seeded by data migrations reading live code** (19a's Check catalogue). Fix: an
idempotent `sync_library` command run at deploy and in test setup; only the static Market seed a data
migration.
**A10 · The Building seam leaks.** The engine knows no Building (19b would flag each Building's "S-101"
against the other's in M4); Sheet identity (set, discipline, number) rejects a second Building's S-101;
StepProgress unique on (project, building, step) with the Building empty admits duplicates; DM allows an
empty `building_id` for Site sheets while the plan assigns every sheet. Fix: candidates carry an opaque
group key (the file's Building); Sheet identity (set, building, discipline, number) and
`DrawingFile.building_id`; StepProgress `nulls_distinct=False`; say which Site sheets exist.
**A11 · The tail is serial for no reason.** 21a waits for 19a only to raise `file_misread`; 21c raises the
others and ADR 0029 has `takeoff` raise it. Fix: 21a records the quarantine through `drawings`, 21c raises
the Question, 21a moves to wave 4; fix `drawings`' services for 19a and 21a–c in the contracts.
**A12 · What M0 could drop.** 28's widening (A6); the money type and formatter (no M0 table or screen holds
money: the owner's call under Q15); ezdxf's source build (A3, the owner's call under Q18); the three posting
runs that measure nothing (A4). Keep the test-only second Market: M0's only proof that markets are data.

## Verdict
Re-signable after fixes, but not before A1 and A2 are resolved in the text (ticket 02 and DM §2); A3–A7
are plan edits with no change of scope; A8–A12 go into ticket bodies. What holds: the wave shape, disjoint
ownership (but the message files), one migration ticket per module per wave, `ids.new_id()`, Python 3.14
with PostgreSQL 18.6 in CI. Earlier findings reopened: old A8 (RLS stalls 02), A5 (shared files) and A12
(the toolchain under home).
