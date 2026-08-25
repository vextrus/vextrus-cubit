// ARCH-01: worker reaches core and modules.
import { rounded } from "@/core/money";
import { invoiceOf } from "@/modules/billing/invoice";

export const job = () => invoiceOf(rounded);
