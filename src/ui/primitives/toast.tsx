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
 * What the wrapper does decide is the paint. Left alone, sonner styles its card from its own
 * stylesheet, in its own colour literals, under a `theme` that defaults to light — so a toast
 * on a `[data-theme="dark"]` page arrives as light chrome on a dark page, and AC-1's "styling
 * uses Datum token classes/variables only" is untrue for this one primitive. So the toast is
 * asked for `unstyled` cards and given Datum class names instead (§12): the card is painted by
 * primitives.css, in tokens, and follows the theme because the tokens do.
 *
 * `toast` is re-exported unchanged: it is the imperative half, called from an act's result and
 * not from a render.
 */
import type { ComponentProps, ReactElement } from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';
import { ts } from './strings';

export { toast };

export type ToasterProps = ComponentProps<typeof SonnerToaster>;

/**
 * The Datum classes sonner puts on the parts of a toast. `unstyled` turns off sonner's own
 * card entirely, so every one of these has to carry the whole of §12's card, which is what
 * primitives.css writes them as.
 */
const DATUM_TOAST: NonNullable<NonNullable<ToasterProps['toastOptions']>['classNames']> = {
  toast: 'datum-toast',
  title: 'datum-toast-title',
  description: 'datum-toast-description',
  actionButton: 'datum-control datum-toast-action datum-focus-ring',
  cancelButton: 'datum-control datum-toast-cancel datum-focus-ring',
  closeButton: 'datum-control datum-toast-close datum-focus-ring',
};

export function Toaster(props: ToasterProps): ReactElement {
  return (
    <div data-testid="toast-region" className="datum-toast-region">
      <SonnerToaster
        containerAriaLabel={ts('primitives.toast.region')}
        toastOptions={{ unstyled: true, classNames: DATUM_TOAST }}
        {...props}
      />
    </div>
  );
}
