/**
 * The Datum primitives (R-UI-010) — one import for the whole roster.
 *
 * A screen imports from here and from no file under it: the module is the unit, and the split
 * into button.tsx, dialog.tsx and the rest is this module's own business. The stylesheet is
 * imported here for the same reason — the ring, the surfaces and the motion arrive with the
 * components, so there is no second import a screen can forget and no screen where R-UI-012's
 * focus ring is missing because somebody wired the CSS in the wrong layout.
 *
 * R-UI-010's list is longer than this. DataTable, Tree, EmptyState, RefusalState,
 * ConsequenceDialog, EvidenceLink and the rest are later leaves of this same module and land
 * on this same barrel; what is here is the input, overlay and feedback core they are built
 * from.
 */
import './primitives.css';

export { Button, IconButton } from './button';
export type { ButtonProps, ButtonVariant, IconButtonProps } from './button';

export { Input, Textarea } from './field';
export type { InputProps, TextareaProps } from './field';

export { NumberInput } from './number-input';
export type { NumberInputProps } from './number-input';

export { Checkbox, Radio, RadioGroup, Slider, Switch } from './choice';
export type { CheckboxProps, RadioGroupProps, RadioProps, SliderProps, SwitchProps } from './choice';

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
export type { SelectContentProps, SelectItemProps, SelectTriggerProps } from './select';

export { Combobox } from './combobox';
export type { ComboboxOption, ComboboxProps } from './combobox';

export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
export type { TabsContentProps, TabsListProps, TabsProps, TabsTriggerProps } from './tabs';

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './floating';
export type {
  ContextMenuContentProps,
  ContextMenuItemProps,
  ContextMenuTriggerProps,
  DropdownMenuContentProps,
  DropdownMenuItemProps,
  DropdownMenuTriggerProps,
  PopoverContentProps,
  PopoverTriggerProps,
  TooltipContentProps,
  TooltipProps,
  TooltipTriggerProps,
} from './floating';

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from './dialog';
export type {
  DialogCloseProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogTitleProps,
  DialogTriggerProps,
  SheetContentProps,
  SheetSide,
  SheetTitleProps,
  SheetTriggerProps,
} from './dialog';

export { Toaster, toast } from './toast';
export type { ToasterProps } from './toast';

export { Badge, Kbd, Progress, Separator, Skeleton, Tag } from './display';
export type {
  BadgeProps,
  BadgeTone,
  KbdProps,
  ProgressProps,
  SeparatorProps,
  SkeletonProps,
  TagProps,
} from './display';

// The string table is deliberately not re-exported here. R-SPINE-060 keeps it at
// `src/ui/primitives/strings.ts`, which is where the acceptance and the Design Decision both
// read it; a second name for it on the barrel would be a second place to look.
export type { PrimitiveStringKey } from './strings';
