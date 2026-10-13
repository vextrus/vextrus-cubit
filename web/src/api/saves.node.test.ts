/*
 * The save state (m0-screens §4.1), S24-A3: "Saving…" while an act is on its way, "Not saved" once one could
 * not reach the server and until a later act is answered, "All changes saved" otherwise.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { actStarted, onSaveState, resetSaves, saveState } from './saves'

beforeEach(() => resetSaves())

describe('the save state', () => {
  it('is saved with nothing in flight', () => {
    expect(saveState()).toBe('saved')
  })

  it('is saving while an act is in flight, then saved once it is answered', () => {
    const done = actStarted()
    expect(saveState()).toBe('saving')
    done('answered')
    expect(saveState()).toBe('saved')
  })

  it('stays saving until every act in flight has ended', () => {
    const one = actStarted()
    const two = actStarted()
    one('answered')
    expect(saveState()).toBe('saving')
    two('answered')
    expect(saveState()).toBe('saved')
  })

  it('is dropped once an act could not reach the server, until a later act is answered', () => {
    actStarted()('dropped')
    expect(saveState()).toBe('dropped')
    const next = actStarted()
    expect(saveState()).toBe('saving')
    next('answered')
    expect(saveState()).toBe('saved')
  })

  it('counts an act once, however often it is settled', () => {
    const done = actStarted()
    const other = actStarted()
    done('answered')
    done('answered')
    expect(saveState()).toBe('saving')
    other('answered')
    expect(saveState()).toBe('saved')
  })

  it('tells its listeners of each change, and only of changes', () => {
    let told = 0
    const stop = onSaveState(() => told++)
    const done = actStarted()
    expect(told).toBe(1)
    actStarted()('answered')
    expect(told).toBe(1)
    done('answered')
    expect(told).toBe(2)
    stop()
    actStarted()
    expect(told).toBe(2)
  })

  it('stays dropped when an act sent before the lost one is answered after it (an earlier answer never clears a later loss)', () => {
    const a = actStarted()
    const b = actStarted()
    b('dropped')
    expect(saveState()).toBe('saving')
    a('answered')
    expect(saveState()).toBe('dropped')
  })

  it('stays dropped when the earlier act is answered before the later one is lost', () => {
    const a = actStarted()
    const b = actStarted()
    a('answered')
    b('dropped')
    expect(saveState()).toBe('dropped')
  })

  it('is saved again only once an act sent after the last lost one is answered', () => {
    const a = actStarted()
    const b = actStarted()
    b('dropped')
    a('answered')
    const c = actStarted()
    c('answered')
    expect(saveState()).toBe('saved')
  })

  it('holds a second loss against the first act answered after the first loss', () => {
    actStarted()('dropped')
    const old = actStarted()
    actStarted()('dropped')
    old('answered')
    expect(saveState()).toBe('dropped')
    actStarted()('answered')
    expect(saveState()).toBe('saved')
  })

  it('stays dropped when a quick act is answered and then a slow act, started before it, is lost', () => {
    const slow = actStarted()
    const quick = actStarted()
    quick('answered')
    expect(saveState()).toBe('saving')
    slow('dropped')
    expect(saveState()).toBe('dropped')
    actStarted()('answered')
    expect(saveState()).toBe('saved')
  })
})
