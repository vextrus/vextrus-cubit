/**
 * DataTable — the virtualised grid at its two densities, grouped, and empty (§6).
 *
 * The eight rows are literal and the quantities are written as strings with the three fraction
 * digits SEAM-FORMAT takes for a quantity: the seam refuses a free precision, and a table that
 * threw inside a gallery cell would take the whole sheet down (L-FMT-01).
 */
'use client';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { DataTable } from '../../data';
import type { DataTableColumn, DataTableState } from '../../data';
import { BasisChip, UnitBadge } from '../../data';
import type { BasisCode } from '../../tokens';
import type { Unit } from '../../../core/format';
import { formatNumber } from '../../../core/format';
import { gs } from '../strings';
import type { GalleryEntry } from '../types';

/** Column ids — identifiers the table sorts and groups on, not words anybody reads. */
const ELEMENT = 'element';
const QUANTITY = 'quantity';
const UNIT = 'unit';
const BASIS = 'basis';

/** The viewport and the two row heights the Design Decision fixes, in px (§6). */
const HEIGHT = 240;
const COMFORTABLE_ROW = 36;
const COMPACT_ROW = 28;

const NUMERIC = { numeric: true } as const;

interface MeasurementRow {
  readonly id: string;
  readonly element: string;
  readonly quantity: string;
  readonly unit: Unit;
  readonly basis: BasisCode;
}

const rows = (): readonly MeasurementRow[] => [
  {
    id: 'r1',
    element: gs('gallery.sample.data-table.row-1'),
    quantity: '126.400',
    unit: 'm2',
    basis: 'MEASURED',
  },
  {
    id: 'r2',
    element: gs('gallery.sample.data-table.row-2'),
    quantity: '84.250',
    unit: 'm2',
    basis: 'MEASURED',
  },
  {
    id: 'r3',
    element: gs('gallery.sample.data-table.row-3'),
    quantity: '2.880',
    unit: 'm3',
    basis: 'TRANSCRIBED',
  },
  {
    id: 'r4',
    element: gs('gallery.sample.data-table.row-4'),
    quantity: '2.880',
    unit: 'm3',
    basis: 'DERIVED',
  },
  {
    id: 'r5',
    element: gs('gallery.sample.data-table.row-5'),
    quantity: '18.600',
    unit: 'm',
    basis: 'IMPORTED',
  },
  {
    id: 'r6',
    element: gs('gallery.sample.data-table.row-6'),
    quantity: '18.600',
    unit: 'm',
    basis: 'ENTERED',
  },
  {
    id: 'r7',
    element: gs('gallery.sample.data-table.row-7'),
    quantity: '410.000',
    unit: 'm2',
    basis: 'INTERPRETED',
  },
  {
    id: 'r8',
    element: gs('gallery.sample.data-table.row-8'),
    quantity: '392.750',
    unit: 'm2',
    basis: 'DEFAULTED',
  },
];

const FIRST_ROW = 'r1';

function columns(): DataTableColumn<MeasurementRow>[] {
  return [
    {
      id: ELEMENT,
      accessorKey: ELEMENT,
      header: gs('gallery.sample.data-table.element'),
    },
    {
      id: QUANTITY,
      accessorKey: QUANTITY,
      header: gs('gallery.sample.data-table.quantity'),
      meta: NUMERIC,
      cell: ({ row }) => formatNumber(row.original.quantity, 'quantity'),
    },
    {
      id: UNIT,
      accessorKey: UNIT,
      header: gs('gallery.sample.data-table.unit'),
      cell: ({ row }) => <UnitBadge unit={row.original.unit} />,
    },
    {
      id: BASIS,
      accessorKey: BASIS,
      header: gs('gallery.sample.data-table.basis'),
      cell: ({ row }) => <BasisChip basis={row.original.basis} />,
    },
  ];
}

const rowId = (row: MeasurementRow): string => row.id;

/**
 * The comfortable table, with the first row selected.
 *
 * The selection is held here rather than handed down as a frozen `state` slice: DataTable
 * merges `{...internal, ...state}`, so a slice with no setter behind it would never move
 * again and the sample would be a picture of a checkbox rather than a checkbox.
 */
function Comfortable(): ReactElement {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({ [FIRST_ROW]: true });
  return (
    <DataTable
      data={rows()}
      columns={columns()}
      getRowId={rowId}
      height={HEIGHT}
      estimateRowHeight={COMFORTABLE_ROW}
      enableRowSelection
      state={{ rowSelection }}
      onRowSelectionChange={setRowSelection}
      emptyReason={gs('gallery.sample.data-table.empty')}
    />
  );
}

const GROUPED = (): Partial<DataTableState> => ({ grouping: [ELEMENT] });

export const entry: GalleryEntry = {
  id: 'data-table',
  covers: ['DataTable'],
  states: [
    { name: 'comfortable', render: () => <Comfortable /> },
    {
      name: 'compact',
      render: () => (
        <DataTable
          data={rows()}
          columns={columns()}
          getRowId={rowId}
          height={HEIGHT}
          estimateRowHeight={COMPACT_ROW}
          emptyReason={gs('gallery.sample.data-table.empty')}
        />
      ),
    },
    {
      name: 'grouped',
      render: () => (
        <DataTable
          data={rows()}
          columns={columns()}
          getRowId={rowId}
          height={HEIGHT}
          estimateRowHeight={COMFORTABLE_ROW}
          state={GROUPED()}
          emptyReason={gs('gallery.sample.data-table.empty')}
        />
      ),
    },
    {
      name: 'empty',
      render: () => (
        <DataTable<MeasurementRow>
          data={[]}
          columns={columns()}
          getRowId={rowId}
          height={HEIGHT}
          estimateRowHeight={COMFORTABLE_ROW}
          emptyReason={gs('gallery.sample.data-table.empty')}
        />
      ),
    },
  ],
};
