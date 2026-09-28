/*
 * Development only: `?lang=en-XB` shows the shell in the test-only pseudo right-to-left language for
 * the design gate's screenshots (docs/design/m0-screens.md §1.8, §8 item 10), over the Market's own
 * language. main.tsx reads the address once, inside `import.meta.env.DEV`, so neither the flag's use
 * nor the pseudo language reaches a production bundle (scripts/check-dist.mjs). Tests set it too.
 */
let overridden = false

export function overrideLanguage(on = true): void {
  overridden = on
}

export function languageIsOverridden(): boolean {
  return overridden
}
