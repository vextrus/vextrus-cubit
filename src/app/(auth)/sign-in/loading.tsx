import { LoadingSkeleton } from '../../../ui/primitives/screen-state';

/**
 * R-UI-050 — the sign-in screen's loading state.
 *
 * The skeleton lives on the *public* screens only. A `loading.tsx` above a
 * screen that decides who may see it turns the answer into a streamed 200: the
 * shell is flushed before the session is read, so a device whose session has
 * just been revoked lands on the page and is redirected a beat later. The gated
 * screens (`/`, `/create-tenant`, `/account/sessions`, `/t/{slug}`) carry their
 * skeleton *inside* the page instead, below the check.
 */
export default function SignInLoading() {
  return <LoadingSkeleton />;
}
