/*
 * The sheet decode Worker (issue #828): a sheet's render buffer read, checked and made ready to draw
 * off the main thread. `decoded.ts` posts it a copy of the buffer and gets the decoded sheet and its
 * prepared arrays back, every array moved (transferred), not copied. A buffer that is not a sheet
 * comes back as a refusal, never as a sheet. It imports the decoder and the preparation only: never
 * `./decoded`, whose cache lives on the main thread.
 */
import { decodeSheet, type DecodedSheet } from './decode'
import { prepareSheet, type PreparedSheet } from './prepare'

/** What the main thread posts: a request's id and the sheet's bytes. */
export interface DecodeRequest {
  id: number
  buffer: ArrayBuffer
}

/** What comes back: the sheet and its prepared arrays, or a refusal. */
export type DecodeReply = { id: number; sheet: DecodedSheet; ready: PreparedSheet } | { id: number; refused: true } | { started: true }

interface WorkerScope {
  onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null
  postMessage(message: DecodeReply, transfer?: Transferable[]): void
}

const scope = self as unknown as WorkerScope

/** Every distinct ArrayBuffer under `value`'s typed arrays (several views may share one). */
function buffersOf(value: unknown, into = new Set<ArrayBuffer>(), depth = 0): Set<ArrayBuffer> {
  if (ArrayBuffer.isView(value)) {
    if (value.buffer instanceof ArrayBuffer) into.add(value.buffer)
  } else if (value !== null && typeof value === 'object' && depth < 4) {
    for (const v of Object.values(value)) buffersOf(v, into, depth + 1)
  }
  return into
}

// Loaded: the main thread now knows a later failure is a decode's, not the script's (`decoded.ts`).
scope.postMessage({ started: true })

scope.onmessage = (event) => {
  const { id, buffer } = event.data
  let sheet: DecodedSheet
  let ready: PreparedSheet
  try {
    sheet = decodeSheet(buffer)
    ready = prepareSheet(sheet)
  } catch {
    scope.postMessage({ id, refused: true })
    return
  }
  const moved = buffersOf(ready, buffersOf(sheet))
  scope.postMessage({ id, sheet, ready }, [...moved])
}
