// Q-08 fixture: `unknown` keeps the caller honest.
export function normalise(payload: unknown): unknown {
  return payload;
}

export const cache: Record<string, unknown> = {};
