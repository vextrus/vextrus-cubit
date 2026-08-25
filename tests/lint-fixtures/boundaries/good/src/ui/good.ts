// ARCH-01: ui reaches itself, and core for types only.
import type { Money } from "@/core/money";
import { Button } from "./button";

export type Priced = { readonly amount: Money; readonly action: typeof Button };
