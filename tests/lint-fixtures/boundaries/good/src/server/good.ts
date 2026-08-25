// ARCH-01: server reaches core and modules.
import { rounded } from "@/core/money";
import { invoiceOf } from "@/modules/billing/invoice";

export const answer = invoiceOf(rounded);
