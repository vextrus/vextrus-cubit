// L-AI-01 fixture: the one path to a model.
import { callModel } from '@/core/model';

export async function summarise(prompt: string): Promise<string> {
  return callModel({ purpose: 'summarise', prompt });
}
