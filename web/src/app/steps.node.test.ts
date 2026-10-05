/*
 * Where a project's address and the bare Takeoff redirect: Step 1's own static route in M0, so the
 * router never builds a `$step` path that its static `takeoff/1` outranks (#235's dev-log warning).
 */
import { describe, expect, it } from 'vitest'
import { currentStep, stepRedirect } from './steps'

describe('stepRedirect', () => {
  it("names Step 1's static route with the project's code, replacing the address", () => {
    expect(currentStep().number).toBe(1)
    expect(stepRedirect('ZQ-07').options).toMatchObject({ to: '/p/$code/takeoff/1', params: { code: 'ZQ-07' }, replace: true })
  })
})
