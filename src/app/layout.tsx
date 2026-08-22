import type { ReactNode } from 'react';

/**
 * The served app's document (AC-4).
 *
 * This is a placeholder root, not a screen: no Design Decision governs it, and it carries
 * no shell, no tokens and no design-system content by design (this increment's scope). Its
 * whole job is to be something `next start` can serve on 3211 so that the V-E2E lane's own
 * health is provable before any product screen exists — and to arm `pnpm verify`'s typegen
 * and build stages, which key on the existence of this directory.
 *
 * `lang` is on <html> because J-000 runs axe over what this renders, and a document with no
 * language is a violation before a single element is added to it. `metadata` is exported
 * unannotated for the same reason next.config.ts imports nothing: `import type { Metadata }
 * from 'next'` drags next's ProcessEnv augmentation into every file tsc reads.
 */
export const metadata = {
  title: 'CUBIT V-E2E',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
