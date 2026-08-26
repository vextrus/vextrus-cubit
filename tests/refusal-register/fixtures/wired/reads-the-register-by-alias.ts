/**
 * Deliberate payload for the Q-07 register scan, not product source: the same control as its
 * sibling, wired through the tree's `@/` alias instead of a relative path. An alias import is an
 * import — a file that reaches the register through tsconfig's `paths` is wired, and a scan that
 * only understood `./` would call this lawful file "spelled but not wired" (Q-07).
 */
import { refusalOf } from "@/core/errors";

export const ALIAS_WIRED_CODE = refusalOf("PRECISION_NOT_APPLIED").code;
