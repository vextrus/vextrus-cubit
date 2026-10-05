export const meta = {
  name: 'review-pr',
  description: 'Review one PR head in a slot, refute every finding of 50 or more, and record the verdict in the local ledger',
  whenToUse: '/review-pr <PR> <head> <round> [exception]: every PR head before merge_ready (docs/specs/factory.md 3.8)',
  phases: [
    { title: 'Round check', detail: 'scripts.ledger check refuses a round past the cap' },
    { title: 'Slot', detail: 'the head merged with main, checked out in a review slot' },
    { title: 'Review', detail: 'pr-reviewer, the adversary lens, ux-critic when words changed' },
    { title: 'Refute', detail: 'a refuter on every finding scored 50 or more' },
    { title: 'Record', detail: 'scripts.ledger record computes and records the verdict' },
  ],
}

// Input (the `args` global): {pr, head, round, exception, reason, slot, authority, focus}.
// The workflow has no shell and reads no clock: every rule lives in scripts/ledger.py, which the
// agents run. The verdict is computed by `ledger decide` inside `ledger record`, never here.

const input = args || {}
const pr = Number(input.pr)
const head = String(input.head || '')
const round = Number(input.round)
const exception = input.exception ? String(input.exception) : ''
const reason = input.reason ? String(input.reason) : ''
const slot = Number(input.slot || 1)
const authority = input.authority ? String(input.authority) : 'the ticket named in the PR body'
const focus = input.focus ? String(input.focus) : 'the trust boundary the PR changes'

if (!(pr > 0) || !/^[0-9a-f]{40}$/.test(head) || !(round >= 1 && round <= 3)) {
  throw new Error('usage: /review-pr <PR> <40-hex head> <round 1-3> [exception]')
}

// The pytest lock lives in the main checkout, found from any worktree (a review slot among them).
const LOCK = 'flock "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.private/work/factory/pytest.lock"'
const quote = (text) => "'" + text.replace(/'/g, "'\\''") + "'"
const exceptionFlags = exception
  ? ` --exception ${quote(exception)}` + (reason ? ` --reason ${quote(reason)}` : '')
  : ''
const slotPath = `.private/work/factory/review/slot${slot}`
const decisionFile = `.private/work/factory/review/${pr}-${head.slice(0, 12)}-r${round}.txt`

const EXIT = {
  type: 'object',
  properties: { exit_code: { type: 'integer' }, output: { type: 'string' } },
  required: ['exit_code', 'output'],
}
const SLOT = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    why: { type: 'string' },
    merged_sha: { type: 'string' },
    changed_files: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'changed_files'],
}
const REVIEW = {
  type: 'object',
  properties: {
    verdict: { enum: ['PASS', 'FIX', 'BLOCK'] },
    head: { type: 'string', description: 'the full 40-hex sha of the PR head reviewed' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 0, maximum: 100 },
          file: { type: 'string' },
          line: { type: 'integer', minimum: 0 },
          summary: { type: 'string', description: 'the failing scenario, in public words' },
        },
        required: ['score', 'file', 'line', 'summary'],
      },
    },
    report: { type: 'string' },
  },
  required: ['verdict', 'head', 'findings', 'report'],
}
const REFUTE = {
  type: 'object',
  properties: { verdict: { enum: ['CONFIRMED', 'REFUTED', 'UNPROVEN'] }, evidence: { type: 'string' } },
  required: ['verdict', 'evidence'],
}

// The stages run inside one function so that a refusal can stop the run early; plain `node --check`
// parses the file as a module (no top-level return).
async function review() {
  // Stage 0: the round check, before any reviewer starts.
  phase('Round check')
  const checked = await agent(
    `In the main checkout, run exactly: uv run python -m scripts.ledger check ${pr} --round ${round}${exceptionFlags}\n` +
      'Report its exit code and its output. Do nothing else.',
    { label: 'ledger check', model: 'opus', effort: 'low', schema: EXIT },
  )
  if (!checked || checked.exit_code !== 0) {
    log(`round ${round} of PR ${pr} refused by the ledger: ${checked ? checked.output : 'no answer'}`)
    return { pr, head, round, stopped: 'ledger check refused the round', output: checked ? checked.output : null }
  }

  // Stage 1: the head merged with main, in review slot k, with its own database name.
  phase('Slot')
  const slotted = await agent(
    [
      `Prepare review slot ${slot} for PR ${pr} at head ${head}, from the main checkout:`,
      `1. git fetch origin refs/pull/${pr}/head main`,
      `2. If ${slotPath} is not a worktree, git worktree add --detach ${slotPath}; then in it`,
      `   git checkout --detach ${head} and git merge --no-edit origin/main (a conflict: git merge --abort, ok false).`,
      `3. The changed files: git diff --name-only origin/main...${head}.`,
      `Tests in the slot use VEXTRUS_DB_NAME=vextrus_rv_slot${slot}. Change nothing else; never push.`,
    ].join('\n'),
    { label: `slot ${slot}`, model: 'opus', effort: 'low', schema: SLOT },
  )
  if (!slotted || !slotted.ok) {
    return { pr, head, round, stopped: 'the head does not merge cleanly with main', why: slotted && slotted.why }
  }
  const wordsChanged = slotted.changed_files.some((path) => path.startsWith('web/src/messages/'))

  // Stage 2: the lenses, in parallel.
  phase('Review')
  const brief =
    `PR ${pr}, head ${head}, review round ${round}, checked out merged with main in ${slotPath} ` +
    `(VEXTRUS_DB_NAME=vextrus_rv_slot${slot}). Authority: ${authority}. Locally run only the PR's changed ` +
    "test files and your own attack tests, each through the main checkout's lock: " +
    `${LOCK} uv run pytest -rf <files>. Public words only.`
  const lenses = [
    () =>
      agent(`${brief}\nReview it in your six passes. Focus: ${focus}.`, {
        label: 'pr-reviewer',
        phase: 'Review',
        agentType: 'pr-reviewer',
        model: 'opus',
        effort: 'high',
        schema: REVIEW,
      }),
    () =>
      agent(
        `${brief}\nYou are the adversary lens: find the failing scenario a QS meets with this change, ` +
          'and prove it with a test in the slot. Ignore style; report only what breaks.',
        { label: 'adversary', phase: 'Review', agentType: 'pr-reviewer', model: 'opus', effort: 'high', schema: REVIEW },
      ),
  ]
  if (wordsChanged) {
    lenses.push(() =>
      agent(`${brief}\nThe words-only design gate on the changed web/src/messages/** words.`, {
        label: 'ux-critic words',
        phase: 'Review',
        agentType: 'ux-critic',
        model: 'opus',
        effort: 'high',
        schema: REVIEW,
      }),
    )
  }
  const reviews = await parallel(lenses)
  if (reviews.some((review) => !review)) {
    return { pr, head, round, stopped: 'a reviewer gave no answer: run the round again' }
  }

  // Stage 3: a refuter on every finding scored 50 or more.
  phase('Refute')
  const findings = reviews.flatMap((review, lens) =>
    review.findings.map((finding, index) => ({ ...finding, id: `l${lens + 1}-f${index + 1}` })),
  )
  const serious = findings.filter((finding) => finding.score >= 50)
  const refuted = await parallel(
    serious.map((finding) => () =>
      agent(
        `Refute this finding on PR ${pr} at ${head} (checked out in ${slotPath}): ${finding.file}:${finding.line}, ` +
          `scored ${finding.score}: ${finding.summary}`,
        { label: `refute ${finding.id}`, phase: 'Refute', agentType: 'refuter', model: 'opus', effort: 'high', schema: REFUTE },
      ),
    ),
  )
  const refuterOf = new Map(serious.map((finding, index) => [finding.id, refuted[index]]))

  // Stage 4: one ranked list and one fix message (no verdict is decided here).
  const ranked = findings
    .map((finding) => ({ ...finding, refuter: refuterOf.has(finding.id) ? refuterOf.get(finding.id) : null }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  const standing = ranked.filter((finding) => !(finding.refuter && finding.refuter.verdict === 'REFUTED'))
  const fixMessage = standing.length
    ? [`Fix round for PR ${pr} at ${head}:`, ...standing.map((f) => `- ${f.file}:${f.line} (${f.score}): ${f.summary}`)].join('\n')
    : ''

  // Stage 5: the reviewers' final lines to a file, and the ledger record (which computes the verdict).
  phase('Record')
  const lines = [
    ...reviews.map((review) => `VERDICT: ${review.verdict} at ${review.head}`),
    ...ranked.map((f) => `FINDING ${f.id} ${f.score} ${f.refuter ? f.refuter.verdict : '-'}`),
  ]
  const recorded = await agent(
    [
      `In the main checkout, write exactly these lines (each ending in a newline, nothing else) to ${decisionFile}:`,
      ...lines,
      `Then run exactly: uv run python -m scripts.ledger record ${pr} --round ${round} --head ${head} --from ${decisionFile}${exceptionFlags}`,
      'Report its exit code and output. Never edit a ledger file and never post a comment yourself.',
    ].join('\n'),
    { label: 'ledger record', model: 'opus', effort: 'low', schema: EXIT },
  )

  // Shadow (tier 2): Jev's triage writes a sidecar nothing reads for a decision; its failure changes nothing.
  if (findings.length) {
    const triageFile = `.private/work/factory/review/${pr}-${head.slice(0, 12)}-r${round}.jev.json`
    const triageInput = JSON.stringify({
      pr,
      head_sha: head,
      findings: ranked.map((f) => ({ score: f.score, file: f.file, line: f.line, summary: f.summary })),
    })
    await agent(
      [
        'Only if scripts/factory/jev.py exists in the main checkout:',
        `write this JSON to ${triageFile}: ${triageInput}`,
        `then run uv run python -m scripts.factory.jev triage --from ${triageFile} and report its output.`,
        'If the file does not exist, or the command fails, say so and stop. Change nothing else.',
      ].join('\n'),
      { label: 'jev shadow', model: 'opus', effort: 'low' },
    )
  }

  return {
    pr,
    head,
    round,
    ledger: recorded,
    ranked: ranked.map((f) => ({
      id: f.id,
      score: f.score,
      file: f.file,
      line: f.line,
      refuter: f.refuter ? f.refuter.verdict : null,
    })),
    fix_message: fixMessage,
  }
}

const outcome = await review()
log(JSON.stringify(outcome))
