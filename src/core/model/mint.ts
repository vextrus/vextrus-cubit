// Q-08, L-AI-01: the corpus recorder's one door. A fixture is minted ONCE, from the live provider
// behind the key, by a script a person runs on purpose — never by a lane, which replays. This is
// the only place a live answer is written down as the file format the fixture transport reads, so a
// recording and a replay can never disagree about what a fixture holds (B-17).
//
// It refuses to record over a replay: an environment that selects the fixture transport would
// answer from the corpus, and a corpus minted from itself proves nothing.
import { requestHash } from "./canonical";
import { liveTransport } from "./live";
import { selectTransport, type ModelEnv } from "./transport";
import type { ModelCallContext, ModelFixture, ModelRequest } from "./types";

/** What a recording answers with: the fixture to file, and the transport's own account of the call. */
export type Recording = { fixture: ModelFixture; refused: null } | { fixture: null; refused: { code: string; message: string } };

/**
 * One request put to the live provider and answered as the fixture it is filed as. A provider that
 * refuses (a transport-level refusal, which the live transport does not raise today) is answered as
 * the refusal rather than a file; a fault crosses the fault seam and rejects, as any live call does.
 */
export async function recordFixture(env: ModelEnv, fetch: typeof globalThis.fetch, ctx: ModelCallContext, request: ModelRequest): Promise<Recording> {
  const selected = selectTransport(env);
  if (selected.transport !== "live") {
    throw new Error(`the environment selects the fixture transport (root ${selected.fixtureRoot}), so nothing live could be recorded — unset CUBIT_MODEL_FIXTURE_ROOT and leave NODE_ENV off the verify mode to record (Q-08)`);
  }
  const hash = requestHash(request);
  const answer = await liveTransport(env, fetch).answer(ctx, request, hash);
  if (answer.kind === "refused") return { fixture: null, refused: { code: answer.code, message: answer.refusal.message } };
  // The provider's own body is filed beside the reading of it: the reading is what the seam derived
  // today, the body is what the provider said — and a replay reads the body again, so tomorrow's seam
  // is proved against what was answered rather than against what today's derived (`./fixture`).
  const fixture: ModelFixture = { requestHash: hash, modelId: request.modelId, payload: answer.payload, inputTokens: answer.inputTokens, outputTokens: answer.outputTokens, judgment: answer.judgment };
  return { fixture: answer.body === null ? fixture : { ...fixture, body: answer.body }, refused: null };
}
