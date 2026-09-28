/*
 * /dev/specimen: every src/ui/ piece on invented data, where the design gate judges them. Development
 * builds only: vite.config.ts leaves the `dev` folder out of a production build's route tree, and
 * `npm run build` fails if the specimen reaches the bundle (scripts/check-dist.mjs).
 */
import { createFileRoute } from '@tanstack/react-router'
import { Specimen } from '@/dev/specimen/Specimen'

export const Route = createFileRoute('/dev/specimen')({
  validateSearch: (search: Record<string, unknown>): { lang?: string } =>
    typeof search.lang === 'string' ? { lang: search.lang } : {},
  component: SpecimenRoute,
})

function SpecimenRoute() {
  const { lang } = Route.useSearch()
  return <Specimen lang={lang} />
}
