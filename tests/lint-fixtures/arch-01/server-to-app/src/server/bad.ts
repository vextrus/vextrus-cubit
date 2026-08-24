// ARCH-01: src/server must not reach src/app. The payload IS the flagged construct (Q-08 declared fixture).
import "../app/page"; // RECORDED REASON ARCH01_SERVER_TO_APP

export const payload = "server-to-app";
