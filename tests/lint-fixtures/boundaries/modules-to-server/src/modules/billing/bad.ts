// ARCH-01: a module never imports src/server — here through the globalThis spelling of require
// (Q-01).
globalThis.require("@/server/context"); // RECORDED REASON ARCH-01

export const contained = true;
