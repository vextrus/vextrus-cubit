/**
 * The `/t` segment's document chrome.
 *
 * The stylesheets are imported here — the token sheet the segment paints from and the
 * screens' own rules — the same way `/design` and `(auth)` bring theirs.
 *
 * There is no `loading.tsx` beside this file, or anywhere below it, and that is a decision
 * rather than an omission (Design Decision Interpretation 5): a skeleton above the guard
 * makes Next answer 200 with the page shell and stream the redirect after it, which shows a
 * stranger the chrome of a workspace they are about to be sent away from.
 */
import type { ReactNode } from 'react';
import '../../ui/globals.css';
import './tenant.css';

export default function TenantLayout({ children }: { children: ReactNode }) {
  return children;
}
