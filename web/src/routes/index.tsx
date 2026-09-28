/*
 * "/": the member's projects (ticket 20a builds /projects; until then it shows "Page not found").
 */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { PATHS } from '@/app/AppLink'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: PATHS.projects as '/' })
  },
})
