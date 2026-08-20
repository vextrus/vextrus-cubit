'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { strings } from '../strings/common';

/**
 * R-UI-050 — the offline state, which every screen owes: a banner that says the
 * screen has gone read-only, not a form that silently fails to save.
 *
 * It renders nothing at all while the connection is up, so an online screen
 * looks exactly as it did. The first render is always the online one — the
 * server cannot know the browser's connection, and a banner that appears only
 * after hydration is a banner that never disagrees with the markup it replaced.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const read = () => setOffline(!navigator.onLine);
    read();
    window.addEventListener('online', read);
    window.addEventListener('offline', read);
    return () => {
      window.removeEventListener('online', read);
      window.removeEventListener('offline', read);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline" data-testid="offline-banner" role="status">
      <WifiOff aria-hidden="true" size={16} />
      <span className="notice-strong">{strings.offlineTitle}</span>
      <span>{strings.offlineLede}</span>
    </div>
  );
}
