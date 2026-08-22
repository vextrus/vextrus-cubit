/**
 * SEAM-STORAGE's refusals — what the object store says when it will not hand bytes over.
 *
 * Four codes, all of them about a read that did not happen: an object nobody stored, a URL
 * whose life is over, a URL somebody edited, and a signing secret that is not in the
 * environment. There is no refusal for a failed write and none for a deletion, because
 * R-SPINE-021 keeps every revision forever: the seam has no delete and no overwrite, so
 * neither has a way to be refused.
 *
 * `TENANT_ID_INVALID` is not here. The storage seam raises it — a handle is tenant-scoped
 * before it is anything else — but it is the spine's code, registered once in `./spine`. Two
 * rows for one code is exactly what a closed taxonomy forbids (R-SPINE-062).
 */
import { registry } from './types';

export const STORAGE_REFUSALS = registry({
  STORAGE_OBJECT_MISSING: {
    code: 'STORAGE_OBJECT_MISSING',
    message: 'No object is stored under that sha256 for this tenant.',
    remedy: 'Check the sha256 against the revision record, and upload the file if it was never stored.',
    severity: 'block',
    surface: 'page',
  },
  STORAGE_URL_EXPIRED: {
    code: 'STORAGE_URL_EXPIRED',
    message: 'The signed download link has passed the moment it was minted to expire at.',
    remedy: 'Ask the document for a fresh download link; a link is short-lived on purpose.',
    severity: 'block',
    surface: 'page',
  },
  STORAGE_URL_INVALID: {
    code: 'STORAGE_URL_INVALID',
    message: 'The signed download link does not match its signature, so it was not minted as it stands.',
    remedy: 'Use the link exactly as it was issued, and ask for a new one rather than editing this one.',
    severity: 'block',
    surface: 'page',
  },
  STORAGE_SECRET_MISSING: {
    code: 'STORAGE_SECRET_MISSING',
    message: 'The local storage driver has no signing secret in its environment, so no link can be signed or checked.',
    remedy: 'Set CUBIT_STORAGE_SECRET in the environment before signing or serving a download link.',
    severity: 'block',
    surface: 'log',
  },
});
