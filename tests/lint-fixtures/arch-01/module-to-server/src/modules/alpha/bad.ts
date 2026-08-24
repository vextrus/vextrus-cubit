// ARCH-01: a module must not reach src/server. The payload IS the flagged construct (Q-08 declared fixture).
import "../../server/trpc"; // RECORDED REASON ARCH01_MODULE_TO_SERVER

export const payload = "module-to-server";
