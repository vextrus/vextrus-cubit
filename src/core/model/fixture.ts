// L-AI-01: the fixture transport. A request is answered from `<root>/<requestHash>.json`, the file
// format every recorded answer is kept in (F-MODEL), and nothing else: an answer nobody recorded is
// the FIXTURE_MISSING refusal, never a network call. A file that exists but is not a fixture is a
// corpus defect — a plain failure, not a refusal and not a row (B-21).
//
// A fixture minted with the provider's own BODY (`./mint` files it beside the reading) is replayed by
// reading that body again, through the arm that asks the question today (`readTypeSafeBody`): the
// payload and the judgment a replay answers are what the CURRENT seam derives from what the provider
// said, never what it derived on the day the file was minted. So a change to how an answer is read —
// an arm's reading, `answerJudgmentOf` — is proved against the corpus rather than hidden by it, and
// the file's own `payload` and `judgment` are the record-day reading, kept for a reader. A fixture
// minted before bodies were kept carries none, and it replays exactly as it was filed: what it holds
// is the judgment the seam derived then, and nothing here can derive it again.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { tokenCount } from "../model-ledger.types";
import { readTypeSafeBody } from "./typesafe";
import type { JsonValue, ModelFixture, ModelJudgment, ModelRequest, TransportAnswer, TransportPort } from "./types";

/** The one code this transport answers with, read off the closed taxonomy (R-SPINE-062, Q-07). */
const FIXTURE_MISSING: RefusalCode = "FIXTURE_MISSING";

/** A transport over one fixture root. */
export function fixtureTransport(fixtureRoot: string): TransportPort {
  return {
    transport: "fixture",
    async answer(_ctx, request, hash): Promise<TransportAnswer> {
      const fileName = `${hash}.json`;
      const file = join(fixtureRoot, fileName);
      const text = await recordedText(file);
      if (text === null) {
        // The refusal names the request and the file it would be filed as, never the root: where the
        // corpus lives on this machine is the operator's business, and a refusal is shown to callers
        // (B-21, R-SPINE-062).
        const missing = refusal(FIXTURE_MISSING, `no recorded model answer exists for request ${hash} — none is filed as ${fileName} under the fixture root`, { requestHash: hash });
        return { kind: "refused", code: FIXTURE_MISSING, refusal: missing };
      }
      const fixture = parseFixture(text, file, request, hash);
      const body = fixture.body ?? null;
      if (body === null) {
        return { kind: "answered", payload: fixture.payload, inputTokens: fixture.inputTokens, outputTokens: fixture.outputTokens, judgment: fixture.judgment ?? null, body: null };
      }
      const read = readAgain(body, fixture, request, file);
      return { kind: "answered", payload: read.content, inputTokens: fixture.inputTokens, outputTokens: fixture.outputTokens, judgment: read.judgment, body };
    },
  };
}

/**
 * A kept body, read by today's seam. A body the seam cannot read, or whose usage is not the tokens the
 * file counts, is a corpus defect — a plain failure naming the file, never a refusal (B-21): the file
 * and the provider it records would be telling two stories about one call.
 */
function readAgain(body: JsonValue, fixture: ModelFixture, request: ModelRequest, file: string): { content: JsonValue; judgment: ModelJudgment | null } {
  let read: ReturnType<typeof readTypeSafeBody>;
  try {
    read = readTypeSafeBody(request, body);
  } catch (failure) {
    throw new Error(`the recorded model answer at ${file} keeps a provider body today's seam cannot read`, { cause: failure });
  }
  if (tokenCount(read.inputTokens) !== fixture.inputTokens || tokenCount(read.outputTokens) !== fixture.outputTokens) {
    throw new Error(`the recorded model answer at ${file} counts ${fixture.inputTokens} in / ${fixture.outputTokens} out, and the provider body it keeps states other usage`);
  }
  return { content: read.content, judgment: read.judgment };
}

/** The file's text, or null when there is no such file. Any other failure to read is rethrown as-is. */
async function recordedText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (failure) {
    if ((failure as { code?: unknown }).code === "ENOENT") return null;
    throw failure;
  }
}

/** A JSON text as the fixture it claims to be, checked against the request it is answering. */
function parseFixture(text: string, file: string, request: ModelRequest, hash: string): ModelFixture {
  const parsed = parseJson(text, file);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`the recorded model answer at ${file} is not an object`);
  }
  const { requestHash, modelId, inputTokens, outputTokens } = parsed;
  if (requestHash !== hash) {
    throw new Error(`the recorded model answer at ${file} names request ${String(requestHash)}, not the request ${hash} it is filed under`);
  }
  if (modelId !== request.modelId) {
    throw new Error(`the recorded model answer at ${file} was given by ${String(modelId)}, not by ${request.modelId} as the request pins`);
  }
  if (!Object.hasOwn(parsed, "payload")) throw new Error(`the recorded model answer at ${file} carries no payload`);
  // Whether a figure is a token count is the money derivation's one judgement (B-17), asked here
  // before any row is written; a figure that is not one fails as the derivation fails for it.
  return {
    requestHash: hash,
    modelId: request.modelId,
    payload: parsed["payload"] as JsonValue,
    inputTokens: tokenCount(inputTokens),
    outputTokens: tokenCount(outputTokens),
    judgment: judgmentOf(parsed["judgment"], file),
    body: bodyOf(parsed["body"], file),
  };
}

/**
 * The provider body a fixture kept, or null where it kept none: absent and null both say the file
 * predates kept bodies. A body is the provider's JSON object — anything else is a corpus defect.
 */
function bodyOf(value: JsonValue | undefined, file: string): JsonValue | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`the recorded model answer at ${file} keeps a provider body that is not an object`);
  return value;
}

/**
 * The judgment a fixture recorded, or null where it recorded none: absent and null both say the
 * provider stated nothing about its answer. Anything else must be the record's own shape — a
 * corpus file that says a judgment is a string is a corpus defect, not a null (B-21).
 */
function judgmentOf(value: unknown, file: string): ModelFixture["judgment"] {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`the recorded model answer at ${file} carries a judgment that is not an object`);
  const { provider, confidence, answers } = value as { provider?: unknown; confidence?: unknown; answers?: unknown };
  if (provider !== null && typeof provider !== "string") throw new Error(`the recorded model answer at ${file} names a provider that is not a string`);
  if (confidence !== null && typeof confidence !== "number") throw new Error(`the recorded model answer at ${file} carries a confidence that is not a number`);
  if (answers === null || typeof answers !== "object" || Array.isArray(answers)) throw new Error(`the recorded model answer at ${file} carries a judgment without its answers`);
  return value as NonNullable<ModelFixture["judgment"]>;
}

function parseJson(text: string, file: string): JsonValue {
  try {
    return JSON.parse(text) as JsonValue;
  } catch (failure) {
    throw new Error(`the recorded model answer at ${file} is not JSON`, { cause: failure });
  }
}
