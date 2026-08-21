/**
 * The Datum data layer (R-UI-010) — one import for the table and the marks that annotate it.
 *
 * A screen imports from here and from no file under it: the module is the unit, and the split
 * into datatable.tsx and chips.tsx is this module's own business. The stylesheet is imported
 * here for the same reason `src/ui/primitives/index.ts` imports its own — the surfaces arrive
 * with the components, so there is no second import a screen can forget.
 *
 * R-UI-010's data roster is longer than this: Tree, Sparkline and the chart wrappers are later
 * leaves of this same module and land on this same barrel.
 */
import './data.css';

export { DataTable } from './datatable';
export type { DataTableColumn, DataTableProps, DataTableState } from './datatable';

export { BasisChip, CoverageChip, UnitBadge } from './chips';
export type { BasisChipProps, CoverageChipProps, UnitBadgeProps } from './chips';

// The string table stays at `src/ui/data/strings.ts`, as R-SPINE-060 puts it and as the
// Design Decision reads it; a second name for it here would be a second place to look.
export type { DataStringKey } from './strings';
