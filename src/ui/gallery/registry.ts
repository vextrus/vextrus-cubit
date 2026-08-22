/**
 * The register: every entry module, in the order the sheet reads (§1, §5).
 *
 * The imports are explicit rather than globbed because the sheet's order is the barrels' order
 * and a directory listing is alphabetical — and because an entry that fails to compile should
 * be a named build error, not a module quietly missing from a gallery whose whole job is to
 * show that nothing is missing.
 *
 * What is written down here is entry *modules*, never component export names: the roster of
 * components lives in each entry's `covers` and is compared, at run time, with the barrels
 * (`coverageReport`).
 */
'use client';
import { entry as badge } from './entries/badge';
import { entry as basisChip } from './entries/basis-chip';
import { entry as button } from './entries/button';
import { entry as checkbox } from './entries/checkbox';
import { entry as combobox } from './entries/combobox';
import { entry as consequenceDialog } from './entries/consequence-dialog';
import { entry as contextMenu } from './entries/context-menu';
import { entry as coverageChip } from './entries/coverage-chip';
import { entry as dataTable } from './entries/data-table';
import { entry as dialog } from './entries/dialog';
import { entry as dropdownMenu } from './entries/dropdown-menu';
import { entry as emptyState } from './entries/empty-state';
import { entry as errorState } from './entries/error-state';
import { entry as evidenceLink } from './entries/evidence-link';
import { entry as iconButton } from './entries/icon-button';
import { entry as input } from './entries/input';
import { entry as kbd } from './entries/kbd';
import { entry as numberInput } from './entries/number-input';
import { entry as offlineBanner } from './entries/offline-banner';
import { entry as partialNotice } from './entries/partial-notice';
import { entry as permissionDenied } from './entries/permission-denied';
import { entry as popover } from './entries/popover';
import { entry as progress } from './entries/progress';
import { entry as radioGroup } from './entries/radio-group';
import { entry as refusalState } from './entries/refusal-state';
import { entry as select } from './entries/select';
import { entry as separator } from './entries/separator';
import { entry as sheet } from './entries/sheet';
import { entry as skeleton } from './entries/skeleton';
import { entry as slider } from './entries/slider';
import { entry as switchEntry } from './entries/switch';
import { entry as tabs } from './entries/tabs';
import { entry as tag } from './entries/tag';
import { entry as textarea } from './entries/textarea';
import { entry as toaster } from './entries/toaster';
import { entry as tooltip } from './entries/tooltip';
import { entry as unitBadge } from './entries/unit-badge';
import type { GalleryEntry } from './types';

/** The key of the section heading and rail group a module's entries sit under (§1). */
export type GalleryModuleKey =
  | 'design.module.primitives'
  | 'design.module.patterns'
  | 'design.module.data';

/** One section of the sheet: a heading key and the entries beneath it. */
export interface GalleryModuleGroup {
  readonly moduleKey: GalleryModuleKey;
  readonly entries: readonly GalleryEntry[];
}

export const galleryModules: readonly GalleryModuleGroup[] = [
  {
    moduleKey: 'design.module.primitives',
    entries: [
      button,
      iconButton,
      input,
      textarea,
      numberInput,
      checkbox,
      radioGroup,
      switchEntry,
      slider,
      select,
      combobox,
      tabs,
      tooltip,
      popover,
      dropdownMenu,
      contextMenu,
      dialog,
      sheet,
      toaster,
      badge,
      tag,
      kbd,
      progress,
      skeleton,
      separator,
    ],
  },
  {
    moduleKey: 'design.module.patterns',
    entries: [
      emptyState,
      errorState,
      partialNotice,
      offlineBanner,
      permissionDenied,
      refusalState,
      evidenceLink,
      consequenceDialog,
    ],
  },
  {
    moduleKey: 'design.module.data',
    entries: [dataTable, basisChip, coverageChip, unitBadge],
  },
];

/** Every entry, in the sheet's order. */
export const galleryEntries: readonly GalleryEntry[] = galleryModules.flatMap(
  (group) => group.entries,
);
