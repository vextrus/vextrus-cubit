/**
 * Fires: cubit/no-colour-literal (R-UI-001), on the shapes a *component* takes.
 *
 * The committed pair under `no-colour-literal/` proves the rule on a constant and a
 * template string. This pair proves it where the Datum token sheet actually gets bypassed:
 * a Tailwind arbitrary value in `className`, and a functional colour in an inline style —
 * both of them colours that no `[data-theme]` switch will ever reach.
 *
 * Broken on purpose. Config-ignored for a repo-wide `eslint .`; linted one file at a time
 * with ignores off. Its silent twin is good.tsx — the same component on var(--…) tokens.
 */
export function BasisChip(props: { readonly glyph: string; readonly label: string }) {
  return (
    <span
      data-testid="basis-chip"
      className="inline-flex items-center rounded-[4px] bg-[#E7F5EC] px-[6px] text-[#1D7A46]"
      style={{
        borderColor: 'rgba(29, 122, 70, 0.24)',
        boxShadow: `0 1px 2px 0 rgba(16, 20, 26, 0.06)`,
        outlineColor: 'oklch(0.62 0.19 262)',
      }}
      aria-label={props.label}
    >
      {props.glyph}
    </span>
  );
}
