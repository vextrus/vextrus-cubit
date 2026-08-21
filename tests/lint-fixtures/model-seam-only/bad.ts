// L-AI-01 fixture: an SDK reached for directly, around callModel.
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function summarise(prompt: string): Promise<string> {
  const reply = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  return JSON.stringify(reply);
}
