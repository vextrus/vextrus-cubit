import type { I18n, MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { Role } from './session'

const ROLE_NAMES: Readonly<Record<Role, MessageDescriptor>> = {
  qs: msg({ message: 'QS', context: 'role' }),
  md: msg({ message: 'MD', context: 'role' }),
  vextrus_engineer: msg({ message: 'Vextrus Engineer', context: 'role' }),
  guest: msg({ message: 'Guest', context: 'role' }),
}

/** A role's name as the product says it (CONTEXT.md: QS, MD, Vextrus Engineer, Guest). */
export function roleName(role: Role, i18n: I18n): string {
  return i18n._(ROLE_NAMES[role])
}
