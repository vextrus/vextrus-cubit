"use client";
/**
 * R-UI-010's Tooltip, restyled Radix. It brings its own provider and root so a consumer wires
 * nothing: it wraps one focusable trigger, and the trigger opens it on focus as well as on hover —
 * a hint only a pointer can reach is not a hint (R-UI-012).
 *
 * Entrance motion is a token read, so `prefers-reduced-motion` is honoured at the source
 * (R-UI-004).
 */
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Content className="cx-tooltip" data-testid="tooltip-content" side="top" sideOffset={6}>
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
