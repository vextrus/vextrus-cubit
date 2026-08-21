'use client';
/**
 * The gallery registry (R-UI-011, Design Decision §3).
 *
 * One entry per component family the three Datum barrels export, in the document's order,
 * each carrying every state that document names. `covers` is the contract with AC-2: the
 * union of every entry's `covers` must equal the barrels' capitalised value exports, so a
 * component added to a barrel without an entry here reddens
 * `src/app/design/__tests__/registry.acceptance.test.ts`. That is what makes this a living
 * gallery rather than a page somebody remembered to update once.
 *
 * A state renders through a function rather than an element so nothing here mounts until the
 * page asks for it — the registry is data that a screen, a test or a future documentation
 * page can read, and reading it costs no React.
 *
 * Two kinds of string appear below. Anything a reader reads is `ds(key)` — decided in §6,
 * never written here (AM-03 (2)). Marks, quantities, identifiers, glyphs and option values
 * are sample *data*, and they live here as module constants, rendered verbatim.
 */
import { useId, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Combobox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Kbd,
  NumberInput,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  Radio,
  RadioGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tag,
  Textarea,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  toast,
} from '../../ui/primitives';
import type { ComboboxOption } from '../../ui/primitives';
import {
  ConsequenceDialog,
  EmptyState,
  ErrorState,
  EvidenceLink,
  OfflineBanner,
  PartialNotice,
  PermissionDenied,
  RefusalState,
} from '../../ui/patterns';
import type { Consequence, ConfirmResult } from '../../ui/patterns';
import { BasisChip, CoverageChip, DataTable, UnitBadge } from '../../ui/data';
import type { DataTableColumn } from '../../ui/data';
import type { BasisCode } from '../../ui/tokens';
import type { Unit } from '../../core/format';
import { ds } from './strings';

/** One state of one entry: the name the page writes into `data-gallery-state`, and its specimen. */
export interface GalleryState {
  readonly name: string;
  readonly render: () => ReactElement;
}

/** One entry: a component family, the barrel exports it demonstrates, and its states. */
export interface GalleryEntry {
  readonly slug: string;
  readonly covers: readonly string[];
  readonly states: readonly GalleryState[];
}

/* ── Sample data (§3, §6): identifiers, marks, numerals and glyphs, rendered verbatim. ── */

const HASH = '#';
const CLOSE_GLYPH_PATH = 'M4 4l8 8M12 4l-8 8';
const GLYPH_BOX = '0 0 16 16';
const THREE = 'three';
/** Checkbox's third value is a state name the component takes, not a word a reader reads. */
const INDETERMINATE = 'indeterminate';
const VOLUME_DEFAULT = '1234567.895';
const VOLUME_DISABLED = '250';
const VOLUME_INVALID = '0';
const CUBIC_METRE = 'm³';
const NOTES_ROWS = 3;
const DENSITY_COMFORTABLE = 'comfortable';
const DENSITY_COMPACT = 'compact';
const ELEMENT_WALL = 'wall';
const ELEMENT_COLUMN = 'column';
const ELEMENT_BEAM = 'beam';
const ELEMENT_SLAB = 'slab';
const NO_MATCH = 'z';
const CONDITION_C25_COLUMNS = 'c25-columns';
const CONDITION_C25_WALLS = 'c25-walls';
const CONDITION_FORMWORK = 'formwork-columns';
const TAB_QUANTITIES = 'quantities';
const TAB_SOURCES = 'sources';
const TAB_HISTORY = 'history';
const SHEET_NAME_VALUE = 'S-201 Column layout';
const REPORT_ID = 'RPT-3F82C1';
const REFUSED_COUNT = 3;
const SIGN_PERMISSION = 'estimate.sign';
const OPACITY_MIN = 0;
const OPACITY_MAX = 100;
const OPACITY_VALUE = 60;
const STOREY_MIN = 1;
const STOREY_MAX = 40;
const STOREY_RANGE: readonly number[] = [3, 12];
const PROGRESS_MAX = 100;
const PROGRESS_ZERO = 0;
const PROGRESS_MIDWAY = 64;
const PROGRESS_COMPLETE = 100;
const COVERAGE_COVERED = 12;
const COVERAGE_TOTAL = 14;
const CMD_GLYPH = '⌘';
const K_GLYPH = 'K';
const VOID_DIGEST = 'digest-4f1a';
const VOID_SIGNATURES = 1;
const VOID_UNFROZEN = 214;
const VOID_SUPERSEDED = 3;
const CONFIRMED: ConfirmResult = { ok: true };

/** The seven basis codes, in R-UI-002's order — the whole palette on one row. */
const BASIS_CODES: readonly BasisCode[] = [
  'MEASURED',
  'TRANSCRIBED',
  'DERIVED',
  'IMPORTED',
  'ENTERED',
  'INTERPRETED',
  'DEFAULTED',
];

/** Every unit the seam renders (L-FMT-02). */
const UNITS: readonly Unit[] = ['m', 'm2', 'm3', 'kg', 'nos'];

/** Nothing happens: a specimen commits no work. */
function noop(): void {
  /* A gallery specimen is a picture of a control, not a control over anything. */
}

/* ── Small wrappers: a name that is unique per mount, and the state a control needs. ── */

/** A labelled form control — `useId` so two specimens never share one `for`/`id` pair. */
function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: (id: string) => ReactNode;
}): ReactElement {
  const id = useId();
  return (
    <div className="gallery-field">
      <label className="gallery-field-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/** The same, for a control that is named by `aria-labelledby` rather than by a `<label>`. */
function Named({
  label,
  children,
}: {
  readonly label: string;
  readonly children: (id: string) => ReactNode;
}): ReactElement {
  const id = useId();
  return (
    <div className="gallery-field">
      <span className="gallery-field-label" id={id}>
        {label}
      </span>
      {children(id)}
    </div>
  );
}

/** A choice control beside the words that name it. */
function Choice({
  label,
  children,
}: {
  readonly label: string;
  readonly children: (id: string) => ReactNode;
}): ReactElement {
  const id = useId();
  return (
    <div className="gallery-choice">
      {children(id)}
      <span className="gallery-field-label" id={id}>
        {label}
      </span>
    </div>
  );
}

/** IconButton's glyph: drawn here rather than shipped, so no font arrives with it (§8). */
function CloseGlyph(): ReactElement {
  return (
    <svg viewBox={GLYPH_BOX} width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d={CLOSE_GLYPH_PATH} />
    </svg>
  );
}

/** NumberInput is controlled by contract (B-07): the specimen holds the string it shows. */
function SampleNumber({
  initial,
  disabled,
  invalid,
}: {
  readonly initial: string;
  readonly disabled: boolean;
  readonly invalid: boolean;
}): ReactElement {
  const [value, setValue] = useState(initial);
  return (
    <Field label={ds('design.sample.concreteVolume')}>
      {(id) => (
        <NumberInput
          id={id}
          value={value}
          onValueChange={setValue}
          unit={CUBIC_METRE}
          disabled={disabled}
          aria-invalid={invalid}
        />
      )}
    </Field>
  );
}

/** The three conditions, and the query that matches none of them (§3). */
const CONDITION_OPTIONS: readonly ComboboxOption[] = [
  { value: CONDITION_C25_COLUMNS, label: ds('design.sample.conditionC25Columns') },
  { value: CONDITION_C25_WALLS, label: ds('design.sample.conditionC25Walls') },
  { value: CONDITION_FORMWORK, label: ds('design.sample.conditionFormwork') },
];

function loadConditions(query: string): Promise<readonly ComboboxOption[]> {
  return Promise.resolve(query.includes(NO_MATCH) ? [] : CONDITION_OPTIONS);
}

/** The toast entry's trigger feeds the one `<Toaster />` the page mounts (§2). */
function showNotification(): void {
  toast(ds('design.sample.estimateSaved'));
}

/** ConsequenceDialog opens from a trigger, so the specimen holds the open flag. */
const VOID_CONSEQUENCE: Consequence = {
  digest: VOID_DIGEST,
  lines: [
    { key: 'signatures', label: ds('design.sample.voidSignatures'), count: VOID_SIGNATURES },
    { key: 'unfrozen', label: ds('design.sample.voidUnfrozen'), count: VOID_UNFROZEN },
    { key: 'superseded', label: ds('design.sample.voidSuperseded'), count: VOID_SUPERSEDED },
  ],
};

function confirmVoid(): Promise<ConfirmResult> {
  return Promise.resolve(CONFIRMED);
}

function SampleConsequence(): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        {ds('design.sample.voidSignature')}
      </Button>
      <ConsequenceDialog
        open={open}
        onOpenChange={setOpen}
        title={ds('design.sample.voidTitle')}
        consequence={VOID_CONSEQUENCE}
        onConfirm={confirmVoid}
      />
    </>
  );
}

/* ── The DataTable specimen (§4). ── */

interface EstimateRow {
  readonly mark: string;
  readonly element: string;
  readonly quantity: string;
  readonly basis: BasisCode;
}

const MARK = 'mark';
const ELEMENT = 'element';
const QUANTITY = 'quantity';
const BASIS = 'basis';
const NUMERIC_COLUMN = { numeric: true };
const MARK_WIDTH = 96;
const TABLE_HEIGHT = 280;
const ROW_HEIGHT = 36;
const TOTAL_QUANTITY = '96.510';
const SORTED_BY_MARK = [{ id: MARK, desc: false }];
const GROUPED_BY_ELEMENT = [ELEMENT];
const SELECTED_ROW = { 'C-02': true };
const LOADING_BARS = [0, 1, 2, 3];

const ESTIMATE_ROWS: readonly EstimateRow[] = [
  { mark: 'C-01', element: 'Wall', quantity: '12.400', basis: 'MEASURED' },
  { mark: 'C-02', element: 'Column', quantity: '3.240', basis: 'MEASURED' },
  { mark: 'C-03', element: 'Beam', quantity: '5.130', basis: 'TRANSCRIBED' },
  { mark: 'C-04', element: 'Slab', quantity: '48.600', basis: 'DERIVED' },
  { mark: 'C-05', element: 'Wall', quantity: '9.860', basis: 'IMPORTED' },
  { mark: 'C-06', element: 'Column', quantity: '3.240', basis: 'ENTERED' },
  { mark: 'C-07', element: 'Beam', quantity: '4.480', basis: 'INTERPRETED' },
  { mark: 'C-08', element: 'Slab', quantity: '9.560', basis: 'DEFAULTED' },
];

const NO_ROWS: readonly EstimateRow[] = [];

function estimateColumns(): DataTableColumn<EstimateRow>[] {
  return [
    {
      id: MARK,
      accessorKey: MARK,
      header: ds('design.sample.colMark'),
      enableSorting: true,
      size: MARK_WIDTH,
    },
    { id: ELEMENT, accessorKey: ELEMENT, header: ds('design.sample.colElement') },
    {
      id: QUANTITY,
      accessorKey: QUANTITY,
      header: ds('design.sample.colQuantity'),
      enableSorting: true,
      meta: NUMERIC_COLUMN,
    },
    {
      id: BASIS,
      accessorKey: BASIS,
      header: ds('design.sample.colBasis'),
      cell: (info) => <BasisChip basis={info.row.original.basis} />,
    },
  ];
}

function rowId(row: EstimateRow): string {
  return row.mark;
}

/** The sticky footer: what the column adds up to, in the column's own alignment (§4). */
function tableFooter(): ReactElement {
  return (
    <div className="gallery-table-footer">
      <span>{ds('design.sample.total')}</span>
      <span className="numeric">{TOTAL_QUANTITY}</span>
    </div>
  );
}

function SampleTable({
  rows,
  selected,
  grouped,
}: {
  readonly rows: readonly EstimateRow[];
  readonly selected: boolean;
  readonly grouped: boolean;
}): ReactElement {
  return (
    <DataTable
      data={rows}
      columns={estimateColumns()}
      getRowId={rowId}
      height={TABLE_HEIGHT}
      estimateRowHeight={ROW_HEIGHT}
      enableRowSelection={selected}
      state={{
        sorting: SORTED_BY_MARK,
        grouping: grouped ? GROUPED_BY_ELEMENT : [],
        rowSelection: selected ? SELECTED_ROW : {},
      }}
      emptyReason={ds('design.sample.tableEmpty')}
      footer={tableFooter()}
    />
  );
}

/**
 * §4's loading state: "the composing-screen recipe from datum-patterns §4 — four Skeleton
 * bars … in place of the table. No spinner exists on this page."
 */
function SampleTableLoading(): ReactElement {
  return (
    <div className="gallery-table-loading">
      {LOADING_BARS.map((bar) => (
        <Skeleton key={bar} className="gallery-table-loading-bar" />
      ))}
    </div>
  );
}

/* ── The roster (§3), in the document's order. ── */

export const galleryEntries: readonly GalleryEntry[] = [
  {
    slug: 'button',
    covers: ['Button', 'IconButton'],
    states: [
      { name: 'primary', render: () => <Button>{ds('design.sample.save')}</Button> },
      {
        name: 'secondary',
        render: () => <Button variant="secondary">{ds('design.sample.duplicate')}</Button>,
      },
      { name: 'ghost', render: () => <Button variant="ghost">{ds('design.sample.dismiss')}</Button> },
      {
        name: 'danger',
        render: () => <Button variant="danger">{ds('design.sample.deleteRow')}</Button>,
      },
      { name: 'disabled', render: () => <Button disabled>{ds('design.sample.save')}</Button> },
      { name: 'loading', render: () => <Button loading>{ds('design.sample.save')}</Button> },
      {
        name: 'icon-button',
        render: () => <IconButton label={ds('design.sample.close')} icon={<CloseGlyph />} />,
      },
    ],
  },
  {
    slug: 'input',
    covers: ['Input', 'Textarea'],
    states: [
      {
        name: 'default',
        render: () => (
          <Field label={ds('design.sample.projectName')}>
            {(id) => <Input id={id} placeholder={ds('design.sample.untitledProject')} />}
          </Field>
        ),
      },
      {
        name: 'disabled',
        render: () => (
          <Field label={ds('design.sample.projectName')}>
            {(id) => <Input id={id} disabled placeholder={ds('design.sample.untitledProject')} />}
          </Field>
        ),
      },
      { name: 'invalid', render: () => <InvalidInput /> },
      {
        name: 'textarea',
        render: () => (
          <Field label={ds('design.sample.notes')}>
            {(id) => (
              <Textarea id={id} rows={NOTES_ROWS} defaultValue={ds('design.sample.notesValue')} />
            )}
          </Field>
        ),
      },
    ],
  },
  {
    slug: 'number-input',
    covers: ['NumberInput'],
    states: [
      {
        name: 'default',
        render: () => <SampleNumber initial={VOLUME_DEFAULT} disabled={false} invalid={false} />,
      },
      {
        name: 'disabled',
        render: () => <SampleNumber initial={VOLUME_DISABLED} disabled invalid={false} />,
      },
      {
        name: 'invalid',
        render: () => <SampleNumber initial={VOLUME_INVALID} disabled={false} invalid />,
      },
    ],
  },
  {
    slug: 'checkbox',
    covers: ['Checkbox'],
    states: [
      {
        name: 'unchecked',
        render: () => (
          <Choice label={ds('design.sample.includeOpenings')}>
            {(id) => <Checkbox aria-labelledby={id} checked={false} onCheckedChange={noop} />}
          </Choice>
        ),
      },
      {
        name: 'checked',
        render: () => (
          <Choice label={ds('design.sample.includeOpenings')}>
            {(id) => <Checkbox aria-labelledby={id} checked onCheckedChange={noop} />}
          </Choice>
        ),
      },
      {
        name: 'indeterminate',
        render: () => (
          <Choice label={ds('design.sample.includeOpenings')}>
            {(id) => (
              <Checkbox aria-labelledby={id} checked={INDETERMINATE} onCheckedChange={noop} />
            )}
          </Choice>
        ),
      },
      {
        name: 'disabled',
        render: () => (
          <Choice label={ds('design.sample.includeOpenings')}>
            {(id) => <Checkbox aria-labelledby={id} disabled checked={false} onCheckedChange={noop} />}
          </Choice>
        ),
      },
    ],
  },
  {
    slug: 'radio-group',
    covers: ['RadioGroup', 'Radio'],
    states: [
      { name: 'default', render: () => <SampleRadios disabled={false} /> },
      { name: 'disabled', render: () => <SampleRadios disabled /> },
    ],
  },
  {
    slug: 'switch',
    covers: ['Switch'],
    states: [
      {
        name: 'off',
        render: () => (
          <Choice label={ds('design.sample.snapToGrid')}>
            {(id) => <Switch aria-labelledby={id} checked={false} onCheckedChange={noop} />}
          </Choice>
        ),
      },
      {
        name: 'on',
        render: () => (
          <Choice label={ds('design.sample.snapToGrid')}>
            {(id) => <Switch aria-labelledby={id} checked onCheckedChange={noop} />}
          </Choice>
        ),
      },
      {
        name: 'disabled',
        render: () => (
          <Choice label={ds('design.sample.snapToGrid')}>
            {(id) => <Switch aria-labelledby={id} disabled checked onCheckedChange={noop} />}
          </Choice>
        ),
      },
    ],
  },
  {
    slug: 'slider',
    covers: ['Slider'],
    states: [
      {
        name: 'single',
        render: () => (
          <div className="gallery-field">
            <span className="gallery-field-label">{ds('design.sample.sheetOpacity')}</span>
            <Slider
              aria-label={ds('design.sample.sheetOpacity')}
              min={OPACITY_MIN}
              max={OPACITY_MAX}
              value={OPACITY_VALUE}
              onValueChange={noop}
            />
          </div>
        ),
      },
      {
        name: 'range',
        render: () => (
          <div className="gallery-field">
            <span className="gallery-field-label">{ds('design.sample.storeyRange')}</span>
            <Slider
              aria-label={ds('design.sample.storeyRange')}
              min={STOREY_MIN}
              max={STOREY_MAX}
              value={STOREY_RANGE}
              onValueChange={noop}
            />
          </div>
        ),
      },
    ],
  },
  {
    slug: 'select',
    covers: ['Select', 'SelectTrigger', 'SelectValue', 'SelectContent', 'SelectItem'],
    states: [
      { name: 'placeholder', render: () => <SampleSelect chosen={false} disabled={false} /> },
      { name: 'selected', render: () => <SampleSelect chosen disabled={false} /> },
      { name: 'disabled', render: () => <SampleSelect chosen={false} disabled /> },
    ],
  },
  {
    slug: 'combobox',
    covers: ['Combobox'],
    states: [
      {
        name: 'default',
        render: () => (
          <Named label={ds('design.sample.condition')}>
            {(id) => (
              <Combobox
                aria-labelledby={id}
                loadOptions={loadConditions}
                placeholder={ds('design.sample.conditionPlaceholder')}
              />
            )}
          </Named>
        ),
      },
      {
        name: 'disabled',
        render: () => (
          <Named label={ds('design.sample.condition')}>
            {(id) => (
              <Combobox
                aria-labelledby={id}
                disabled
                loadOptions={loadConditions}
                placeholder={ds('design.sample.conditionPlaceholder')}
              />
            )}
          </Named>
        ),
      },
    ],
  },
  {
    slug: 'tabs',
    covers: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],
    states: [
      {
        name: 'default',
        render: () => (
          <Tabs defaultValue={TAB_QUANTITIES}>
            <TabsList>
              <TabsTrigger value={TAB_QUANTITIES}>{ds('design.sample.tabQuantities')}</TabsTrigger>
              <TabsTrigger value={TAB_SOURCES}>{ds('design.sample.tabSources')}</TabsTrigger>
              <TabsTrigger value={TAB_HISTORY}>{ds('design.sample.tabHistory')}</TabsTrigger>
            </TabsList>
            <TabsContent value={TAB_QUANTITIES}>{ds('design.sample.tabQuantitiesBody')}</TabsContent>
            <TabsContent value={TAB_SOURCES}>{ds('design.sample.tabSourcesBody')}</TabsContent>
            <TabsContent value={TAB_HISTORY}>{ds('design.sample.tabHistoryBody')}</TabsContent>
          </Tabs>
        ),
      },
    ],
  },
  {
    slug: 'tooltip',
    covers: ['Tooltip', 'TooltipTrigger', 'TooltipContent'],
    states: [
      {
        name: 'trigger',
        render: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">{ds('design.sample.measuredBasis')}</Button>
            </TooltipTrigger>
            <TooltipContent>{ds('design.sample.measuredTooltip')}</TooltipContent>
          </Tooltip>
        ),
      },
    ],
  },
  {
    slug: 'popover',
    covers: ['Popover', 'PopoverTrigger', 'PopoverContent'],
    states: [
      {
        name: 'trigger',
        render: () => (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary">{ds('design.sample.columnRef')}</Button>
            </PopoverTrigger>
            <PopoverContent>{ds('design.sample.columnDetail')}</PopoverContent>
          </Popover>
        ),
      },
    ],
  },
  {
    slug: 'dropdown-menu',
    covers: ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem'],
    states: [
      {
        name: 'trigger',
        render: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">{ds('design.sample.actions')}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>{ds('design.sample.duplicate')}</DropdownMenuItem>
              <DropdownMenuItem>{ds('design.sample.rename')}</DropdownMenuItem>
              <DropdownMenuItem data-tone="danger">{ds('design.sample.deleteRow')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
  },
  {
    slug: 'context-menu',
    covers: ['ContextMenu', 'ContextMenuContent', 'ContextMenuItem', 'ContextMenuTrigger'],
    states: [
      {
        name: 'trigger',
        render: () => (
          <ContextMenu>
            <ContextMenuTrigger className="gallery-context-target">
              {ds('design.sample.contextTarget')}
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem>{ds('design.sample.copyValue')}</ContextMenuItem>
              <ContextMenuItem>{ds('design.sample.traceToDrawing')}</ContextMenuItem>
              <ContextMenuItem>{ds('design.sample.clearCell')}</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ),
      },
    ],
  },
  {
    slug: 'dialog',
    covers: [
      'Dialog',
      'DialogTrigger',
      'DialogContent',
      'DialogTitle',
      'DialogDescription',
      'DialogClose',
    ],
    states: [{ name: 'trigger', render: () => <SampleDialog /> }],
  },
  {
    slug: 'sheet',
    covers: ['Sheet', 'SheetTrigger', 'SheetContent', 'SheetTitle', 'SheetClose'],
    states: [
      {
        name: 'trigger',
        render: () => (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">{ds('design.sample.openInspector')}</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>{ds('design.sample.inspector')}</SheetTitle>
              <p>{ds('design.sample.inspectorEmpty')}</p>
              <SheetClose asChild>
                <Button variant="secondary">{ds('design.sample.close')}</Button>
              </SheetClose>
            </SheetContent>
          </Sheet>
        ),
      },
    ],
  },
  {
    slug: 'toast',
    covers: ['Toaster'],
    states: [
      {
        name: 'trigger',
        render: () => (
          <Button variant="secondary" onClick={showNotification}>
            {ds('design.sample.showNotification')}
          </Button>
        ),
      },
    ],
  },
  {
    slug: 'badge',
    covers: ['Badge'],
    states: [
      { name: 'neutral', render: () => <Badge tone="neutral">{ds('design.sample.draft')}</Badge> },
      { name: 'success', render: () => <Badge tone="success">{ds('design.sample.signed')}</Badge> },
      { name: 'warn', render: () => <Badge tone="warn">{ds('design.sample.stale')}</Badge> },
      { name: 'danger', render: () => <Badge tone="danger">{ds('design.sample.voided')}</Badge> },
      { name: 'info', render: () => <Badge tone="info">{ds('design.sample.importedBadge')}</Badge> },
    ],
  },
  {
    slug: 'tag',
    covers: ['Tag'],
    states: [
      { name: 'default', render: () => <Tag>{ds('design.sample.level3')}</Tag> },
      { name: 'removable', render: () => <Tag onRemove={noop}>{ds('design.sample.level3')}</Tag> },
    ],
  },
  {
    slug: 'kbd',
    covers: ['Kbd'],
    states: [
      {
        name: 'default',
        render: () => (
          <span className="gallery-keys">
            <Kbd>{CMD_GLYPH}</Kbd>
            <Kbd>{K_GLYPH}</Kbd>
          </span>
        ),
      },
    ],
  },
  {
    slug: 'progress',
    covers: ['Progress'],
    states: [
      {
        name: 'zero',
        render: () => (
          <Progress
            aria-label={ds('design.sample.importProgress')}
            value={PROGRESS_ZERO}
            max={PROGRESS_MAX}
          />
        ),
      },
      {
        name: 'midway',
        render: () => (
          <Progress
            aria-label={ds('design.sample.importProgress')}
            value={PROGRESS_MIDWAY}
            max={PROGRESS_MAX}
          />
        ),
      },
      {
        name: 'complete',
        render: () => (
          <Progress
            aria-label={ds('design.sample.importProgress')}
            value={PROGRESS_COMPLETE}
            max={PROGRESS_MAX}
          />
        ),
      },
    ],
  },
  {
    slug: 'skeleton',
    covers: ['Skeleton'],
    states: [
      {
        name: 'default',
        render: () => (
          <div className="gallery-skeleton-row">
            <Skeleton className="gallery-skeleton-line" />
            <Skeleton className="gallery-skeleton-line" />
            <Skeleton className="gallery-skeleton-block" />
          </div>
        ),
      },
    ],
  },
  {
    slug: 'separator',
    covers: ['Separator'],
    states: [
      {
        name: 'horizontal',
        render: () => (
          <div className="gallery-separator-stack">
            <span>{ds('design.sample.tabQuantities')}</span>
            <Separator />
            <span>{ds('design.sample.tabSources')}</span>
          </div>
        ),
      },
      {
        name: 'vertical',
        render: () => (
          <div className="gallery-separator-row">
            <span>{ds('design.sample.tabQuantities')}</span>
            <Separator orientation="vertical" />
            <span>{ds('design.sample.tabSources')}</span>
          </div>
        ),
      },
    ],
  },
  {
    slug: 'empty-state',
    covers: ['EmptyState'],
    states: [
      {
        name: 'with-action',
        render: () => (
          <EmptyState
            title={ds('design.sample.noDrawingsTitle')}
            teach={ds('design.sample.noDrawingsTeach')}
            actionLabel={ds('design.sample.uploadDrawing')}
            onAction={noop}
          />
        ),
      },
      {
        name: 'without-action',
        render: () => (
          <EmptyState
            title={ds('design.sample.noSignaturesTitle')}
            teach={ds('design.sample.noSignaturesTeach')}
          />
        ),
      },
    ],
  },
  {
    slug: 'error-state',
    covers: ['ErrorState'],
    states: [{ name: 'default', render: () => <ErrorState reportId={REPORT_ID} onRetry={noop} /> }],
  },
  {
    slug: 'partial-notice',
    covers: ['PartialNotice'],
    states: [{ name: 'default', render: () => <PartialNotice refusedCount={REFUSED_COUNT} /> }],
  },
  {
    slug: 'offline-banner',
    covers: ['OfflineBanner'],
    states: [{ name: 'default', render: () => <OfflineBanner /> }],
  },
  {
    slug: 'permission-denied',
    covers: ['PermissionDenied'],
    states: [
      {
        name: 'default',
        render: () => (
          <PermissionDenied permission={SIGN_PERMISSION} holder={ds('design.sample.holder')} />
        ),
      },
    ],
  },
  {
    slug: 'refusal-state',
    covers: ['RefusalState', 'EvidenceLink'],
    states: [
      {
        name: 'default',
        render: () => (
          <RefusalState
            code="PRECISION_NOT_APPLIED"
            evidenceHref={HASH}
            evidenceLabel={ds('design.sample.viewSheet')}
          />
        ),
      },
    ],
  },
  {
    slug: 'evidence-link',
    covers: ['EvidenceLink'],
    states: [
      { name: 'default', render: () => <EvidenceLink href={HASH} /> },
      {
        name: 'labelled',
        render: () => <EvidenceLink href={HASH}>{ds('design.sample.viewSheet')}</EvidenceLink>,
      },
    ],
  },
  {
    slug: 'consequence-dialog',
    covers: ['ConsequenceDialog'],
    states: [{ name: 'trigger', render: () => <SampleConsequence /> }],
  },
  {
    slug: 'data-table',
    covers: ['DataTable'],
    states: [
      {
        name: 'default',
        render: () => <SampleTable rows={ESTIMATE_ROWS} selected={false} grouped={false} />,
      },
      {
        name: 'selected',
        render: () => <SampleTable rows={ESTIMATE_ROWS} selected grouped={false} />,
      },
      {
        name: 'grouped',
        render: () => <SampleTable rows={ESTIMATE_ROWS} selected={false} grouped />,
      },
      { name: 'empty', render: () => <SampleTable rows={NO_ROWS} selected={false} grouped={false} /> },
      { name: 'loading', render: () => <SampleTableLoading /> },
    ],
  },
  {
    slug: 'basis-chip',
    covers: ['BasisChip'],
    states: BASIS_CODES.map((basis) => ({
      name: basis.toLowerCase(),
      render: () => <BasisChip basis={basis} />,
    })),
  },
  {
    slug: 'coverage-chip',
    covers: ['CoverageChip'],
    states: [
      {
        name: 'default',
        render: () => <CoverageChip covered={COVERAGE_COVERED} total={COVERAGE_TOTAL} />,
      },
    ],
  },
  {
    slug: 'unit-badge',
    covers: ['UnitBadge'],
    states: [
      {
        name: 'units',
        render: () => (
          <span className="gallery-units">
            {UNITS.map((unit) => (
              <UnitBadge key={unit} unit={unit} />
            ))}
          </span>
        ),
      },
    ],
  },
];

/** The Toaster the page mounts once, re-exported so the page needs no second barrel import. */
export { Toaster };

/* ── The specimens that need a hook of their own. ── */

function InvalidInput(): ReactElement {
  const id = useId();
  const message = useId();
  return (
    <div className="gallery-field">
      <label className="gallery-field-label" htmlFor={id}>
        {ds('design.sample.storeyHeight')}
      </label>
      <Input id={id} defaultValue={THREE} aria-invalid aria-describedby={message} />
      <span id={message} className="gallery-field-message">
        {ds('design.sample.storeyHeightMsg')}
      </span>
    </div>
  );
}

function SampleRadios({ disabled }: { readonly disabled: boolean }): ReactElement {
  const group = useId();
  const first = useId();
  const second = useId();
  return (
    <div className="gallery-field">
      <span className="gallery-field-label" id={group}>
        {ds('design.sample.rowDensity')}
      </span>
      <RadioGroup
        aria-labelledby={group}
        value={DENSITY_COMFORTABLE}
        disabled={disabled}
        onValueChange={noop}
      >
        <span className="gallery-choice">
          <Radio value={DENSITY_COMFORTABLE} aria-labelledby={first} />
          <span className="gallery-field-label" id={first}>
            {ds('design.sample.comfortable')}
          </span>
        </span>
        <span className="gallery-choice">
          <Radio value={DENSITY_COMPACT} aria-labelledby={second} />
          <span className="gallery-field-label" id={second}>
            {ds('design.sample.compact')}
          </span>
        </span>
      </RadioGroup>
    </div>
  );
}

function SampleSelect({
  chosen,
  disabled,
}: {
  readonly chosen: boolean;
  readonly disabled: boolean;
}): ReactElement {
  const id = useId();
  return (
    <div className="gallery-field">
      <span className="gallery-field-label" id={id}>
        {ds('design.sample.elementClass')}
      </span>
      <Select value={chosen ? ELEMENT_COLUMN : ''} disabled={disabled} onValueChange={noop}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder={ds('design.sample.elementPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ELEMENT_WALL}>{ds('design.sample.wall')}</SelectItem>
          <SelectItem value={ELEMENT_COLUMN}>{ds('design.sample.column')}</SelectItem>
          <SelectItem value={ELEMENT_BEAM}>{ds('design.sample.beam')}</SelectItem>
          <SelectItem value={ELEMENT_SLAB}>{ds('design.sample.slab')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** The contractual interactive Dialog (§3, test contract): a visible trigger that opens it. */
function SampleDialog(): ReactElement {
  const name = useId();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">{ds('design.sample.renameSheet')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{ds('design.sample.renameSheet')}</DialogTitle>
        <DialogDescription>{ds('design.sample.renameSheetBody')}</DialogDescription>
        <div className="gallery-field">
          <label className="gallery-field-label" htmlFor={name}>
            {ds('design.sample.sheetName')}
          </label>
          <Input id={name} defaultValue={SHEET_NAME_VALUE} />
        </div>
        <div className="gallery-dialog-footer">
          <DialogClose asChild>
            <Button variant="secondary">{ds('design.sample.cancel')}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>{ds('design.sample.saveShort')}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
