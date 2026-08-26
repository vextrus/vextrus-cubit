"use client";
/**
 * R-UI-010's Tree. No Radix tree exists, so this is the hand-rolled one: `role="tree"` over
 * `role="treeitem"` rows with `aria-expanded`, `aria-selected` and a roving tabindex — exactly one
 * item is tabbable, and the arrows do the rest (R-UI-012).
 *
 * Selection rides two channels, the beam fill and the heavier weight, so it never depends on colour
 * alone. Expanding is instant; only the chevron turns (R-UI-004).
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { cx } from "../core/class-names";

export interface TreeItem {
  id: string;
  label: string;
  children?: TreeItem[];
}

/** The tree owns no copy, so its accessible name — like any other div attribute — comes from the consumer. */
export interface TreeProps extends Omit<ComponentPropsWithoutRef<"div">, "onSelect" | "children"> {
  items: TreeItem[];
  onSelect?: (id: string) => void;
  defaultExpandedIds?: string[];
  /** The item selected before any interaction — the state a consumer restores, and the item that
   * holds the tab stop until the arrows move it (R-UI-012). */
  defaultSelectedId?: string;
}

/** A row as the keyboard sees it: the flattened, currently visible order. */
interface VisibleRow {
  item: TreeItem;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  expanded: boolean;
}


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

export function Tree({
  items,
  onSelect,
  defaultExpandedIds,
  defaultSelectedId,
  className,
  ...rest
}: TreeProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedIds ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedId ?? null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(() => flatten(items, expanded), [items, expanded]);

  /**
   * A roving tabindex: exactly one item is tabbable, and it is the one the arrows last landed on —
   * so Tab leaves the tree and Shift+Tab returns to where the keyboard was (R-UI-012). Before any
   * focus, the selected item holds the stop, and failing that the first.
   */
  const visible = (id: string | null): id is string => id !== null && rows.some((row) => row.item.id === id);
  const tabbableId = visible(focusedId) ? focusedId : visible(selectedId) ? selectedId : (rows[0]?.item.id ?? null);

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
    <div {...rest} ref={rootRef} role="tree" data-testid="tree" className={cx("cx-tree", className)}>
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
            // Depth is the only fact the row knows; the indent it buys is the stylesheet's, spelled
            // in the spacing tokens the Design Decision names (R-UI-003).
            style={{ "--cx-tree-depth": row.depth } as CSSProperties}
            onFocus={() => setFocusedId(row.item.id)}
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
