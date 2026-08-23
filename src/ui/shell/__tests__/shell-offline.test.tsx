// @vitest-environment jsdom
/**
 * Going offline banners the shell without throwing the reader's work away.
 *
 * docs/design/shell.md §6: "the browser's `offline`/`online` events mount OfflineBanner
 * full-width at the top of `shell-main`, above the area content, on every shell screen;
 * content stays visible". Two things follow, and both are asserted here.
 *
 * The banner is a *sibling* of the reading column, not a wrapper around the area. React
 * reconciles by position and type, so a shell that re-parents `children` on the offline
 * event unmounts and remounts the whole area — an open surface, a half-typed field, a write
 * in flight, all gone the instant the connection blipped. "Content stays visible" is not
 * satisfied by content that comes back blank, which is why the test holds a value in the
 * area and reads it again after the event rather than only counting elements.
 */
import type { ReactElement } from 'react';
import { useState } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/t/acme/projects' }));

/** The fixture's own words, as module constants — no copy is written in JSX (R-SPINE-060). */
const TENANT = Object.freeze({ slug: 'acme', name: 'Acme' });
const ACCOUNT = 'a@example.com';
const SIGN_OUT = 'Sign out';
const DRAFT_LABEL = 'draft';
const TYPED = 'half a sentence';

const { AppShell } = await import('../app-shell');

afterEach(cleanup);

/** An area with state of its own — the thing a remount would destroy. */
function AreaWithState(): ReactElement {
  const [typed, setTyped] = useState('');
  return (
    <input
      aria-label={DRAFT_LABEL}
      value={typed}
      onChange={(event) => setTyped(event.target.value)}
    />
  );
}

function mount(): void {
  render(
    <AppShell
      tenantName={TENANT.name}
      slug={TENANT.slug}
      memberships={[TENANT]}
      accountEmail={ACCOUNT}
      signOutLabel={SIGN_OUT}
    >
      <AreaWithState />
    </AppShell>,
  );
}

/** The browser's own event, which is the only thing §6 listens to. */
function goOffline(online: boolean): void {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}

describe('the shell going offline', () => {
  it('keeps the area mounted, with the state the reader put in it', () => {
    mount();
    const draft = screen.getByLabelText(DRAFT_LABEL) as HTMLInputElement;
    act(() => {
      draft.focus();
    });
    // A value only React state holds: it survives a re-render and dies in a remount.
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(draft, TYPED);
      draft.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(draft.value).toBe(TYPED);

    goOffline(false);

    expect(screen.queryByTestId('offline-banner')).not.toBeNull();
    // The same DOM node, still carrying what was typed into it.
    expect(screen.getByLabelText(DRAFT_LABEL)).toBe(draft);
    expect(draft.value).toBe(TYPED);
  });

  it('mounts the banner across shell-main, above the reading column', () => {
    mount();
    goOffline(false);

    const banner = screen.getByTestId('offline-banner');
    const main = screen.getByTestId('shell-main');
    expect(main.contains(banner)).toBe(true);
    // §6 says the top of shell-main, not a note inside the 720 px column.
    expect(banner.closest('.shell-main-column')).toBeNull();
    const column = main.querySelector('.shell-main-column');
    expect(column).not.toBeNull();
    expect(banner.compareDocumentPosition(column as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('takes the banner away again when the connection returns', () => {
    mount();
    goOffline(false);
    expect(screen.queryByTestId('offline-banner')).not.toBeNull();

    goOffline(true);

    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.getByLabelText(DRAFT_LABEL)).not.toBeNull();
  });
});
