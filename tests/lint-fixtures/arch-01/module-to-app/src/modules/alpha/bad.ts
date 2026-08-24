// ARCH-01: a module must not reach src/app. The payload IS the flagged construct (Q-08 declared fixture).
import "../../app/page"; // RECORDED REASON ARCH01_MODULE_TO_APP

export const payload = "module-to-app";
