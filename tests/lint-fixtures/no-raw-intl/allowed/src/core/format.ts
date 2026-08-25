// LAW-FMT: this path is the allowlist — the tree's sole caller of Intl. The allowlist is the exact
// file, not a pattern, so a sibling in the same directory is still refused.
const numbers = new Intl.NumberFormat("en-GB");
const collator = new Intl.Collator("en-GB");

export function formatMoney(amount: number): string {
  return numbers.format(amount);
}

export function compareNames(left: string, right: string): number {
  return collator.compare(left, right);
}
