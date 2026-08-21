/**
 * Toast — sonner, inside a region this product owns (R-UI-010: "Toast (sonner)").
 *
 * sonner renders its own list and its own live region (`aria-live="polite"` on the list, so a
 * message is spoken as it arrives rather than interrupting). What it does not have is a handle
 * this product's tests and screens can address, so the `Toaster` below is that handle: one
 * container carrying `data-testid="toast-region"` and a name, wrapped around sonner's own DOM.
 * The wrapper adds no behaviour on purpose — a toast queue reimplemented over a toast library
 * is two queues.
 *
 * `toast` is re-exported unchanged: it is the imperative half, called from an act's result and
 * not from a render.
 */
import type { ComponentProps, ReactElement } from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';
import { ts } from './strings';

export { toast };

export type ToasterProps = ComponentProps<typeof SonnerToaster>;

export function Toaster(props: ToasterProps): ReactElement {
  return (
    <div data-testid="toast-region" className="datum-toast-region">
      <SonnerToaster containerAriaLabel={ts('primitives.toast.region')} {...props} />
    </div>
  );
}
