import { LoadingSkeleton } from '../../ui/primitives/screen-state';

/**
 * R-UI-050 — the loading state for every auth screen and for /account/sessions:
 * a skeleton that holds the layout while the server renders, never a spinner.
 */
export default function AuthLoading() {
  return <LoadingSkeleton />;
}
