/**
 * The `/design` segment's document chrome.
 *
 * The stylesheet is imported here and not in the root layout: the root is a placeholder that
 * carries no tokens by design (inc-007a), so the segment that ships a screen brings its own
 * sheet — without it the gallery renders unstyled, and R-UI-011's evidence is a screenshot.
 */
import type { ReactNode } from 'react';
import { dsg } from './strings';
import '../../ui/globals.css';

export const metadata = {
  title: dsg('design.title'),
};

export default function DesignLayout({ children }: { children: ReactNode }) {
  return children;
}
