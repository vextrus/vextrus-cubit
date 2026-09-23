// The document's figure conventions, spelled ONCE for every screen of the tenant frame (B-17,
// SEAM-FORMAT). `src/ui` may import nothing from `src/core` but types (ARCH-01), so the figure
// primitives cannot call the seam themselves: the app hands it down. The tenant frame mounts it
// through `FigureProvider` (src/ui/primitives/core/figures.tsx: "The tenant frame installs one"),
// which is what a primitive that writes a figure of its own — the DataTable's group subtotal —
// reads; a screen that passes `format` explicitly passes THIS object, never a second spelling.
//
// `money` answers WITHOUT the currency character because MoneyText draws the ৳ itself; the seam
// still writes it, so L-FMT-02's refusal of a badly-shaped amount is the one that fires.
import { BD_DOCUMENT, dhakaDateParts, formatDate, formatMoney, formatUserFigure } from "@/core/format";
import type { FigureFormat } from "@/ui/primitives/core";

export const FIGURES: FigureFormat = {
  figure: (value) => formatUserFigure(value),
  money: (amount) => formatMoney(amount).replace(BD_DOCUMENT.currencySymbol, ""),
  date: (at) => formatDate(dhakaDateParts(at)),
};
