// ARCH-01: src/core must not reach src/ui. The payload IS the flagged construct (Q-08 declared fixture).
import "../ui/tokens"; // RECORDED REASON ARCH01_CORE_TO_UI

export const payload = "core-to-ui";
