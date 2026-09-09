// The two readings of a resolved token value the viewer takes: which channels it states, and how
// opaque it is. They live here rather than inside the painter because the painter is a WebGL
// module a unit lane cannot instantiate — a reading no test can reach is a reading nobody has
// checked, and this one was silently wrong about a whole notation for as long as it stood there
// (B-17, ARCH-02).
//
// What is read is a COMPUTED value: the browser hands back either the hex form or a functional form
// whose parts are numbers, optionally with an alpha stated as a fraction or as a percentage.

/** Three channels, in the 0–255 the notation itself states them in. */
export type Channels = readonly [number, number, number];

/** How many of a channel's 255 steps one unit float is worth. */
const CHANNEL_MAX = 255;

/** What a percentage is a percentage of. */
const WHOLE = 100;

/** The hex form, whose three pairs are the channels. */
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Every number a functional form states, each keeping the `%` that changes what it means. */
const STATED = /-?\d+(?:\.\d+)?%?/g;

/** A resolved token value's three channels, as the notation states them. */
export function channelsOf(colour: string): Channels {
  const hex = HEX.exec(colour.trim());
  if (hex !== null) {
    return [Number.parseInt(hex[1] ?? "", 16), Number.parseInt(hex[2] ?? "", 16), Number.parseInt(hex[3] ?? "", 16)];
  }
  const [red, green, blue] = (colour.match(STATED) ?? []).slice(0, 3).map((part) => Number(part.replace("%", "")));
  return [red ?? 0, green ?? 0, blue ?? 0];
}

/** The same three channels as the unit floats a vertex buffer takes. */
export function unitChannelsOf(colour: string): Channels {
  const [red, green, blue] = channelsOf(colour);
  return [red / CHANNEL_MAX, green / CHANNEL_MAX, blue / CHANNEL_MAX];
}

/**
 * How opaque a resolved token value is: the fourth part a wash's own notation carries, or fully
 * opaque where it carries none. `--canvas-hover` is the one canvas colour stated as a wash, and its
 * translucency is part of the colour rather than a detail of it.
 *
 * The part is read WITH its notation. An alpha may be written as a fraction or as a percentage, and
 * reading `50%` as the bare number 50 clamps to fully opaque — a half-transparent wash then paints
 * solid over the drawing beneath it. A value stated past the whole is the whole: more than all of it
 * is all of it, never a multiplier past opacity.
 */
export function alphaOf(colour: string): number {
  const stated = (colour.match(STATED) ?? [])[3];
  if (stated === undefined) return 1;
  const value = stated.endsWith("%") ? Number(stated.slice(0, -1)) / WHOLE : Number(stated);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 1;
}
