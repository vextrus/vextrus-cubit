# The upload doors' named permission — the founder's call

**Status:** analysis only. No code changed. Raised by P1c (§N, "the upload doors bind tenant only").

## What is shipped

`src/app/api/upload/answers.ts` (`admit`) asks the one guard — `authorize({ userId, projectId })` —
and deliberately names **no permission**: `POST /api/upload` and `/api/upload/[uploadId]` admit any
member of the workspace the project belongs to, whatever that person holds on the project. The
tenant hole P1c closed stays closed (the workspace is the project's own, read as the system); what
is open is the *standing* question. `admitForUpload` can bind only the upload's workspace:
`uploads.project_id` is on the row but the resolver does not publish it.

## The corpus that pins it

`tests/spine/uploads/refusals.test.ts` (live database, AC-3): opening an upload against **another
workspace's project**, and against a project id that is nobody's, is refused
`WORKSPACE_PERMISSION_NOT_HELD` at **403**. Nothing exercises a member of the *same* workspace who
holds no role on the project — exactly the case the door admits. The Bible states the requirement
(R-SPINE-020) and says nothing about a permission; L-ACT-03's closed enum cuts none for storing a
file, and `ACT_PERMISSION` has no upload act to map.

## What changes if a named permission is asked

MEASURE is the only defensible candidate (L-REG-03's reason for CONFIRM_DISCIPLINE moving MEASURE,
and what `requestSheetsFor` now asks). Then: a workspace member with no project role can no longer
upload — today's normal path for a REVIEWER or an ESTIMATOR gathering files; the guard answers
`PERMISSION_NOT_HELD`, so either the door translates it to its shipped
`WORKSPACE_PERMISSION_NOT_HELD` (403 unchanged, but that code's meaning widens to "you are in, and
you may not") or a second code reaches a transport whose answer set is closed; and AC-3 still passes
— it tests a stranger — so the change would ship **unmeasured** unless the role-less member is added
beside it.

## The two lawful options

1. **Keep it, and say so.** Record an Interpretation that uploading is a *workspace* capability: the
   file is stored, and every act on it (ingest, confirm, measure) already asks MEASURE at its own
   door. Cost: one Interpretation, no amendment, the corpus stands.
2. **Name it, with an amendment.** Amend L-ACT-03 to cut a permission over storing a file (or to say
   MEASURE covers it), publish the upload's project so `admitForUpload` can bind one, and add the
   same-workspace-no-role case to the corpus. Cost: a Bible amendment with its recorded reason and a
   decision about what the 403 now means.

**Not lawful here:** narrowing the door inside a sweep — a shipped refusal code's meaning does not
change without the founder.
