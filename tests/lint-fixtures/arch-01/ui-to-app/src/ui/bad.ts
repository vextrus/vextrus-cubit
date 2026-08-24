// ARCH-01: src/ui must not reach src/app. The payload IS the flagged construct (Q-08 declared fixture).
import "../app/page"; // RECORDED REASON ARCH01_UI_TO_APP

export const payload = "ui-to-app";
