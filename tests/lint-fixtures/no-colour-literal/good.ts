/**
 * Silent: colour is named in src/ui/tokens.ts and consumed as a CSS variable (R-UI-001),
 * so `:root` and `[data-theme]` both answer for it.
 */
export const accent = 'var(--colour-accent)';

export function shadow(): string {
  return 'var(--elevation-1)';
}
