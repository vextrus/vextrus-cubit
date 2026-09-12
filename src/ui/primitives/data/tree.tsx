"use client";
/**
 * R-UI-010's Tree. No Radix tree exists, so this is the hand-rolled one: `role="tree"` over
 * `role="treeitem"` rows with `aria-expanded`, `aria-selected` and a roving tabindex — exactly one
 * item is tabbable, and the arrows do the rest (R-UI-012).
 *
 * The rows are nested as the hierarchy is: a branch's children stand inside it, in the `role="group"`
 * the tree role owns them through, so what a subtree holds is a fact of the DOM rather than of an
 * `aria-level` a reader has to reassemble. The row a person sees is `cx-tree-row` inside the item, so
 * nesting adds no box and no line of layout (R-UI-003).
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
  type ReactNode,
} from "react";
import { cx } from "../core/class-names";
import { TESTIDS } from "@/ui/testids";

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
    // A nested row's event would otherwise reach every ancestor treeitem and move the tree once per
    // level of depth; the row the keyboard is standing on answers for itself.
    event.stopPropagation();
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

  /**
   * The items of one level, each holding its own children. The keyboard still moves over the
   * flattened visible order — `rows` — so an item asks that order where it stands rather than
   * carrying an index the nesting would have to keep true.
   */
  const branch = (items: TreeItem[], depth: number): ReactNode =>
    items.map((item) => {
      const children = item.children ?? [];
      const hasChildren = children.length > 0;
      const isExpanded = hasChildren && expanded.has(item.id);
      const index = rows.findIndex((row) => row.item.id === item.id);
      return (
        <div
          key={item.id}
          role="treeitem"
          data-testid={TESTIDS.tree.item}
          data-tree-id={item.id}
          aria-level={depth + 1}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={item.id === selectedId}
          tabIndex={item.id === tabbableId ? 0 : -1}
          className={cx("cx-tree-item", "cx-reticle")}
          // Depth is the only fact the row knows; the indent it buys is the stylesheet's, spelled
          // in the spacing tokens the Design Decision names (R-UI-003).
          style={{ "--cx-tree-depth": depth } as CSSProperties}
          onFocus={(event) => {
            event.stopPropagation();
            setFocusedId(item.id);
          }}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={(event) => {
            // A click inside a branch is a click on the row it landed on, never on its ancestors too.
            event.stopPropagation();
            if (hasChildren) toggle(item.id, !isExpanded);
            select(item.id);
          }}
        >
          <span className="cx-tree-row">
            <Chevron open={isExpanded} hidden={!hasChildren} />
            <span className="cx-tree-label">{item.label}</span>
          </span>
          {isExpanded ? (
            <div role="group" className="cx-tree-group">
              {branch(children, depth + 1)}
            </div>
          ) : null}
        </div>
      );
    });

  return (
    <div {...rest} ref={rootRef} role="tree" data-testid={TESTIDS.tree.root} className={cx("cx-tree", className)}>
      {branch(items, 0)}
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
