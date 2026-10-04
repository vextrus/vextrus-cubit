/* A mark's colour on CAD-dark (m0-screens 4.6): the buffer's u32 (engine/render/buffers.py) as RGB. */
import { describe, expect, it } from 'vitest'
import { aciRgb, colourRgb } from './colours'

describe('colourRgb', () => {
  it('reads an AutoCAD colour index, a true colour, and draws BYLAYER and BYBLOCK in the foreground', () => {
    expect(colourRgb((1 << 24) | 1)).toEqual([255, 0, 0])
    expect(colourRgb((1 << 24) | 5)).toEqual([0, 0, 255])
    expect(colourRgb((2 << 24) | 0x12ab34)).toEqual([0x12, 0xab, 0x34])
    expect(colourRgb(0)).toEqual([255, 255, 255])
    expect(colourRgb(3 << 24)).toEqual([255, 255, 255])
  })
  it('runs indexes 10 to 249 round the hues, five brightnesses, full then half saturation', () => {
    expect(aciRgb(10)).toEqual([255, 0, 0])
    expect(aciRgb(11)).toEqual([255, 128, 128])
    expect(aciRgb(50)).toEqual([255, 255, 0])
    expect(aciRgb(130)).toEqual([0, 255, 255])
    expect(aciRgb(18)).toEqual([38, 0, 0])
    for (let i = 1; i <= 255; i++) for (const c of aciRgb(i)) expect(c >= 0 && c <= 255).toBe(true)
  })
})
