/*
 * The Priced BOQ's own names: its seven BOQ Sections (CONTEXT.md, in the order the Priced BOQ is
 * grouped), the groups under them and the Takeoff Steps an allowance stands for. A key the web has no
 * word for is shown as its own words (underscores to spaces, sentence case), never as the key.
 */
import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

const SECTIONS: Record<string, MessageDescriptor> = {
  sub_structure: msg`Sub-structure`,
  super_structure: msg`Super-structure`,
  masonry: msg`Masonry`,
  finishes: msg`Finishes`,
  doors_windows: msg`Doors & Windows`,
  services: msg`Services`,
  external_works: msg`External works`,
}

const GROUPS: Record<string, MessageDescriptor> = {
  foundations: msg`Foundations`,
  columns: msg`Columns`,
  beams: msg`Beams`,
  slabs: msg`Slabs`,
  stairs: msg`Stairs`,
  tanks: msg`Tanks`,
  walls: msg`Walls`,
  roof: msg`Roof`,
}

/** An allowance's step: the Takeoff Step's own name, as the step rail words it. */
const STEPS: Record<string, MessageDescriptor> = {
  ...GROUPS,
  storeys: msg`Levels`,
  grid: msg`Grid`,
}

function plain(key: string): string {
  const words = key.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const sectionName = (key: string, i18n: I18n) => (SECTIONS[key] ? i18n._(SECTIONS[key]) : plain(key))
export const groupName = (key: string, i18n: I18n) => (GROUPS[key] ? i18n._(GROUPS[key]) : plain(key))
export const stepName = (key: string, i18n: I18n) => (STEPS[key] ? i18n._(STEPS[key]) : plain(key))
