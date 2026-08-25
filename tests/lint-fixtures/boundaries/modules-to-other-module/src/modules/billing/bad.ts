// ARCH-01: a module imports core and its own module only — never another module's internals.
import { ledger } from "@/modules/projects/internal"; // RECORDED REASON ARCH-01

export const borrowed = ledger;
