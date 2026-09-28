/*
 * Drawing notation as figures (docs/design/system.md §6; m0-screens §1.2, §1.8): lengths, coordinates
 * and levels in the project's unit system, and stated scales. Each comes in two forms:
 *   - `screen`: primes and fraction glyphs, 42′-7½″ (the element forms in Format.tsx isolate it left to
 *     right and mark it `data-notation`);
 *   - `plain`: 42'-7 1/2", for titles, the clipboard, Excel and the accessible name.
 * Never grouped, whatever the Market (system.md §9: coordinates are their own kind), and always in
 * Latin digits, as the drawing writes them.
 */
import type { LengthNotation } from './units'

declare const brand: unique symbol

/** A length or a coordinate, held in millimetres; built only by the functions below. */
export type Length = { readonly mm: number; readonly [brand]: 'length' }

export function lengthFromMm(mm: number): Length {
  return { mm } as Length
}

export function lengthFromInches(inches: number): Length {
  return { mm: inches * 25.4 } as Length
}

/** Feet and inches as a drawing writes them: −0′-6″ is `lengthFromFeetInches(-0, 6)`. */
export function lengthFromFeetInches(feet: number, inches = 0): Length {
  const negative = feet < 0 || Object.is(feet, -0)
  return lengthFromInches((Math.abs(feet) * 12 + inches) * (negative ? -1 : 1))
}

/** A figure in both forms. */
export interface NotationText {
  screen: string
  plain: string
}

const MINUS = '−'
const PLUS = '+'
const PLUS_MINUS = '±'
const NBSP = '\u00a0'
const EMPTY = '—'
const NONE: NotationText = { screen: EMPTY, plain: EMPTY }

/**
 * Rounds a non-negative value half up. The small nudge lets a value a float holds just under its half
 * (3/16″ in millimetres is 1.4999999999999998 eighths) round the same way as its exact twin, so one
 * length never prints two ways.
 */
function halfUp(value: number): number {
  return Math.floor(value + 0.5 + 1e-9)
}

/** Eighths of an inch: the glyph on screen and the plain form after the whole inches. */
const EIGHTHS: readonly (readonly [string, string])[] = [
  ['', ''],
  ['⅛', ' 1/8'],
  ['¼', ' 1/4'],
  ['⅜', ' 3/8'],
  ['½', ' 1/2'],
  ['⅝', ' 5/8'],
  ['¾', ' 3/4'],
  ['⅞', ' 7/8'],
]

type Sign = 'negative' | 'always'

function sign(negative: boolean, zero: boolean, mode: Sign): { screen: string; plain: string } {
  if (negative && !zero) return { screen: MINUS, plain: '-' }
  if (mode === 'always') return zero ? { screen: PLUS_MINUS, plain: PLUS_MINUS } : { screen: PLUS, plain: PLUS }
  return { screen: '', plain: '' }
}

/** Feet and inches to the nearest 1/8″, inches always shown: 12′-0″, 42′-7½″. */
function feetInches(mm: number, mode: Sign): NotationText {
  if (!Number.isFinite(mm)) return NONE
  const eighths = halfUp((Math.abs(mm) * 80) / 254)
  const feet = Math.floor(eighths / 96)
  const inches = Math.floor((eighths % 96) / 8)
  const [glyph, fraction] = EIGHTHS[eighths % 8]!
  const s = sign(mm < 0, eighths === 0, mode)
  return {
    screen: `${s.screen}${feet}′-${inches}${glyph}″`,
    plain: `${s.plain}${feet}'-${inches}${fraction}"`,
  }
}

/** Whole millimetres (3050 mm) or metres to 3 decimals (152.400 m), rounded once, in millimetres. */
function metric(mm: number, unit: 'mm' | 'm', mode: Sign): NotationText {
  if (!Number.isFinite(mm)) return NONE
  const whole = halfUp(Math.abs(mm))
  const figure = unit === 'mm' ? String(whole) : `${Math.floor(whole / 1000)}.${String(whole % 1000).padStart(3, '0')}`
  const s = sign(mm < 0, whole === 0, mode)
  return { screen: `${s.screen}${figure}${NBSP}${unit}`, plain: `${s.plain}${figure} ${unit}` }
}

/** A length: 10′-4½″, or whole millimetres (3050 mm). */
export function lengthText(length: Length, notation: LengthNotation): NotationText {
  return notation === 'feet-inches' ? feetInches(length.mm, 'negative') : metric(length.mm, 'mm', 'negative')
}

/** A coordinate, its own kind: 42′-7½″, −3′-6″, or metres to 3 decimals (152.400 m). */
export function coordinateText(coordinate: Length, notation: LengthNotation): NotationText {
  return notation === 'feet-inches' ? feetInches(coordinate.mm, 'negative') : metric(coordinate.mm, 'm', 'negative')
}

/** A level, always signed: +56′-6″, ±0′-0″, −3.200 m. */
export function levelText(level: Length, notation: LengthNotation): NotationText {
  return notation === 'feet-inches' ? feetInches(level.mm, 'always') : metric(level.mm, 'm', 'always')
}

/** A stated scale: 1:100 from its denominator, or the drawing's own words for it as read. */
export function scaleText(scale: number | string): NotationText {
  if (typeof scale === 'number' && !Number.isFinite(scale)) return NONE
  const text = typeof scale === 'number' ? `1:${scale}` : scale.trim()
  return { screen: text, plain: text }
}
