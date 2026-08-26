"use client";
/**
 * R-UI-010's Tree. No Radix tree exists, so this is the hand-rolled one: `role="tree"` over
 * `role="treeitem"` rows with `aria-expanded`, `aria-selected` and a roving tabindex — exactly one
 * item is tabbable, and the arrows do the rest (R-UI-012).
 *
 * Selection rides two channels, the beam fill and the heavier weight, so it never depends on colour
 * alone. Expanding is instant; only the chevron turns (R-UI-004).
 */
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "../core/class-names";

export interface TreeItem {
  id: string;
  label: string;
  children?: TreeItem[];
}

export interface TreeProps {
  items: TreeItem[];
  onSelect?: (id: string) => void;
  defaultExpandedIds?: string[];
  className?: string;
}

/** A row as the keyboard sees it: the flattened, currently visible order. */
interface VisibleRow {
  item: TreeItem;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

/** The indent step the Design Decision fixes, in px — instrument geometry, not a spacing decision. */
const INDENT_STEP_PX = 16;
const INDENT_BASE_PX = 8;

function flatten(items: TreeItem[], expanded: ReadonlySet<string>, depth = 0, parentId: string | null = null): VisibleRow[] {
  const rows: VisibleRow[] = [];
  for (const item of items) {
    const children = item.children ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = hasChildren && expanded.has(item.id);
    rows.push({ item, depth, parentId, hasChildren, expanded: isExpanded });
    if (isExpanded) rows.push(...flatten(children, expanded, depth + 1, item.id));
  }
  return rows;
}

export function Tree({ items, onSelect, defaultExpandedIds, className }: TreeProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedIds ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => flatten(items, expanded), [items, expanded]);

  /** Exactly one item is tabbable: the selected one where it is visible, else the first. */
  const tabbableId = rows.some((row) => row.item.id === selectedId) ? selectedId : (rows[0]?.item.id ?? null);

  const focusRow = useCallback((id: string): void => {
    const node = rootRef.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`);
    node?.focus();
  }, []);

  const toggle = useCallback((id: string, open: boolean): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const select = useCallback(
    (id: string): void => {
      setSelectedId(id);
      onSelect?.(id);
    },
    [onSelect],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number): void => {
    const row = rows[index];
    if (!row) return;
    const move = (target: number): void => {
      const next = rows[target];
      if (!next) return;
      event.preventDefault();
      focusRow(next.item.id);
    };

    switch (event.key) {
      case "ArrowDown":
        move(index + 1);
        return;
      case "ArrowUp":
        move(index - 1);
        return;
      case "Home":
        move(0);
        return;
      case "End":
        move(rows.length - 1);
        return;
      case "ArrowRight":
        if (row.hasChildren && !row.expanded) {
          event.preventDefault();
          toggle(row.item.id, true);
        } else if (row.hasChildren) {
          move(index + 1);
        }
        return;
      case "ArrowLeft":
        if (row.hasChildren && row.expanded) {
          event.preventDefault();
          toggle(row.item.id, false);
        } else if (row.parentId) {
          const parentIndex = rows.findIndex((candidate) => candidate.item.id === row.parentId);
          move(parentIndex);
        }
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        select(row.item.id);
        return;
      default:
    }
  };

  return (
    <div ref={rootRef} role="tree" data-testid="tree" className={cx("cx-tree", className)}>
      {rows.map((row, index) => {
        const selected = row.item.id === selectedId;
        return (
          <div
            key={row.item.id}
            role="treeitem"
            data-testid="tree-item"
            data-tree-id={row.item.id}
            aria-level={row.depth + 1}
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            aria-selected={selected}
            tabIndex={row.item.id === tabbableId ? 0 : -1}
            className={cx("cx-tree-item", "cx-reticle")}
            style={{ paddingLeft: `${INDENT_BASE_PX + row.depth * INDENT_STEP_PX}px` }}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => {
              if (row.hasChildren) toggle(row.item.id, !row.expanded);
              select(row.item.id);
            }}
          >
            <Chevron open={row.expanded} hidden={!row.hasChildren} />
            <span className="cx-tree-label">{row.item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The disclosure mark: decorative, so it is hidden from the accessible name (R-UI-012). */
function Chevron({ open, hidden }: { open: boolean; hidden: boolean }) {
  if (hidden) return <span className="cx-tree-spacer" aria-hidden="true" />;
  return (
    <svg
      className="cx-tree-chevron"
      data-open={open || undefined}
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.5 2.5 L8 6 L4.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
