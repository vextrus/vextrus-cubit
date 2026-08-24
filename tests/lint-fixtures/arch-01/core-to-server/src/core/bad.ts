// ARCH-01: src/core must not reach src/server. The payload IS the flagged construct (Q-08 declared fixture).
import "../server/trpc"; // RECORDED REASON ARCH01_CORE_TO_SERVER

export const payload = "core-to-server";
