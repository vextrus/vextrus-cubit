/**
 * The `(auth)` group's document chrome.
 *
 * The stylesheet is imported here and not in the root layout, the same way `/design` brings
 * its own: the root is a placeholder that carries no tokens by design, so the segment that
 * ships a screen brings the sheet its tokens live in.
 */
import type { ReactNode } from 'react';
import '../../ui/globals.css';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
