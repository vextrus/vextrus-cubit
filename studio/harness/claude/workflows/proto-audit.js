export const meta = {
  name: 'proto-audit',
  description: 'Critically review the prototype through every lens, try to refute each defect, return the survivors ranked',
  whenToUse: 'Before a fix outcome, to find what is wrong; after one, to measure what is left. Pass {out: "outcomes/<NN-name>"}.',
  phases: [
    { title: 'Find', detail: 'one agent per lens: code checks, fidelity per Discipline, relations, QS, UX, performance' },
    { title: 'Verify', detail: 'adversaries per defect (two, or one past 60); it survives unless all refute it' },
    { title: 'Complete', detail: 'what did no lens look at?' },
  ],
}

// args: { out: 'outcomes/01-audit', owner: true }   (owner: include OWNER-REVIEW.md items)
const OUT = (args && args.out) || 'outcomes/01-audit'

const DEFECTS = {
  type: 'object',
  required: ['defects', 'not_covered'],
  properties: {
    defects: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'severity', 'where', 'evidence', 'repro'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'integer', minimum: 1, maximum: 4 },   // 1 blocks the walk .. 4 polish
          discipline: { type: 'string' },
          storey: { type: 'string' },
          element_ids: { type: 'array', items: { type: 'string' } },
          where: { type: 'string' },        // file:line, screen, or check name
          evidence: { type: 'string' },     // numbers, screenshot path, check output
          repro: { type: 'string' },
          cause: { type: 'string' },        // best guess at the cause in the generator or viewer
        },
      },
    },
    not_covered: { type: 'string' },        // what this lens could not check, and why
  },
}
const VERDICT = {
  type: 'object',
  required: ['verdict', 'evidence'],
  properties: { verdict: { type: 'string', enum: ['refuted', 'unproven', 'holds'] }, evidence: { type: 'string' } },
}

const shots = `Write any screenshot under ${OUT}/shots/.`
const LENSES = [
  { key: 'geometry', type: 'model-auditor', prompt: `Audit the whole model with code: supports, stacking, hosts, levels and units, clashes, footprint (your agent file lists the invariants). Write or extend checks in checks/, run them all, and report every failing class.` },
  { key: 'relations', type: 'model-auditor', prompt: `Audit the Element Relations in data/ and the model with code: does every "hosted in", "passes through", "located in" and "same as" Relation hold geometrically in the generated model? Report each kind's failures.` },
  { key: 'fidelity-structural', type: 'visual-judge', prompt: `Fidelity lens, Structural Discipline: piles and caps, columns, shear walls, beams, slabs, stairs, lift core, storey by storey against the structural drawings. ${shots}` },
  { key: 'fidelity-architectural', type: 'visual-judge', prompt: `Fidelity lens, Architectural Discipline: walls, openings, doors, windows, rooms, stairs, finishes, storey by storey against the architectural drawings. ${shots}` },
  { key: 'fidelity-plumbing', type: 'visual-judge', prompt: `Fidelity lens, Plumbing (with gas): fixtures, risers, pipes and their routes, storey by storey against the plumbing drawings. ${shots}` },
  { key: 'fidelity-electrical', type: 'visual-judge', prompt: `Fidelity lens, Electrical: boards, sockets, switches, lights, conduits, AC, storey by storey against the electrical drawings. ${shots}` },
  { key: 'qs', type: 'qs-critic', prompt: `Review the prototype's Priced BOQ, Material Schedule and the MD's figure as you would before signing: recompute a sample from the model's Elements, check methods, deductions, units and rates. Report each figure that would not survive a senior Dhaka QS, with the rule it breaks and the right figure.` },
  { key: 'ux', type: 'visual-judge', prompt: `UX lens: walk every screen of the prototype as a QS doing a real Takeoff, then as the MD: the Drawing Set, Takeoff Steps with Confirmation and Questions, the Live Model and its tree and tools, the Priced BOQ, the Material Schedule, the MD summary, the Life Phase and 4D/5D previews. ${shots}` },
  { key: 'performance', type: 'model-auditor', prompt: `Measure the prototype against the budgets in ~/vextrus-cubit/docs/research/viewer-3d-budgets.md: load time, frame time while orbiting, draw calls, triangles, memory, on this machine in Chromium. Report each budget missed, by how much, and the cause.` },
]

phase('Find')
const found = await parallel(LENSES.map((l) => () =>
  agent(`${l.prompt}\n\nReport every defect you can show on the current files, with evidence; leave out anything you can't show.`,
    { label: `find:${l.key}`, phase: 'Find', agentType: l.type, schema: DEFECTS })
    .then((r) => r && { lens: l.key, ...r })))
const lenses = found.filter(Boolean)
const missing = LENSES.filter((l) => !lenses.find((r) => r.lens === l.key)).map((l) => l.key)
if (missing.length) log(`lenses that returned nothing: ${missing.join(', ')}`)

let owner = []
if (!args || args.owner !== false) {
  const o = await agent(`Read OWNER-REVIEW.md. Map each issue the owner wrote to Element ids or a screen, using the model data and the prototype's code. Return one defect per issue, severity 1 unless the owner said otherwise; evidence = the owner's words.`,
    { label: 'owner-review', phase: 'Find', agentType: 'scout', schema: DEFECTS })
  owner = (o && o.defects || []).map((d) => ({ ...d, lens: 'owner', verified: 'owner' }))
}

// Dedup across lenses: same Element set and same opening words of the title.
const seen = new Map()
for (const r of lenses) for (const d of r.defects) {
  const key = `${(d.element_ids || []).slice().sort().join(',')}|${d.title.toLowerCase().slice(0, 40)}`
  if (!seen.has(key)) seen.set(key, { ...d, lens: r.lens })
}
const candidates = [...seen.values()]
log(`${candidates.length} candidate defects from ${lenses.length} lenses, plus ${owner.length} from the owner`)

phase('Verify')
// Severity-4 polish is not worth two adversaries; past 60 candidates, one adversary each (logged, never silent).
const polish = candidates.filter((d) => d.severity >= 4).map((d) => ({ ...d, verified: 'not checked (polish)' }))
const toVerify = candidates.filter((d) => d.severity < 4)
const VOTES = toVerify.length > 60 ? [0] : [0, 1]
if (polish.length) log(`${polish.length} polish items kept unverified`)
if (VOTES.length === 1) log(`${toVerify.length} to verify: one adversary each instead of two`)
const judged = await pipeline(toVerify, (d) =>
  parallel(VOTES.map((i) => () => agent(
    `Claim (from the ${d.lens} lens): "${d.title}". Where: ${d.where}. Elements: ${(d.element_ids || []).slice(0, 10).join(', ')}. Evidence given: ${d.evidence}. Repro: ${d.repro}.\nTry to refute it on the current files.${i ? ' Approach it differently from a straight re-run: check the drawing or the data independently.' : ''}`,
    { label: `verify:${d.lens}:${i}`, phase: 'Verify', agentType: 'adversary', schema: VERDICT })))
    .then((vs) => {
      const v = vs.filter(Boolean)
      const refuted = v.filter((x) => x.verdict === 'refuted').length
      return { ...d, verified: refuted >= VOTES.length ? 'refuted' : v.some((x) => x.verdict === 'holds') ? 'holds' : 'unproven', checks: v }
    }))
const survivors = judged.filter(Boolean).filter((d) => d.verified !== 'refuted')
const dropped = judged.filter(Boolean).length - survivors.length
log(`${survivors.length} survived; ${dropped} refuted by both adversaries`)

phase('Complete')
const gaps = await agent(
  `An audit of the prototype ran these lenses: ${LENSES.map((l) => l.key).join(', ')}. Their own notes on what they could not cover:\n${lenses.map((r) => `- ${r.lens}: ${r.not_covered}`).join('\n')}\nWhat did no lens look at that the owner's walk would? Name each gap and how to check it. Short.`,
  { label: 'completeness', phase: 'Complete', agentType: 'scout' })

const all = [...owner, ...survivors, ...polish].sort((a, b) => a.severity - b.severity)
return { out: OUT, counts: { owner: owner.length, found: candidates.length, survived: survivors.length, refuted: dropped }, defects: all, not_covered: lenses.map((r) => ({ lens: r.lens, note: r.not_covered })), missing_lenses: missing, gaps }
