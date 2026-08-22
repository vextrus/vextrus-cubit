/**
 * Select — the closed picker (R-UI-010, R-UI-012: "keyboard reachable").
 *
 * Radix owns the listbox: Enter, Space and ArrowDown open it, the arrows move the highlight,
 * Enter commits and Escape closes and hands focus back to the trigger. None of that is
 * re-implemented here, because a picker that only opens under a mouse is the commonest way a
 * screen fails Q-11's keyboard journey and the way to keep it working is to not rewrite it.
 *
 * `position="popper"` rather than the default item-aligned placement: item alignment measures
 * the list against the viewport, which is a measurement, and a Datum select sits under its
 * trigger in every case this product has.
 *
 * The chosen item carries a check at its left edge (Design Decision §6). It is drawn by the
 * stylesheet rather than written into the option, so the accessible name of an option stays
 * the word the user is choosing.
 */
import { forwardRef, useEffect } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { cx } from './class-names';
import { surfaceContainer } from './surface-container';

/**
 * Radix's Select hides the rest of the page from the accessibility tree while the list is
 * open, and — unlike DropdownMenu and ContextMenu — exposes no `modal` prop to say otherwise.
 * The page's heading and every control on it then leave the tree, which axe reports as
 * `aria-hidden-focus` and `page-has-heading-one`: a picker has taken the page away from the
 * reader. This puts back the one attribute that did it, leaving Radix's own `data-aria-hidden`
 * bookkeeping alone so its cleanup still runs.
 */
function useNonModalSurface(): void {
  useEffect(() => {
    const unhide = (): void => {
      for (const node of document.querySelectorAll('[data-aria-hidden="true"][aria-hidden]')) {
        node.removeAttribute('aria-hidden');
      }
    };
    unhide();
    const observer = new MutationObserver(unhide);
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden'],
    });
    return () => { observer.disconnect(); };
  }, []);
}

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export type SelectTriggerProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger({ className, children, ...rest }, ref) {
    return (
      <SelectPrimitive.Trigger
        ref={ref}
        className={cx('datum-control', 'datum-select-trigger', 'datum-focus-ring', className)}
        {...rest}
      >
        {children}
        <SelectPrimitive.Icon className="datum-select-icon" />
      </SelectPrimitive.Trigger>
    );
  },
);

export type SelectContentProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Content>;

export const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(function SelectContent(
  { className, children, position, ...rest },
  ref,
) {
  useNonModalSurface();
  return (
    <SelectPrimitive.Portal container={surfaceContainer()}>
      <SelectPrimitive.Content
        ref={ref}
        position={position ?? 'popper'}
        className={cx('datum-popover-surface', 'datum-select-content', className)}
        {...rest}
      >
        <SelectPrimitive.Viewport className="datum-select-viewport">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export type SelectItemProps = ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem(
  { className, children, ...rest },
  ref,
) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cx('datum-control', 'datum-select-item', 'datum-focus-ring', className)}
      {...rest}
    >
      <SelectPrimitive.ItemIndicator className="datum-select-item-check" />
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
