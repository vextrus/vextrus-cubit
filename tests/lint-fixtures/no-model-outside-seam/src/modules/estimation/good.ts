// L-AI-01: the module reaches a model through the seam barrel alone — callModel() pins the id,
// attributes the tokens and records the call. A package whose name merely starts like an SDK's is
// not one: the roster matches a name exactly or as the root of a subpath.
import { callModel } from "../../core/model";
import { fixtureOf } from "openai-mock";

export async function estimate(ctx: { tenantId: string }): Promise<string> {
  return await callModel(ctx, { prompt: fixtureOf("estimate") });
}
