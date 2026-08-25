// ARCH-01: src/server imports core and modules — a relative specifier climbs no further (Q-01).
import "../app/route"; // RECORDED REASON ARCH-01

export const contained = true;
