import type { ThemeName } from '../tokens';

/**
 * The theme is a cookie the server reads and an attribute the client sets. Both
 * halves live here, outside the client boundary, so the root layout can resolve
 * a theme without pulling the toggle's bundle into the server.
 */
export const THEME_COOKIE = 'cubit-theme';

/** Anything but `dark` is the light theme — an absent cookie included. */
export function resolveTheme(value: string | undefined): ThemeName {
  return value === 'dark' ? 'dark' : 'light';
}
