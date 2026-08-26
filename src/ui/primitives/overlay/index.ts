/**
 * The overlay slice of the Datum primitive set (R-UI-010): Dialog, Sheet, Popover, DropdownMenu,
 * ContextMenu and Toast. Importing a primitive from here brings its stylesheet — its own and the
 * reticle's single home (B-17, R-UI-012) — so no consumer can render one unstyled or unfocusable.
 *
 * Every content in this slice portals to `document.body`, where the document root's `[data-theme]`
 * themes it and no ancestor's overflow or stacking context can clip it.
 */
import "../core/reticle.css";
import "./overlay.css";

export { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "./dialog";
export { Sheet, SheetContent, SheetTrigger } from "./sheet";
export { Popover, PopoverContent, PopoverTrigger } from "./popover";
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
export { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "./context-menu";
export { Toaster, toast } from "./toast";

export type { DialogCloseProps, DialogContentProps, DialogProps, DialogTitleProps, DialogTriggerProps } from "./dialog";
export type { SheetContentProps, SheetProps, SheetSide, SheetTriggerProps } from "./sheet";
export type { PopoverContentProps, PopoverProps, PopoverTriggerProps } from "./popover";
export type {
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuProps,
  DropdownMenuTriggerProps,
} from "./dropdown-menu";
export type {
  ContextMenuContentProps,
  ContextMenuItemProps,
  ContextMenuProps,
  ContextMenuTriggerProps,
} from "./context-menu";
export type { MenuItemVariant } from "./menu-item";
export type { ToasterProps } from "./toast";
