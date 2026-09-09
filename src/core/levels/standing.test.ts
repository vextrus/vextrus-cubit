/**
 * L-REG-03: "disagreement is declared, never resolved silently" — the branch that declares it.
 *
 * Two current readings of one level's storey height that do not agree on canonical metres suspend
 * the height: no value, and the code a quantity line reports the absence under. The contest clears
 * only by re-affirmation under the same reading key (L-MEA-07), never by a later reading out-voting
 * the earlier ones — so this file drives the suspension, the clearing, and the refusal the level
 * carries while it stands suspended.
 */
import { describe, expect, test } from "vitest";
import { refusalCodeOf } from "../faults/refusal-marker";
import { storeyHeightContested } from "./refusals";
import { storeyHeightStanding, type ReadingOfHeight } from "./standing";

/** One reading, as a standing is derived from one: the key it stands under, and what it says. */
const read = (readingKey: string, canonicalMetres: string): ReadingOfHeight => ({ readingKey, canonicalMetres });

describe("a contested storey height", () => {
  test("readings that agree on canonical metres stand AGREED at what they agree on", () => {
    const standing = storeyHeightStanding([read("k:transcribed", "3.048"), read("k:entered", "3.048")]);
    expect(standing.standing, "two readings saying the same height agree, whatever they were written in").toBe("AGREED");
    expect(standing.canonicalMetres).toBe("3.048");
    expect(standing.refusal, "an agreed height reports no absence").toBeNull();
    expect(standing.current).toHaveLength(2);
  });

  test("a reading that disagrees suspends the height with no value and STOREY_HEIGHT_CONTESTED", () => {
    const standing = storeyHeightStanding([read("k:one", "3.048"), read("k:two", "3.2"), read("k:three", "3.048")]);
    expect(standing.standing, "one dissenting reading suspends the height — never precedence, never majority (L-REG-03)").toBe("SUSPENDED");
    expect(standing.canonicalMetres, "a height whose readings disagree has no height").toBeNull();
    expect(standing.refusal, "the level carries the code a line would report instead of a height").toBe("STOREY_HEIGHT_CONTESTED");
    expect(standing.current, "every key still says what it says — a contest hides no reading").toHaveLength(3);
    expect(standing.superseded, "nothing was re-affirmed, so nothing is superseded").toEqual([]);
  });

  test("re-affirming under the same key clears the contest, and supersedes rather than erases", () => {
    const standing = storeyHeightStanding([read("k:one", "3.048"), read("k:two", "3.2"), read("k:two", "3.048")]);
    expect(standing.standing, "the reader who dissented corrected themself under their own key (L-MEA-07)").toBe("AGREED");
    expect(standing.canonicalMetres).toBe("3.048");
    expect(standing.refusal).toBeNull();
    expect(standing.current.map((reading) => reading.canonicalMetres), "one reading per key: the latest").toEqual(["3.048", "3.048"]);
    expect(standing.superseded.map((reading) => reading.canonicalMetres), "the reading it corrected is superseded, never deleted").toEqual(["3.2"]);
  });

  test("the refusal a suspended height is answered by is the registered one, carrying the facts it names", () => {
    const refused = storeyHeightContested("the readings of 1F do not agree on a storey height", { levelId: "l-1", metres: ["3.048", "3.2"] });
    expect(refusalCodeOf(refused), "an answer from the closed taxonomy, not a fault (B-21)").toBe("STOREY_HEIGHT_CONTESTED");
    expect((refused as Error & { levelId?: string }).levelId).toBe("l-1");
    expect((refused as Error & { metres?: readonly string[] }).metres).toEqual(["3.048", "3.2"]);
  });
});
