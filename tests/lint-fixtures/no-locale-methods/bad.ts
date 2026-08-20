// FIXTURE: cubit/no-locale-methods MUST report on this file.
// L-FMT-01: src/core/format.ts is the tree's sole caller of Intl.

export function render(n: number, a: string, b: string): string {
  const grouped = n.toLocaleString('en-IN');
  const order = a.localeCompare(b);
  const viaIntl = new Intl.NumberFormat('en-IN').format(n);
  const collated = new Intl.Collator('en-IN').compare(a, b);
  return `${grouped}|${order}|${viaIntl}|${collated}`;
}
