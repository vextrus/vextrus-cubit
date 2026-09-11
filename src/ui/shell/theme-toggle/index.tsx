"use client";
// R-UI-001's ground, offered as a choice. Density is stored on the account because a row height is
// a property of the person's work; a theme is a property of the screen they are sitting at, so it
// is held in this browser and the same account may be dark on one machine and light on another.
//
// That choice is what lets the control apply before paint at all: the resolver in the root document
// reads the cookie this writes (src/app/theme-resolver.ts), with no round trip and no first frame in
// the wrong theme. "System" is the absence of a choice, not a third value — it clears the cookie and
// lets the device answer.
import { useEffect, useId, useState } from "react";
import { cx } from "../../primitives/core/class-names";
import { strings } from "../../strings";

/** The three answers the control offers; `system` is "no stored answer", not a stored third one. */
export type ThemeChoice = "system" | "light" | "dark";

const OPTION: Readonly<Record<ThemeChoice, { testId: string; label: string }>> = {
  system: { testId: "theme-option-system", label: strings.shell_theme_system },
  light: { testId: "theme-option-light", label: strings.shell_theme_light },
  dark: { testId: "theme-option-dark", label: strings.shell_theme_dark },
};

const CHOICES = Object.keys(OPTION) as readonly ThemeChoice[];
const COOKIE = "cx-theme";
/** The mirror another tab can be told about: a cookie fires no event, `localStorage` does. */
const MIRROR = "cx-theme";

/** The keys that move selection within a radiogroup. */
const MOVES = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];

/** The stored answer as the document holds it right now; `system` when nothing is stored. */
export function storedTheme(cookie: string): ThemeChoice {
  const found = new RegExp(`(?:^|; )${COOKIE}=(dark|light)`).exec(cookie);
  return found === null ? "system" : (found[1] as ThemeChoice);
}

/** What a choice means for the document: the attribute to paint, resolving `system` against the device. */
export function resolveChoice(choice: ThemeChoice, prefersDark: boolean): "dark" | "light" {
  if (choice !== "system") return choice;
  return prefersDark ? "dark" : "light";
}

function write(choice: ThemeChoice): void {
  // One year, site-wide, same-site: a preference, not a session and not a tracker.
  document.cookie =
    choice === "system"
      ? `${COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  try {
    if (choice === "system") window.localStorage.removeItem(MIRROR);
    else window.localStorage.setItem(MIRROR, choice);
  } catch {
    // A browser that refuses storage still gets the cookie, which is the one the resolver reads.
    // There is nothing to tell anybody: the setting took.
  }
}

/**
 * The device's own answer, where the device publishes one. A UA with no `matchMedia` — and the
 * gallery's renderer is one — has no preference to read, so "System" means the ground the document
 * was served on, which is the same reasoning the pre-paint resolver's empty catch stands on.
 */
function prefersDark(): boolean | null {
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function paint(choice: ThemeChoice): void {
  const device = prefersDark();
  if (choice === "system" && device === null) return;
  document.documentElement.setAttribute("data-theme", resolveChoice(choice, device === true));
}

export interface ThemeToggleProps {
  /** The answer the document already holds, so the control never shows one it has to correct. */
  initial?: ThemeChoice;
}

export function ThemeToggle({ initial = "system" }: ThemeToggleProps) {
  const [chosen, setChosen] = useState<ThemeChoice>(initial);
  const labelId = useId();
  const hintId = useId();

  // Two surfaces can change this answer under us: another tab (the mirror fires `storage`), and the
  // device itself while "System" is chosen. Both are the same event to this control — repaint.
  useEffect(() => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== null && event.key !== MIRROR) return;
      const next = storedTheme(document.cookie);
      setChosen(next);
      paint(next);
    };
    const onMedia = (): void => paint(storedTheme(document.cookie));
    window.addEventListener("storage", onStorage);
    media?.addEventListener("change", onMedia);
    return () => {
      window.removeEventListener("storage", onStorage);
      media?.removeEventListener("change", onMedia);
    };
  }, []);

  function choose(choice: ThemeChoice): void {
    if (choice === chosen) return;
    setChosen(choice);
    write(choice);
    paint(choice);
  }

  return (
    <section className="cx-pref">
      <span className="cx-pref-label" id={labelId}>
        {strings.shell_theme_label}
      </span>
      <p className="cx-pref-hint" id={hintId}>
        {strings.shell_theme_hint}
      </p>
      <div className="cx-pref-options" role="radiogroup" data-testid="theme-toggle" aria-labelledby={labelId} aria-describedby={hintId}>
        {CHOICES.map((choice) => {
          const option = OPTION[choice];
          const checked = choice === chosen;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-testid={option.testId}
              className={cx("cx-pref-option", "cx-reticle")}
              onClick={() => choose(choice)}
              onKeyDown={(event) => {
                if (!MOVES.includes(event.key)) return;
                event.preventDefault();
                const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                const at = CHOICES.indexOf(chosen);
                choose(CHOICES[(at + step + CHOICES.length) % CHOICES.length] as ThemeChoice);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
