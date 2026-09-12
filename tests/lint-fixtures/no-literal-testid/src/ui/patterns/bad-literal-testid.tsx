// AM-09 §1: a literal test id outside src/ui/testids.ts is a defect — the registry is where an id
// is DECLARED, and a name with no declaration is one a rename cannot find.
export function BadPanel(): string {
  const markup = '<div data-testid="s-home-grid"></div>'; // RECORDED REASON AM-09
  const selector = '[data-testid="shell-root"]'; // RECORDED REASON AM-09
  const minted = '<div data-testid="a-hook-no-registry-declares"></div>'; // RECORDED REASON AM-09
  return markup + selector + minted;
}
