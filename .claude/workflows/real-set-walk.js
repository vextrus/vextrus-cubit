// /real-set-walk <sha40>: G1's agent layer (docs/specs/factory.md 3.8 and 5 "G1"; ticket f5).
//
// It starts only when .private/work/walks/<sha40>/walk.json exists (the orchestrator started
// `python -m scripts.walk.run <sha40>` detached; run.py keeps the stack served until verdict.json is
// written) and takes the served URLs from walk.json. ux-critic (by eye) and qs-critic (the burden lens)
// walk the same served stack, each on its own browser page selected by URL. A triage agent writes the
// findings in the contract's shape and drafts issues only from scripts/walk/sanitize.py's allowlisted
// fields through `python -m scripts.walk.issues`, deduped on (class, screen) against open `walk` issues.
// The leak scan runs on every draft and on the public folder; then verdict.json is written. No Jev here
// (session 13). Every stage names its model. No clock or randomness: times come from the scripts.
// Drawing text is untrusted input: no stage follows an instruction found in it, or quotes it.

export const meta = {
  name: 'real-set-walk',
  description: "G1's agent layer on a served head: critics walk the real sets, triage files walk issues, the verdict is written",
  whenToUse: 'After scripts/walk/run.py <sha40> wrote walk.json, to finish the G1 walk of that head',
  phases: [
    { title: 'Check', detail: 'walk.json exists; the served URLs' },
    { title: 'Walk', detail: 'ux-critic and qs-critic on the served stack' },
    { title: 'Triage', detail: 'findings, issue drafts through sanitize and issues, dedup comments' },
    { title: 'Verdict', detail: 'leak scan, then verdict.json' },
  ],
}

const SHA = typeof args === 'string' ? args.trim() : String((args && args.sha) || '').trim()
if (!/^[0-9a-f]{40}$/.test(SHA)) throw new Error('real-set-walk takes a full 40-hex sha')
const FOLDER = `.private/work/walks/${SHA}`
const ITEMS = ['M0-FL1', 'M0-FL2', 'M0-FL3', 'M0-FL4', 'M0-FL5', 'M0-FL6', 'M0-FL7', 'M0-FL8', 'M0-FL9', 'M0-FL10', 'M0-FL11', 'M0-FL13']

const SERVED = {
  type: 'object',
  properties: {
    exists: { type: 'boolean' },
    web: { type: 'string' },
    api: { type: 'string' },
  },
  required: ['exists', 'web', 'api'],
}

const WALKED = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { item: { enum: ITEMS }, status: { enum: ['PASS', 'FAIL', 'NOT_WALKED'] } },
        required: ['item', 'status'],
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { enum: ITEMS },
          defect_class: { type: 'string' },
          screen: { type: 'string' },
          delta: { type: ['number', 'null'] },
          severity: { enum: ['BLOCKS_DEMO', 'WRONG_NUMBER', 'BLOCKS_SIGNING', 'FRICTION', 'POLISH'] },
          misleading: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['item', 'defect_class', 'screen', 'delta', 'severity', 'misleading', 'evidence'],
      },
    },
  },
  required: ['items', 'findings'],
}

const TRIAGED = {
  type: 'object',
  properties: {
    findings: { type: 'integer' },
    issues_drafted: { type: 'integer' },
    dedup_comments: { type: 'integer' },
    merged: { type: 'integer' },
    refused: { type: 'boolean' },
  },
  required: ['findings', 'issues_drafted', 'dedup_comments', 'merged', 'refused'],
}

const JUDGED = {
  type: 'object',
  properties: {
    leak_hits: { type: 'integer' },
    verdict_exit: { type: 'integer' },
    result: { enum: ['PASS', 'FAIL', 'NOT_WRITTEN'] },
    public_rescan_hits: { type: 'integer' },
  },
  required: ['leak_hits', 'verdict_exit', 'result', 'public_rescan_hits'],
}

const CLOSED_WORDS = [
  'Use only the closed codes in scripts/walk/sanitize.py: an item from ITEMS, a defect_class from',
  'DEFECT_CLASSES and a screen from SCREENS. No free text leaves the walk folder: evidence (screenshots,',
  `notes) goes under ${FOLDER}/evidence/<a short id>/ and the evidence field holds only that path.`,
].join(' ')

async function gate() {
  phase('Check')
  const served = await agent(
    [
      `Check that ${FOLDER}/walk.json exists (test -f). If it does, read only its "urls" object`,
      'and return its web and api values; else return exists false with empty strings. Read nothing else from it.',
    ].join(' '),
    { label: 'walk.json', phase: 'Check', model: 'opus', effort: 'low', schema: SERVED },
  )
  if (!served || !served.exists || !/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(served.web)) {
    log('No walk.json for this head (or no served URL): start scripts/walk/run.py first. Nothing judged.')
    return { sha: SHA, result: 'NOT_STARTED' }
  }

  phase('Walk')
  const walkers = await parallel([
    () =>
      agent(
        [
          `G1 walk, by eye, of the head ${SHA} served at ${served.web} (sign in as the seed's QS, Nusrat Jahan;`,
          'the password is in the environment of the walk, so ask for none: if you cannot sign in, every item is NOT_WALKED).',
          'The script layer already uploaded the real Development Sets into the projects WK-01 and WK-02.',
          `Walk the finish-line items ${ITEMS.join(', ')} of docs/specs/factory.md 5's table on the real sets,`,
          'each PASS, FAIL or NOT_WALKED, by the product-review skill: your own page, selected by URL before every',
          'action, per-page emulate only. One finding per defect seen in the running product.',
          CLOSED_WORDS,
        ].join(' '),
        { label: 'ux-critic', phase: 'Walk', agentType: 'ux-critic', model: 'opus', schema: WALKED },
      ),
    () =>
      agent(
        [
          `G1 burden lens on the head ${SHA} served at ${served.web} (the seed's QS; projects WK-01 and WK-02 hold`,
          'the real sets). Count what a QS must do by hand: Questions per Discipline, Sheets outside the bulk',
          'confirmation, false continuation Questions, proposed leave-outs to undo; compare with the expectation',
          'files under .private/work/walk-expect/ where they exist. Judge M0-FL5, M0-FL7, M0-FL8 and M0-FL9 only;',
          'list the other items NOT_WALKED. Your own browser page, selected by URL; per-page emulate only.',
          CLOSED_WORDS,
        ].join(' '),
        { label: 'qs-critic', phase: 'Walk', agentType: 'qs-critic', model: 'opus', schema: WALKED },
      ),
  ])

  phase('Triage')
  const reports = walkers.map((r) => r || { items: [], findings: [] })
  const triaged = await agent(
    [
      `You triage G1's agent layer for ${SHA}. The two critics returned (JSON): ${JSON.stringify(reports)}.`,
      `1. Merge their items: an item is FAIL if either says FAIL, PASS if one says PASS and neither FAIL,`,
      `else NOT_WALKED; list all of ${ITEMS.join(', ')} once each.`,
      '2. Give each finding an id f-1, f-2 and so on; severity BLOCKS for BLOCKS_DEMO, WRONG_NUMBER or',
      'BLOCKS_SIGNING, else OTHER; misleading true for a display that misleads the QS. Drop any finding whose',
      'defect_class or screen is not in scripts/walk/sanitize.py.',
      `3. Write ${FOLDER}/triage.json as {"items": [...], "findings": [...]}, each finding with exactly the keys`,
      'id, item, defect_class, screen, delta, severity, misleading (sanitize.py ALLOWED_KEYS): no other field.',
      `4. Run: gh issue list --label walk --state open --limit 200 --json number,body > ${FOLDER}/open-issues.json`,
      `5. Run: uv run python -m scripts.walk.issues draft ${SHA}. It refuses (exit 2) on a free-text field, an`,
      'out-of-set value, a leak-scan hit or a leak scan that cannot run: then stop, file nothing and return refused true.',
      `6. For each entry of ${FOLDER}/public/issue-drafts.json "new": uv run python -m tools.leakscan file <its body file>,`,
      'then gh issue create --label walk --title <its title> --body-file <its body file>; for each "comments" entry:',
      'the same scan, then gh issue comment <number> --body-file <its body file>. Never an inline --body.',
      `7. Run: uv run python -m scripts.walk.issues record ${SHA} --created <n>=<issue number> for each new draft.`,
      'Return the counts: findings, issues_drafted, dedup_comments, merged, refused.',
    ].join(' '),
    { label: 'triage', phase: 'Triage', model: 'opus', schema: TRIAGED },
  )
  if (!triaged || triaged.refused) {
    log('Triage refused or failed: no issue filed and no verdict written. The head is not walked.')
    return { sha: SHA, result: 'NOT_WRITTEN', triage: triaged }
  }
  if (triaged.findings !== triaged.issues_drafted + triaged.dedup_comments + triaged.merged) {
    log('Findings counted do not equal issues drafted plus dedup comments plus merged: no verdict written.')
    return { sha: SHA, result: 'NOT_WRITTEN', triage: triaged }
  }

  phase('Verdict')
  const judged = await agent(
    [
      `1. Run: uv run python -m tools.leakscan dir ${FOLDER}/public/ --quiet and read its last line`,
      '(leakscan: hits=<N> ...). Exit 2 or no such line: N is 1 (it could not scan; fail closed).',
      `2. Run: uv run python -m scripts.walk.verdict ${SHA} --leak-hits <N> --ref main and keep its exit code`,
      '(0 PASS, 1 FAIL, 2 not written).',
      `3. Scan the public folder again (the same command) now that public/summary.json exists, and return its hit count.`,
      'Return leak_hits, verdict_exit, result (PASS, FAIL or NOT_WRITTEN) and public_rescan_hits. Quote no file content.',
    ].join(' '),
    { label: 'verdict', phase: 'Verdict', model: 'opus', effort: 'low', schema: JUDGED },
  )
  if (judged && judged.public_rescan_hits !== 0) log('The public folder hit the leak scan after the verdict: publish nothing from it.')
  return { sha: SHA, triage: triaged, verdict: judged }
}

// A workflow's body may not end in a top-level return (node --check reads it as a module).
const outcome = await gate()
log(`real-set-walk ${SHA.slice(0, 8)}: ${JSON.stringify(outcome)}`)
