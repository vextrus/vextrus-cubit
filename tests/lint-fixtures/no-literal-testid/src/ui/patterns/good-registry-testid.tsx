// The lawful counterpart: every id is read from the registry, so a rename is a typed change with
// every caller named (AM-09 §1).
import { TESTIDS, testIdSelector } from "../../testids";

export function GoodPanel(): string {
  const markup = `<div data-testid="${TESTIDS.sHome.grid}"></div>`;
  return markup + testIdSelector(TESTIDS.shell.root);
}
