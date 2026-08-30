// R-UI-030's right inspector: the region that holds the detail of whatever is selected. Nothing on
// the shell's own screens selects anything yet, so it says exactly that — the region exists, and it
// is honest about being empty rather than absent (R-UI-050). Below the lg breakpoint it is not
// painted at all, so the main field keeps its measure at 200 % zoom (R-UI-060).
import { strings } from "../strings";

export function ShellInspector() {
  return (
    <aside className="cx-shell-inspector" data-testid="shell-inspector" aria-label={strings.shell_inspector_label}>
      <p className="cx-shell-inspector-line">{strings.shell_inspector_empty}</p>
    </aside>
  );
}
