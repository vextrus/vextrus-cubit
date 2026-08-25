// ARCH-01: an acyclic import — the dependency does not reach back.
import { rounded } from "./money";

export const total = rounded;
