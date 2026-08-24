// ARCH-01: src/ui imports nothing outside itself except core *types* — a runtime value from core is
// outside that permission. The payload IS the flagged construct (Q-08 declared fixture).
import { formatMoney } from "../core/money"; // RECORDED REASON ARCH01_UI_TO_CORE_VALUE

export const payload = formatMoney;
