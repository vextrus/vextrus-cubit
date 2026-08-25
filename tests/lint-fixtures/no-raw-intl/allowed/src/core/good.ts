// LAW-FMT: a core file beside the allowlisted one still reads the format helper — the allowlist is
// the exact path, not the directory.
import { formatMoney } from "./format";

export const money = formatMoney(1);
