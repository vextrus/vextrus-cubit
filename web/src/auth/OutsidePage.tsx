/*
 * A page outside the frame (sign-in, an invitation link, "Which Developer?", "Access ended", "No
 * access to anything"; docs/design/m0-screens.md §4.1, §4.2): a card centred on the grey background,
 * the brand at its head. It works at any width (§1.5: sign-in works at any width), so it is never
 * replaced by the phone notice.
 */
import { useMemo, type ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'
import { FormatProvider } from '@/format'
import { BrandMark, cn } from '@/ui'
import { outsideMarket } from './market'
import { usePageTitle } from './title'

export function OutsidePage({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const { t } = useLingui()
  usePageTitle(title)
  const market = useMemo(() => outsideMarket(), [])
  return (
    <FormatProvider profile={market}>
      <main data-outside-frame="" className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
        <div className={cn('w-full rounded-lg border border-border bg-paper p-6 shadow-1', wide ? 'max-w-[440px]' : 'max-w-[360px]')}>
          <div className="mb-5 flex items-center gap-2.5">
            <BrandMark size={24} />
            <span className="text-md font-semibold">{t`Vextrus`}</span>
          </div>
          {children}
        </div>
      </main>
    </FormatProvider>
  )
}
