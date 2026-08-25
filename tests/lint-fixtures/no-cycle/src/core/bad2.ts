// ARCH-01: the far half of the two-file ring — it imports back into the file that imports it.
import "../../../../../src/core/bad"; // RECORDED REASON ARCH-01
import "./bad2"; // RECORDED REASON ARCH-01

export const partner = true;
