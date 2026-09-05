/**
 * AC-1(c) — `GET /api/viewer/[drawing]/[layout]`, beside the route it judges.
 *
 * `?part=` and `?index=` are two different questions and a caller that gets one of them wrong is
 * told which one. Today an unreadable index borrows the sentence written for an unknown part, so a
 * client is told to ask for `?part=head or ?part=layer&index=<n>` when that is exactly what it did.
 *
 * The two sentences are derived rather than transcribed (B-19): the part sentence is read off the
 * answer the route gives to an unknown `?part=`, and the index sentence is only required to name
 * the query it is about and to differ from it.
 *
 * No session is mounted. The index is a question about the address, judged beside the part and
 * before anybody is asked who is calling — which is why a caller who is signed out still learns
 * that their index is unreadable rather than being told to sign in first.
 */
import { describe, expect, test } from "vitest";
import { GET } from "../[drawing]/[layout]/route";

/** The address these cases are asked at — a drawing and a layout that need not exist. */
const DRAWING = "0f9b1b7c-2f3a-4c2e-9d1a-2b3c4d5e6f70";
const LAYOUT = "Sheet 1";

/** The values that are not "a whole number ≥ 0", each one a different way of not being one. */
const NOT_AN_INDEX = ["abc", "-1", "1.5", "NaN", " "] as const;

function ask(query: string): Promise<Response> {
  return GET(new Request(`http://127.0.0.1/api/viewer/${DRAWING}/${encodeURIComponent(LAYOUT)}?${query}`), {
    params: Promise.resolve({ drawing: DRAWING, layout: LAYOUT }),
  });
}

/** The `error` sentence a JSON answer carries, or a loud absence. */
async function sentenceOf(response: Response): Promise<string> {
  const body = (await response.json()) as { error?: unknown };
  expect(typeof body.error, `the answer carries an \`error\` sentence for a caller (got ${JSON.stringify(body)})`).toBe("string");
  return String(body.error);
}

describe("AC-1(c): an unreadable index is answered as its own question", () => {
  test("AC-1(c): an unknown ?part= is answered with a sentence about the part", async () => {
    const response = await ask("part=elevation");
    expect(response.status, "a part the feed does not serve is the caller's question being wrong").toBe(400);
    expect((await sentenceOf(response)).length, "the part answer carries a sentence").toBeGreaterThan(0);
  });

  for (const value of NOT_AN_INDEX) {
    test(`AC-1(c): ?index=${JSON.stringify(value)} is answered 400 with a sentence naming index`, async () => {
      const partSentence = await sentenceOf(await ask("part=elevation"));

      const response = await ask(`part=layer&index=${encodeURIComponent(value)}`);
      expect(
        response.status,
        `an index that is not a whole number is the address being wrong, answered before anybody is asked who is calling (got ${response.status})`,
      ).toBe(400);

      const sentence = await sentenceOf(response);
      expect(sentence.toLowerCase(), "the sentence names the query it is about, so a client knows which of the two it got wrong").toContain("index");
      expect(sentence, "the index answer is not the sentence written for an unknown part").not.toBe(partSentence);
    });
  }
});
