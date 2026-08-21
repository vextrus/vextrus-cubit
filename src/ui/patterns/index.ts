/**
 * The Datum pattern layer (R-UI-050, R-UI-020, R-UI-021) — one import for the states every
 * screen has to be able to render.
 *
 * A screen imports from here and from no file under it, and the stylesheet is imported here so
 * the surfaces arrive with the components — the same rule `src/ui/primitives/index.ts` states,
 * for the same reason.
 *
 * The seventh state, loading, is not here: it is the Skeleton primitive, consumed at the shape
 * of the content it stands in for (docs/design/datum-patterns.md §4).
 */
import './patterns.css';

export { EmptyState, ErrorState, OfflineBanner, PartialNotice, PermissionDenied } from './states';
export type {
  EmptyStateProps,
  ErrorStateProps,
  PartialNoticeProps,
  PermissionDeniedProps,
} from './states';

export { EvidenceLink, RefusalState } from './refusal';
export type { EvidenceLinkProps, RefusalStateProps } from './refusal';

export { ConsequenceDialog } from './consequence-dialog';
export type {
  Consequence,
  ConsequenceDialogProps,
  ConsequenceLine,
  ConfirmResult,
} from './consequence-dialog';

// The string table stays at `src/ui/patterns/strings.ts` (R-SPINE-060).
export type { PatternStringKey } from './strings';
