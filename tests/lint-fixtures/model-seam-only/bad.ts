/**
 * Fires: cubit/model-seam-only (L-AI-01).
 * A second path to the model: the SDK imported outside src/core, where nothing pins the
 * model id, attributes the tokens to a tenant, or writes the model-call ledger.
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function describeSheet(prompt: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  return JSON.stringify(message.content);
}
