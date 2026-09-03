/**
 * What a device is called in the list a person revokes from (R-SPINE-001). The header is the
 * caller's to write, so the label is cut — and a cut is made where a character ends, never inside
 * one: half a character is a byte sequence no reader can render and no `text` column should carry.
 *
 * The agent is built from the exported bound rather than from a transcribed length, so a bound moved
 * by a later increment moves this case with it (B-19).
 */
import { describe, expect, test } from "vitest";
import { DEVICE_LABEL_MAX, deviceLabelFrom } from "./session";

/** ES2024's well-formedness check; the tree's `lib` is ES2023, so it is typed here at the one use. */
function wellFormed(value: string): boolean {
  return (value as unknown as { isWellFormed(): boolean }).isWellFormed();
}

/** A character outside the basic plane: two UTF-16 code units, one code point. */
const ASTRAL = "😀";

describe("a device label is cut between characters", () => {
  test("AC-4(c): an agent whose boundary falls inside a surrogate pair yields a well-formed, bounded label", () => {
    // Two code units short of the bound, then astral characters: the cut the clip makes therefore
    // lands between the halves of one of them, which is the whole hazard.
    expect(typeof DEVICE_LABEL_MAX, "session.ts publishes the bound a device label is cut to").toBe("number");
    const agent = `${"A".repeat(DEVICE_LABEL_MAX - 2)}${ASTRAL.repeat(3)}`;
    expect(agent.length, "the agent is longer than a label may be").toBeGreaterThan(DEVICE_LABEL_MAX);
    expect(agent.codePointAt(DEVICE_LABEL_MAX - 2), "an astral character straddles the cut").toBe(ASTRAL.codePointAt(0));

    const label = deviceLabelFrom(agent);

    expect(wellFormed(label), `the label holds no half character: ${JSON.stringify(label)}`).toBe(true);
    expect(label.endsWith("…"), `a cut label says it was cut: ${JSON.stringify(label)}`).toBe(true);
    expect(Array.from(label).length, "and it is no longer than the bound, counted in characters").toBeLessThanOrEqual(DEVICE_LABEL_MAX);
  });
});
