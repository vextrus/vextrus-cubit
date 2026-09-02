// L-AI-01: the fixture transport. A request is answered from `<root>/<requestHash>.json`, the file
// format every recorded answer is kept in (F-MODEL), and nothing else: an answer nobody recorded is
// the FIXTURE_MISSING refusal, never a network call. A file that exists but is not a fixture is a
// corpus defect — a plain failure, not a refusal and not a row (I-D).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { refusalOf } from "../errors";
import type { JsonValue, ModelFixture, ModelRequest, TransportAnswer, TransportPort } from "./types";

/** A transport over one fixture root. */
export function fixtureTransport(fixtureRoot: string): TransportPort {
  return {
    transport: "fixture",
    async answer(_ctx, request, hash): Promise<TransportAnswer> {
      const file = join(fixtureRoot, `${hash}.json`);
      const text = await recordedText(file);
      if (text === null) {
        const entry = refusalOf("FIXTURE_MISSING");
        const refusal = Object.assign(new Error(`no recorded model answer for request ${hash} exists at ${file}`), { refusalCode: entry.code });
        return { kind: "refused", code: entry.code, refusal };
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
  if (!isTokenCount(inputTokens) || !isTokenCount(outputTokens)) {
    throw new Error(`the recorded model answer at ${file} does not count its tokens as whole, non-negative numbers`);
  }
  return { requestHash: hash, modelId: request.modelId, payload: parsed["payload"] as JsonValue, inputTokens, outputTokens };
}

function parseJson(text: string, file: string): JsonValue {
  try {
    return JSON.parse(text) as JsonValue;
  } catch (failure) {
    throw new Error(`the recorded model answer at ${file} is not JSON`, { cause: failure });
  }
}

const isTokenCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
