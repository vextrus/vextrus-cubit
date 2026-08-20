'use client';

import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { strings } from '../strings/common';
import type { ThemeName } from '../tokens';
import { THEME_COOKIE } from './theme';

/**
 * R-UI-001 — both themes are defined on `:root` and `[data-theme]`, so switching
 * is one attribute. The cookie makes the choice survive the next request; the
 * attribute makes it survive the next paint.
 */
export function ThemeToggle({ initial }: { initial: ThemeName }) {
  const [theme, setTheme] = useState<ThemeName>(initial);
  const next: ThemeName = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="button button-quiet"
      data-testid="theme-toggle"
      aria-label={theme === 'dark' ? strings.themeToggleToLight : strings.themeToggleToDark}
      onClick={() => {
        document.documentElement.setAttribute('data-theme', next);
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
    </button>
  );
}
