// L-AI-01: the fixture transport. A request is answered from `<root>/<requestHash>.json`, the file
// format every recorded answer is kept in (F-MODEL), and nothing else: an answer nobody recorded is
// the FIXTURE_MISSING refusal, never a network call. A file that exists but is not a fixture is a
// corpus defect — a plain failure, not a refusal and not a row (B-21).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RefusalCode } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { tokenCount } from "../model-ledger.types";
import type { JsonValue, ModelFixture, ModelRequest, TransportAnswer, TransportPort } from "./types";

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
      return { kind: "answered", payload: fixture.payload, inputTokens: fixture.inputTokens, outputTokens: fixture.outputTokens };
    },
  };
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
  return { requestHash: hash, modelId: request.modelId, payload: parsed["payload"] as JsonValue, inputTokens: tokenCount(inputTokens), outputTokens: tokenCount(outputTokens) };
}

function parseJson(text: string, file: string): JsonValue {
  try {
    return JSON.parse(text) as JsonValue;
  } catch (failure) {
    throw new Error(`the recorded model answer at ${file} is not JSON`, { cause: failure });
  }
}
