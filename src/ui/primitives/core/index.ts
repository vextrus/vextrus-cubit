/**
 * The core slice of the Datum primitive set (R-UI-010). Consumers import primitives from here, and
 * importing them brings their stylesheets — the primitives' own and the reticle's single home
 * (B-17, R-UI-012) — so no consumer can render one of these unstyled or unfocusable.
 *
 * COMPONENTS and their types, and nothing else: the pure rules a primitive is built from — the
 * listbox's keyboard, the enum's humanising, the step and clamp arithmetic, the relative reading —
 * stay in their own files, where their own suites grade them (B-17). A barrel that published them
 * would make "every export of this barrel mounts" untrue, which is what the acceptance reads it as.
 */
import "./reticle.css";
import "./core.css";

export { Badge } from "./badge";
// R-UI-002's glyph table is not a primitive and is not published here: it stays in `./basis`, its own
// home, which every surface that shows a basis reads it from directly (B-17).
export { BasisChip } from "./basis-chip";
export { Breadcrumb, type BreadcrumbCrumb } from "./breadcrumb";
export { Button } from "./button";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { Chip } from "./chip";
export { ClockProvider, type Clock, type ClockProviderProps } from "./clock";
export { Combobox, type ComboboxOption, type ComboboxProps } from "./combobox";
export { CoverageChip } from "./coverage-chip";
export { DateText, type DateTextProps } from "./date-text";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { EnumLabel, type EnumLabelProps } from "./enum-label";
export { ErrorState, type ErrorStateProps } from "./error-state";
export { FigureProvider, type FigureFormat, type FigureProviderProps } from "./figures";
export { IconButton, type IconButtonProps } from "./icon-button";
export { IdChip, type IdChipProps } from "./id-chip";
export { Input } from "./input";
export { Kbd } from "./kbd";
export { MoneyText, type MoneyTextProps } from "./money-text";
export { NumberInput, type NumberInputProps } from "./number-input";
export { QuantityText, type QuantityTextProps } from "./quantity-text";
export { RelativeTime, type RelativeTimeProps } from "./relative-time";
export { Select, type SelectOption, type SelectProps } from "./select";
export { Separator, type SeparatorProps } from "./separator";
export { Skeleton } from "./skeleton";
export { Stat, type StatProps } from "./stat";
export { Switch, type SwitchProps } from "./switch";
export { Textarea } from "./textarea";
export { Tooltip } from "./tooltip";
export { UnitBadge } from "./unit-badge";
