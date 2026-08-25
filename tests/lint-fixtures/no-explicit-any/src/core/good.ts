// Q-08: `unknown` carries the same ignorance without discarding the type.
export function widen(value: unknown): unknown {
  return value;
}

export const box: Array<unknown> = [];
