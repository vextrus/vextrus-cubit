/**
 * `/t` not found — HTTP 404 for a slug nobody holds and for one this reader does not (§7).
 *
 * The two answer identically on purpose (Interpretation 4): naming the permission and its
 * holder, as R-UI-050 asks elsewhere, would confirm to a stranger that the workspace exists,
 * and that is the enumeration Q-12 forbids. The top bar is omitted — there is nothing
 * tenant-scoped to put in it.
 */
import { NavEmptyState } from './nav-empty-state';
import { ten } from './strings';

const SIGN_IN = '/sign-in';

export default function TenantNotFound() {
  return (
    <main className="tenant-notfound">
      <div className="tenant-notfound-inner">
        <NavEmptyState
          title={ten('tenant.notFound.title')}
          teach={ten('tenant.notFound.teach')}
          actionLabel={ten('tenant.notFound.action')}
          href={SIGN_IN}
        />
      </div>
    </main>
  );
}
