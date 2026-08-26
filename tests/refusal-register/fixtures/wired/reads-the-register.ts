/**
 * Deliberate payload for the Q-07 register scan, not product source: the control the other three
 * fixtures are read against — a registered code spelled in a file that does read the register. A
 * finding that fired here would fire on every lawful spelling in the tree, so the scan is proved
 * silent on it.
 */
import { refusalOf } from "../../../../src/core/errors";

export const WIRED_CODE = refusalOf("CHARACTER_NOT_COVERED").code;
