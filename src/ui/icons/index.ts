/**
 * The vendored icon set (Design Direction 00 §1 "Iconography"). Importing a glyph from here brings
 * the set's stylesheet with it, so no surface can paint one at a size the layout tokens do not
 * name (B-17, R-UI-012).
 *
 * There is no runtime dependency behind this barrel and there may not be one: `lucide-react` is not
 * installed (AM-08). `LICENSE-lucide.txt` in this directory records the licence and the provenance
 * of every glyph.
 */
import "./icons.css";

export { createIcon, type IconProps, type IconSize } from "./icon-base";
export {
  IconAlert,
  IconAngle,
  IconArea,
  IconBell,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCopy,
  IconCount,
  IconExternalLink,
  IconFit,
  IconGrid,
  IconInbox,
  IconInfo,
  IconInspector,
  IconLayers,
  IconLinear,
  IconMoon,
  IconMoreHorizontal,
  IconOrtho,
  IconPan,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSelect,
  IconSnap,
  IconSun,
  IconTaka,
  IconUpload,
  IconUser,
  IconViews,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from "./glyphs";
