/*
 * Ticket 122's acceptance tests (issue #134): the slowed in-memory API is "run in one CI shard, so
 * this class fails at once". The web's workflow runs Vitest with `VITE_FAKE_API_LATENCY_MS` (the
 * default latency of `new FakeApi()`, chosen by the acceptance writer) set above zero in that step's
 * own `env:`, besides the ordinary run.
 */
import { describe, expect, it } from 'vitest'
import workflow from '../../../../.github/workflows/web.yml?raw'

/** The workflow's steps, each as its lines of text (a step starts at a `- ` line under `steps:`). */
function steps(text: string): string[] {
  const out: string[] = []
  let current: string[] | null = null
  let indent = -1
  for (const line of text.split('\n')) {
    const item = /^(\s*)- /.exec(line)
    if (item && (indent < 0 || item[1]!.length === indent)) {
      if (current) out.push(current.join('\n'))
      current = [line]
      indent = item[1]!.length
    } else if (/^\s*steps:\s*$/.test(line) || /^ {2}\S/.test(line)) {
      if (current) out.push(current.join('\n'))
      current = null
      indent = -1
    } else if (current) current.push(line)
  }
  if (current) out.push(current.join('\n'))
  return out
}

function latencyOf(step: string): number {
  const found = /VITE_FAKE_API_LATENCY_MS:\s*["']?(\d+)/.exec(step)
  return found ? Number(found[1]) : 0
}

const runsVitest = (step: string) => /\brun:.*(npm (run )?test|vitest)/.test(step)

describe('the web workflow runs the tests with the fake API slowed (#134)', () => {
  const all = steps(workflow)

  it('has a Vitest run with VITE_FAKE_API_LATENCY_MS above zero', () => {
    expect(all.filter((s) => runsVitest(s) && latencyOf(s) > 0)).toHaveLength(1)
  })

  it('keeps an ordinary Vitest run, the fake API unslowed', () => {
    expect(all.filter((s) => runsVitest(s) && latencyOf(s) === 0).length).toBeGreaterThanOrEqual(1)
  })
})
