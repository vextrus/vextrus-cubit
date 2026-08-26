/**
 * The data slice of the Datum primitive set (R-UI-010): Tabs, Tree, ScrollArea, Resizable panels
 * and the DataTable. Importing a primitive from here brings its stylesheet — its own, the reticle's
 * single home (B-17, R-UI-012), and core's, because the table's filter fields and cell editor are
 * the shipped core Input — so no consumer can render one unstyled or unfocusable.
 */
import "../core/reticle.css";
import "../core/core.css";
import "./data.css";

export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
export { Tree } from "./tree";
export { ScrollArea } from "./scroll-area";
export { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";
export { DataTable } from "./data-table";

export type { TabsContentProps, TabsListProps, TabsProps, TabsTriggerProps } from "./tabs";
export type { TreeItem, TreeProps } from "./tree";
export type { ScrollAreaProps } from "./scroll-area";
export type { ResizableHandleProps, ResizablePanelGroupProps, ResizablePanelProps } from "./resizable";
export type {
  DataTableColumnMeta,
  DataTableColumnPinning,
  DataTableDensity,
  DataTableProps,
} from "./data-table";
