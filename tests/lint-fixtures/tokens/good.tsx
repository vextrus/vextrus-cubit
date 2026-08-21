/**
 * Silent: the same component, on the Datum tokens (R-UI-001).
 *
 * Every colour it paints is named once in src/ui/tokens.ts and consumed as a CSS variable,
 * so `:root, [data-theme="light"]` and `[data-theme="dark"]` both answer for it. Tailwind
 * sees the token through `@theme`, so the class names carry no bracketed colour.
 */
export function BasisChip(props: { readonly glyph: string; readonly label: string }) {
  return (
    <span
      data-testid="basis-chip"
      className="inline-flex items-center rounded-4 bg-success-surface px-2 text-success"
      style={{
        borderColor: 'var(--graphite-200)',
        boxShadow: 'var(--shadow-1)',
        outlineColor: 'var(--cobalt-500)',
      }}
      aria-label={props.label}
    >
      {props.glyph}
    </span>
  );
}
