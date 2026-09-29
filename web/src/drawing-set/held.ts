/*
 * Why files were not added, held for a project's Drawing Set while it is not on screen (the design
 * gate, round 2): a batch that finishes after its page has gone says only its one-line count in a toast,
 * and its refusals wait here until that project's Drawing Set is open again, where they show as its
 * error bars. Held per app (its QueryClient) and per session: a refusal is never shown to whoever is
 * signed in after the one who dropped the file.
 *
 *   hold(queryClient, project.id, current, refused)        // the batch's page is gone
 *   useHeld(queryClient, project.id, useCallback((refused) => setRefused((b) => [...b, ...refused]), []))
 */
import { useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'

interface Held<T> {
  current: () => boolean
  refused: readonly T[]
}

const store = new WeakMap<QueryClient, Map<string, Held<unknown>[]>>()
const open = new WeakMap<QueryClient, Map<string, (refused: readonly unknown[]) => void>>()

function heldFor(queryClient: QueryClient): Map<string, Held<unknown>[]> {
  let map = store.get(queryClient)
  if (!map) store.set(queryClient, (map = new Map()))
  return map
}

function openFor(queryClient: QueryClient): Map<string, (refused: readonly unknown[]) => void> {
  let map = open.get(queryClient)
  if (!map) open.set(queryClient, (map = new Map()))
  return map
}

/** Holds a gone page's refusals for its project: given at once to that project's page if one is open. */
export function hold<T>(queryClient: QueryClient, projectId: string, current: () => boolean, refused: readonly T[]): void {
  if (refused.length === 0 || !current()) return
  const page = openFor(queryClient).get(projectId)
  if (page) return page(refused)
  const map = heldFor(queryClient)
  map.set(projectId, [...(map.get(projectId) ?? []), { current, refused }])
}

/** The refusals held for a project, still the session's, taken (so they show once). */
export function take<T>(queryClient: QueryClient, projectId: string): T[] {
  const map = heldFor(queryClient)
  const held = map.get(projectId) ?? []
  map.delete(projectId)
  return held.filter((h) => h.current()).flatMap((h) => h.refused as readonly T[])
}

/**
 * For a project's open Drawing Set: `onRefused` gets the refusals held for it when it opens, and those
 * held while it is open (a batch dropped on an earlier page of the same project that ends now).
 * `onRefused` must keep its identity (useCallback).
 */
export function useHeld<T>(queryClient: QueryClient, projectId: string, onRefused: (refused: readonly T[]) => void): void {
  useEffect(() => {
    const waiting = take<T>(queryClient, projectId)
    if (waiting.length) onRefused(waiting)
    const pages = openFor(queryClient)
    const give = (refused: readonly unknown[]) => onRefused(refused as readonly T[])
    pages.set(projectId, give)
    return () => {
      if (pages.get(projectId) === give) pages.delete(projectId)
    }
  }, [queryClient, projectId, onRefused])
}
