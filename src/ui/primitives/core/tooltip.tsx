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
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cx } from "./class-names";

const RETICLE = "cx-reticle";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

/**
 * The trigger is focusable, so it wears the reticle — and Tooltip puts it there itself rather
 * than trusting the child to have brought one. "A visible focus indicator is never optional"
 * (R-UI-012) is the component's guarantee, not the consumer's good manners.
 */
function reticled(children: ReactNode): ReactNode {
  if (!isValidElement<{ className?: string }>(children)) return children;
  const existing = children.props.className;
  if (typeof existing === "string" && existing.split(/\s+/).includes(RETICLE)) return children;
  return cloneElement(children as ReactElement<{ className?: string }>, { className: cx(existing, RETICLE) });
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{reticled(children)}</TooltipPrimitive.Trigger>
        {/* Portalled: an overlay that renders inline is clipped by the first ancestor with
            `overflow: hidden` and out-ranked by the first that opens a stacking context, so its
            z-index is inert exactly where a table cell, sheet or scroll area needs it. */}
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="cx-tooltip" data-testid="tooltip-content" side="top" sideOffset={6}>
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
