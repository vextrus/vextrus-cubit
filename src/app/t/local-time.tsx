'use client';

/**
 * An instant as `YYYY-MM-DD HH:mm`, in the reader's own zone — the `/t` screens' time idiom
 * (s-settings §4, s-home §2, panes file §5).
 *
 * The server does not know the reader's zone, so the first paint is UTC and the browser
 * replaces it with local time once it has said what its zone is. Never a blank slot: a time
 * that has not been localised yet is still the right instant, written differently.
 */
import { useEffect, useState } from 'react';

const pad = (value: number): string => String(value).padStart(2, '0');

function utcTime(when: Date): string {
  return (
    `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())} ` +
    `${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}`
  );
}

function localTime(when: Date): string {
  return (
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ` +
    `${pad(when.getHours())}:${pad(when.getMinutes())}`
  );
}

export function LocalTime({ iso }: { readonly iso: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const when = new Date(iso);
  return <span className="numeric">{mounted ? localTime(when) : utcTime(when)}</span>;
}
