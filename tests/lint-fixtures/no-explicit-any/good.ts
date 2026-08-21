/**
 * Silent: the unknown value stays unknown until something proves its shape (Q-08). That
 * is the difference between a boundary and a hole in one.
 */
export function normalise(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) return {};
  return { ...(payload as Record<string, unknown>) };
}
