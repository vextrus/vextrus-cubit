// ARCH-01: a module must not reach src/ui. The payload IS the flagged construct (Q-08 declared fixture).
import "../../ui/button"; // RECORDED REASON ARCH01_MODULE_TO_UI

export const payload = "module-to-ui";
