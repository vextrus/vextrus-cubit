// ARCH-01: a module never imports src/app — here through computed member access (Q-01).
globalThis["require"]("@/app/actions"); // RECORDED REASON ARCH-01

export const contained = true;
