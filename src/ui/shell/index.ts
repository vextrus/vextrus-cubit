/**
 * The shell layer (R-UI-030, R-UI-031, R-UI-050) — one import for the frame every signed-in
 * `/t/{tenantSlug}` route renders inside, and for the seven states each of its areas can show.
 *
 * The stylesheet is imported here so the frame arrives with its rules, exactly as
 * `src/ui/primitives/index.ts` and `src/ui/patterns/index.ts` bring theirs.
 *
 * The string table stays at `src/ui/shell/strings.ts` (R-SPINE-060), and the contract values
 * are re-exported because a Server Component reading them from `app-shell.tsx` would receive a
 * client reference rather than the value.
 */
import './shell.css';

export { AppShell } from './app-shell';
export type { AppShellProps, TenantOption } from './app-shell';

export { ShellAreaState } from './shell-area-state';
export type { ShellAreaStateProps } from './shell-area-state';

export {
  RAIL_AREAS,
  SHELL_SHAPES,
  SHELL_STATES,
  TENANT_HOME_SEGMENT,
  segmentOf,
  tenantPath,
} from './contract';
export type { RailArea, ShellSkeletonShape, ShellState } from './contract';

export type { ShellStringKey } from './strings';
