// ARCH-01: src/server must not reach src/ui. The payload IS the flagged construct (Q-08 declared fixture).
import "../ui/button"; // RECORDED REASON ARCH01_SERVER_TO_UI

export const payload = "server-to-ui";
