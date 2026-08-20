import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** One class-name join for the whole tree: conditional, then conflict-resolved. */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
