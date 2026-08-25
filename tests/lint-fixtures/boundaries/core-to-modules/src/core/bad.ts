// ARCH-01: src/core imports nothing above it — here through a template-literal specifier (Q-01).
await import(`@/modules/billing/invoice`); // RECORDED REASON ARCH-01

export const grounded = true;
