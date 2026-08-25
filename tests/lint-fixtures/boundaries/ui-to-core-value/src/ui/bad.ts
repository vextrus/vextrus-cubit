// ARCH-01: src/ui reaches src/core for types and for nothing else — a value import crosses the
// boundary even though the layer is allowed for types.
import { formatMoney } from "@/core/format"; // RECORDED REASON ARCH-01

export const shown = formatMoney;
