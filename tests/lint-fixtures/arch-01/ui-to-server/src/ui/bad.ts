// ARCH-01: src/ui must not reach src/server. The payload IS the flagged construct (Q-08 declared fixture).
import "../server/trpc"; // RECORDED REASON ARCH01_UI_TO_SERVER

export const payload = "ui-to-server";
