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
})
