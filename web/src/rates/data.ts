/*
 * Market Prices and Rate Analyses (session 16's contract, "rates (RT)"): the working price set's
 * Resources with their prices, one Resource's price edited, and a BOQ Item's Rate Analysis. Every
 * address is under `/api/projects/{project_id}/`; money is `{amount, currency}` and every figure an
 * exact decimal string, never a float. A Resource with no price has `price: null` and shows "rate
 * not entered", never ৳0.
 *
 * The routes are not in the generated schema yet (K0's stubs answer 501 until RT lands), so their
 * types are written here, in the contract's shapes, on the one client's transport.
 */
import { queryOptions } from '@tanstack/react-query'
import { createApi, unwrap } from '@/api/client'
import type { Money } from '@/format'

export interface PriceRow {
  resource_code: string
  name: string
  unit: string
  price: Money | null
  source_ref: string
  changed_at: string | null
}

export interface PricesOut {
  price_set: { id: string; name: string; currency: string }
  prices: PriceRow[]
}

export interface RateLine {
  resource_code: string
  name: string
  qty: string
  unit: string
  price: Money | null
  amount: Money | null
  source_ref: string
}

export interface RateOut {
  item_code: string
  per_unit: string
  rate: Money | null
  lines: RateLine[]
}

type Json<T> = { content: { 'application/json': T } }
type Ok<T> = {
  200: {
    headers: { [name: string]: unknown }
    content: { 'application/json': T }
  }
}
type Params<P extends Record<string, string>> = {
  query?: never
  header?: never
  path: P
  cookie?: never
}
type Methods = {
  get?: never
  put?: never
  post?: never
  delete?: never
  options?: never
  head?: never
  patch?: never
  trace?: never
}
type Path<O> = Omit<Methods, keyof O> & O
type Project = { project_id: string }

export interface RatesPaths {
  '/api/projects/{project_id}/prices': Path<{
    get: {
      parameters: Params<Project>
      requestBody?: never
      responses: Ok<PricesOut>
    }
  }>
  '/api/projects/{project_id}/prices/{resource_code}': Path<{
    put: {
      parameters: Params<Project & { resource_code: string }>
      requestBody: Json<{ amount: string }>
      responses: Ok<PriceRow>
    }
  }>
  '/api/projects/{project_id}/rates/{item_code}': Path<{
    get: {
      parameters: Params<Project & { item_code: string }>
      requestBody?: never
      responses: Ok<RateOut>
    }
  }>
}

export const ratesApi = createApi<RatesPaths>()

export const pricesKey = (projectId: string) => ['prices', projectId] as const
export const rateKey = (projectId: string, itemCode: string) => ['rates', projectId, itemCode] as const

export function pricesQuery(projectId: string) {
  return queryOptions({
    queryKey: pricesKey(projectId),
    queryFn: () =>
      unwrap(
        ratesApi.GET('/api/projects/{project_id}/prices', {
          params: { path: { project_id: projectId } },
        }),
      ),
  })
}

export function rateQuery(projectId: string, itemCode: string) {
  return queryOptions({
    queryKey: rateKey(projectId, itemCode),
    queryFn: () =>
      unwrap(
        ratesApi.GET('/api/projects/{project_id}/rates/{item_code}', {
          params: { path: { project_id: projectId, item_code: itemCode } },
        }),
      ),
  })
}

/** Puts a Resource's price (an exact decimal as typed); the API's refusal is thrown as an `ApiRefused`. */
export function putPrice(projectId: string, resourceCode: string, amount: string): Promise<PriceRow> {
  return unwrap(
    ratesApi.PUT('/api/projects/{project_id}/prices/{resource_code}', {
      params: { path: { project_id: projectId, resource_code: resourceCode } },
      body: { amount },
    }),
  )
}

/**
 * A positive number as typed, for a price or an area: digits with an optional decimal part, grouped
 * as the Market groups ("1,25,000.50") or not at all; else null. A comma anywhere but a group (the
 * decimal comma of "95,50") is refused, never read as grouping, and so is zero.
 */
export function priceAsTyped(text: string): string | null {
  const plain = text.trim()
  const grouped = /^\d{1,3}(?:,\d{2})*,\d{3}(?:\.\d+)?$|^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(plain)
  if (!grouped && !/^\d+(?:\.\d+)?$/.test(plain)) return null
  const digits = plain.replace(/,/g, '')
  return /[1-9]/.test(digits) ? digits : null
}
