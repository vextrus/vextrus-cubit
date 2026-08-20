import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * The one button. Variants read the token classes in globals.css, so a button
 * carries no colour of its own (R-UI-001) and inherits the 2 px cobalt focus
 * ring every interactive element gets (R-UI-012).
 */
const button = cva('button', {
  variants: {
    variant: {
      primary: 'button-primary',
      secondary: 'button-secondary',
      quiet: 'button-quiet',
    },
  },
  defaultVariants: { variant: 'primary' },
});

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Render as the child element (a link that looks like a button, say). */
  asChild?: boolean;
}

export function Button({ className, variant, asChild = false, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      className={cn(button({ variant }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}
