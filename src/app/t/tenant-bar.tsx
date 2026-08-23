'use client';

/**
 * The minimal top bar the two `/t` screens share (S-Auth §5).
 *
 * R-UI-030's full shell — left rail, project switcher, ⌘K, inspector — belongs to the
 * workspace increments. What S-Auth ships is a sticky hairline bar carrying the wordmark, the
 * tenant's name, the way to the session list and the way out.
 *
 * Sign-out is a fetch and then a navigation, not a form post: the session ends on the server
 * and the browser is then sent to `/sign-in` with the cookie already cleared.
 */
import { useCallback, useState } from 'react';
import { Button, Separator } from '../../ui/primitives';
import { ten } from './strings';

const SIGN_IN = '/sign-in';

export interface TenantBarProps {
  readonly tenantName: string;
  readonly slug: string;
}

export function TenantBar({ tenantName, slug }: TenantBarProps) {
  const [leaving, setLeaving] = useState(false);

  const signOut = useCallback(async () => {
    setLeaving(true);
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch {
      // The cookie may already be gone; either way the reader asked to leave.
    }
    window.location.assign(SIGN_IN);
  }, []);

  return (
    <header className="tenant-bar">
      <span className="tenant-bar-brand">{ten('tenant.brand')}</span>
      <Separator className="tenant-bar-separator" orientation="vertical" />
      <span className="tenant-bar-name">{tenantName}</span>
      <div className="tenant-bar-actions">
        <a className="tenant-bar-link datum-focus-ring" href={`/t/${slug}/sessions`}>
          {ten('tenant.nav.sessions')}
        </a>
        <Button
          variant="ghost"
          data-testid="auth-sign-out"
          loading={leaving}
          onClick={() => {
            void signOut();
          }}
        >
          {ten('tenant.signOut')}
        </Button>
      </div>
    </header>
  );
}
