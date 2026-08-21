/**
 * Silent: nothing is switched off (Q-08). Where a value's shape is not known, it is
 * narrowed rather than muted — which is what the guardrail is protecting.
 */
export interface Sheet {
  readonly id: string;
  readonly label: string;
}

export function isSheet(value: unknown): value is Sheet {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['id'] === 'string' && typeof candidate['label'] === 'string';
}
