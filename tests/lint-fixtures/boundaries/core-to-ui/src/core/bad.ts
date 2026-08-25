// ARCH-01: src/core imports nothing above it — here through an identifier bound once to the
// specifier, which is the same import as spelling it inline (Q-01).
const hoisted = "@/ui/button";

await import(hoisted); // RECORDED REASON ARCH-01

export const grounded = true;
