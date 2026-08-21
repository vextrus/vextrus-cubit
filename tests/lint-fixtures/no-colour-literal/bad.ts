/**
 * Fires: cubit/no-colour-literal (R-UI-001).
 * A hex written into a component and a functional colour built into a style string: two
 * colours the theme switch will never reach.
 */
export const accent = '#2447f0';

export function shadow(alpha: number): string {
  return `0 1px 2px rgba(16, 18, 27, ${alpha})`;
}
