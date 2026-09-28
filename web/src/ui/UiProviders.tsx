/*
 * Everything the pieces in src/ui/ need above them: messages and direction, the key map, tooltips and
 * the toast. The frame (ticket 03) wraps the app in it once.
 */
import type { ReactNode } from 'react'
import { I18nRoot } from '@/i18n/I18nRoot'
import { KeyMapProvider } from './keys/KeyMapProvider'
import type { KeyMap } from './keys/registry'
import { TooltipProvider } from './primitives/tooltip'
import { ToastProvider } from './Toast'

export function UiProviders({ children, keyMap }: { children: ReactNode; keyMap?: KeyMap }) {
  return (
    <I18nRoot>
      <KeyMapProvider map={keyMap}>
        <TooltipProvider>
          <ToastProvider>{children}</ToastProvider>
        </TooltipProvider>
      </KeyMapProvider>
    </I18nRoot>
  )
}
