// ARCH-01: src/ui imports nothing outside itself except core types — here through a dynamic
// import (Q-01).
await import("@/server/context"); // RECORDED REASON ARCH-01

export const contained = true;
