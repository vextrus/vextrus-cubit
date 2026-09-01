// L-AI-01: this directory is the allowlist — the seam holds the provider SDKs and its own interior
// transport, and callModel() is the one path it exports to everything above it.
import Anthropic from "@anthropic-ai/sdk";

import { transport } from "./transport";

export async function callModel(ctx: { tenantId: string }, request: { prompt: string }): Promise<string> {
  return await transport(new Anthropic(), ctx, request);
}
