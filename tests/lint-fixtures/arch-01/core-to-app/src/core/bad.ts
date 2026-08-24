// ARCH-01: src/core must not reach src/app. The payload IS the flagged construct (Q-08 declared fixture).
import "../app/page"; // RECORDED REASON ARCH01_CORE_TO_APP

export const payload = "core-to-app";
