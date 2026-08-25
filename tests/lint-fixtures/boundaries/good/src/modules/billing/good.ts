// ARCH-01: a module reaches core and its own module.
import { rounded } from "@/core/money";
import { invoiceOf } from "./invoice";

export const billed = invoiceOf(rounded);
