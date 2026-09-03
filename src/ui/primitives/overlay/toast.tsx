"use client";
/**
 * R-UI-010's Toast: sonner's Toaster, themed through its class hooks so every colour, radius and
 * shadow is a token read (R-UI-001). Sonner's own enter/exit motion is library-owned and honours
 * `prefers-reduced-motion` natively, so it is accepted rather than re-keyframed.
 *
 * A toast is additive status. A refusal is rendered in place by the screen that was refused
 * (R-UI-020), never here.
 */
import type { ComponentProps } from "react";
import { Toaster as SonnerToaster } from "sonner";
import { cx } from "../core/class-names";

export { toast } from "sonner";

export type ToasterProps = ComponentProps<typeof SonnerToaster>;

export function Toaster({ position = "bottom-right", toastOptions, className, ...rest }: ToasterProps) {
  return (
    <SonnerToaster
      {...rest}
      position={position}
      className={cx("cx-toaster", className)}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: "cx-toast",
          title: "cx-toast-title",
          description: "cx-toast-description",
          ...toastOptions?.classNames,
        },
      }}
    />
  );
}
