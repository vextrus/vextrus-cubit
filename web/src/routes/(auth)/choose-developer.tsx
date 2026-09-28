/*
 * "Which Developer?" (docs/design/m0-screens.md §4.2), outside the frame: only for a user holding a
 * current Membership; anyone else goes where they belong.
 */
import { createFileRoute } from '@tanstack/react-router'
import { ChooseDeveloperPage, atGate } from '@/auth'

export const Route = createFileRoute('/(auth)/choose-developer')({
  validateSearch: (search: Record<string, unknown>): { next?: string } => (typeof search.next === 'string' ? { next: search.next } : {}),
  beforeLoad: ({ context }) => atGate(context.queryClient, 'choose'),
  component: ChooseDeveloperPage,
})
