export const meta = {
  name: 'outcome',
  description: 'Build to an outcome rubric, have an independent grader judge the live result, revise until it passes or the round limit',
  whenToUse: 'For one outcome folder whose RUBRIC.md is written. Pass {out: "outcomes/<NN-name>", builder: "builder" | "builder-light", rounds: 3, brief: "<scope, files, checks, elapsed/budget>"}.',
  phases: [
    { title: 'Build', detail: 'the builder works the rubric (round 1) or the grader\'s gaps (later rounds)' },
    { title: 'Grade', detail: 'a fresh grader judges every criterion on the live files' },
  ],
}

// The lead writes RUBRIC.md before calling this, and writes each returned grade to <out>/grades/.
const OUT = args && args.out
if (!OUT) throw new Error('pass {out: "outcomes/<NN-name>"}')
const BUILDER = (args && args.builder) || 'builder'
const ROUNDS = Math.min((args && args.rounds) || 3, 5)
const BRIEF = (args && args.brief) || ''

const GRADE = {
  type: 'object',
  required: ['verdict', 'criteria', 'fixes'],
  properties: {
    verdict: { type: 'string', enum: ['satisfied', 'needs_revision'] },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'status', 'evidence'],
        properties: { id: { type: 'string' }, status: { type: 'string', enum: ['pass', 'fail', 'unknown'] }, evidence: { type: 'string' } },
      },
    },
    fixes: { type: 'array', items: { type: 'string' } },   // the most important gaps, in order
  },
}

const grades = []
let feedback = ''
for (let round = 1; round <= ROUNDS; round++) {
  phase('Build')
  const work = await agent(
    `Outcome folder: ${OUT}. Read ${OUT}/RUBRIC.md first: it is exactly what the grader will judge. ` +
    `Work the items in ${OUT}/DEFECTS.json whose status is open (change only their status, to fixed, when your check proves it).\n` +
    (BRIEF ? `Brief: ${BRIEF}\n` : '') +
    (round === 1 ? 'This is round 1.' : `Round ${round} of ${ROUNDS}. The grader found these gaps; fix them, in this order:\n${feedback}`),
    { label: `build:r${round}`, phase: 'Build', agentType: BUILDER })
  if (work === null) { log(`round ${round}: the builder stopped; ending`); break }

  phase('Grade')
  const g = await agent(
    `Grade the outcome in ${OUT} against ${OUT}/RUBRIC.md, on the live files and the running prototype. Round ${round} of ${ROUNDS}.`,
    { label: `grade:r${round}`, phase: 'Grade', agentType: 'grader', schema: GRADE })
  if (!g) { log(`round ${round}: the grader returned nothing; ending`); break }
  grades.push({ round, ...g, builder_report: work })
  const failing = g.criteria.filter((c) => c.status !== 'pass')
  log(`round ${round}: ${g.verdict}; ${g.criteria.length - failing.length}/${g.criteria.length} criteria pass`)
  if (g.verdict === 'satisfied' && failing.length === 0) break
  feedback = [...g.fixes, ...failing.map((c) => `${c.id} (${c.status}): ${c.evidence}`)].join('\n')
}

const last = grades[grades.length - 1]
return {
  out: OUT,
  result: !last ? 'no grade' : last.verdict === 'satisfied' ? 'satisfied' : grades.length >= ROUNDS ? 'rounds exhausted' : 'stopped',
  rounds: grades.length,
  grades,
}
