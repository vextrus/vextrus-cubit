"use client";
// R-UI-005's user-reachable control: the two modes a person's tables are drawn at, offered as an
// exclusive set. Membership of an exclusive set is what a density is, so the anatomy is a
// radiogroup of two radios rather than a pressed toggle (docs/design/density-and-prefs.md I-31).
//
// The control is not a form (I-33): activating an option applies it. The checked option moving IS
// the answer, and radio semantics announce it — so there is no saved notice, and the write travels
// through the action the consumer hands in. A write that fails is re-thrown into the root error
// boundary rather than left as a checked option that never persisted.
import { useId, useRef, useState } from "react";
import { cx } from "../../primitives/core/class-names";
import { strings } from "../../strings";
import type { Density } from "../../../core/prefs";

/**
 * What each mode is called and found by. Total over `Density`, so a mode the seam gains and this
 * control does not offer is a type error rather than an option nobody can reach; the render order is
 * this object's own — comfortable first, because the default reads first (Design §1).
 *
 * The roster is spelled here rather than imported: `DENSITIES` is a value in `src/core`, and src/ui
 * reads core for types alone (ARCH-01). The type is what keeps the two in step.
 */
const OPTION: Readonly<Record<Density, { testId: string; label: string }>> = {
  comfortable: { testId: "density-option-comfortable", label: strings.shell_density_comfortable },
  compact: { testId: "density-option-compact", label: strings.shell_density_compact },
};

const MODES = Object.keys(OPTION) as readonly Density[];

/** The other one — with two modes, "the option that is not this one" is total. */
function otherThan(mode: Density): Density {
  return MODES.find((candidate) => candidate !== mode) ?? mode;
}

/** The keys that move selection within a radiogroup; with two members every one of them lands on the other. */
const MOVES = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];

export interface DensityToggleProps {
  /** The stored mode, read server-side before paint — never a default that corrects itself later. */
  density: Density;
  /** The write, handed in by the consumer: this control judges nothing and reaches no seam itself. */
  action: (density: Density) => Promise<void>;
}

export function DensityToggle({ density, action }: DensityToggleProps) {
  // The stored mode is mirrored so the checked option can move with the gesture rather than after the
  // round trip; a mode that arrives from the store afterwards (I-35's revalidation, or another tab)
  // replaces it, so the control never keeps showing a choice the store did not take.
  const [seed, setSeed] = useState<Density>(density);
  const [chosen, setChosen] = useState<Density>(density);
  if (seed !== density) {
    setSeed(density);
    setChosen(density);
  }
  const [pending, setPending] = useState(false);
  // A write that failed is nobody's to swallow: re-thrown on the next render so the root error
  // boundary answers it (ARCH-03) instead of a checked option standing for a preference nobody holds.
  const [failure, setFailure] = useState<unknown>(null);
  if (failure !== null) throw failure;

  const labelId = useId();
  const hintId = useId();
  const options = useRef(new Map<Density, HTMLButtonElement | null>());

  function choose(mode: Density): void {
    // Re-activating the checked option changes nothing, so it writes nothing.
    if (mode === chosen) return;
    setChosen(mode);
    setPending(true);
    void action(mode).then(
      () => setPending(false),
      (cause: unknown) => {
        setPending(false);
        setFailure(cause instanceof Error ? cause : new Error(String(cause)));
      },
    );
  }

  return (
    <section className="cx-density">
      <span className="cx-density-label" id={labelId}>
        {strings.shell_density_label}
      </span>
      <p className="cx-density-hint" id={hintId}>
        {strings.shell_density_hint}
      </p>
      <div
        className="cx-density-group"
        role="radiogroup"
        data-testid="density-toggle"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        aria-busy={pending}
      >
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            ref={(node) => {
              options.current.set(mode, node);
            }}
            className={cx("cx-density-option", "cx-reticle")}
            data-testid={OPTION[mode].testId}
            aria-checked={chosen === mode}
            // Roving tabindex: the group is one tab stop, and it is the checked member (Design §1).
            tabIndex={chosen === mode ? 0 : -1}
            onClick={() => choose(mode)}
            onKeyDown={(event) => {
              if (!MOVES.includes(event.key)) return;
              // Selection follows focus, so the arrow both moves and chooses — one write, like a click.
              event.preventDefault();
              const next = otherThan(mode);
              options.current.get(next)?.focus();
              choose(next);
            }}
          >
            {OPTION[mode].label}
          </button>
        ))}
      </div>
    </section>
  );
}
