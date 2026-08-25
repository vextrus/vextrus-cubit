// LAW-FMT: locale-sensitive formatting is read from the one home, never re-derived.
import { compareNames, formatMoney } from "@/core/format";

export const money = formatMoney(1);
export const order = compareNames("a", "b");
