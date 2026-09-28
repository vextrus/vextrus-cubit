/*
 * "/" until ticket 03's frame replaces it: the brand mark on the grey table, nothing to read.
 */
import { createFileRoute } from '@tanstack/react-router'
import { BrandMark } from '@/ui/glyphs'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <BrandMark size={48} />
    </main>
  )
}
