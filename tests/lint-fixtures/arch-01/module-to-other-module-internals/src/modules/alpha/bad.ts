// ARCH-01: a module must not reach another module's internals. The payload IS the flagged construct (Q-08 declared fixture).
import "../beta/internal/rate"; // RECORDED REASON ARCH01_MODULE_TO_OTHER_MODULE

export const payload = "module-to-other-module-internals";
