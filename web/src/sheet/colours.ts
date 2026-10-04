/*
 * A line's colour on CAD-dark (m0-screens 4.6, "Colour"): the buffer's u32 colour (engine/render/
 * buffers.py: top byte 0 BYLAYER, 1 an AutoCAD colour index in the low byte, 2 an RGB true colour in the
 * low 24 bits, 3 BYBLOCK) as RGB, 0 to 255. The buffer carries no layer table, so a BYLAYER or BYBLOCK
 * colour draws in AutoCAD's foreground on a dark ground (index 7, white), as an unresolved one does
 * in AutoCAD.
 *
 *   colourRgb(0x01000001) // [255, 0, 0]: index 1, red
 */

export type Rgb = readonly [number, number, number]

const FOREGROUND: Rgb = [255, 255, 255]

/** Indexes 1 to 9 and 250 to 255 are named colours and greys; 10 to 249 run round the hues. */
const NAMED: Record<number, Rgb> = {
  1: [255, 0, 0],
  2: [255, 255, 0],
  3: [0, 255, 0],
  4: [0, 255, 255],
  5: [0, 0, 255],
  6: [255, 0, 255],
  7: FOREGROUND,
  8: [128, 128, 128],
  9: [192, 192, 192],
  250: [51, 51, 51],
  251: [80, 80, 80],
  252: [105, 105, 105],
  253: [130, 130, 130],
  254: [190, 190, 190],
  255: [255, 255, 255],
}

/** The five brightnesses of each hue's ten indexes, two to a brightness (full, then half saturation). */
const BRIGHTNESS = [1, 0.65, 0.5, 0.3, 0.15]

/** AutoCAD's colour index as RGB. */
export function aciRgb(index: number): Rgb {
  const named = NAMED[index]
  if (named) return named
  if (index < 10 || index > 249) return FOREGROUND
  const hue = Math.floor((index - 10) / 10) * 15
  const step = (index - 10) % 10
  const value = BRIGHTNESS[Math.floor(step / 2)]!
  const saturation = step % 2 === 0 ? 1 : 0.5
  return hsv(hue, saturation, value)
}

function hsv(hue: number, s: number, v: number): Rgb {
  const f = (n: number) => {
    const k = (n + hue / 60) % 6
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))))
  }
  return [f(5), f(3), f(1)]
}

/** The buffer's colour as RGB. */
export function colourRgb(colour: number): Rgb {
  const kind = colour >>> 24
  if (kind === 1) return aciRgb(colour & 0xff)
  if (kind === 2) return [(colour >>> 16) & 0xff, (colour >>> 8) & 0xff, colour & 0xff]
  return FOREGROUND
}
