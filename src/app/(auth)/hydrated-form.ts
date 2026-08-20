'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * A submit that lands before the screen is interactive.
 *
 * The auth screens are client components: the handler that signs a person in
 * exists only once React has taken the form over. Until then the markup is
 * there and the fields are fillable — which is exactly the window a person on a
 * slow connection types in — and a click would perform a real POST to the page's
 * own path, which the App Router answers 405 for a route with no handler. The
 * person gets a browser error page and loses everything they typed.
 *
 * So the submit waits for interactivity (the recorded diagnosis for this
 * increment, in as many words): the control is disabled until this hook says the
 * form is hydrated, and the first thing it does when that happens is adopt
 * whatever was typed before, so the state React takes over with is the person's
 * text and not an empty string. `method="post"` stays as the second line of
 * defence — a submit that reaches the browser anyway must never put a password
 * in the URL.
 */
export function useHydratedForm(adopt: (typed: (name: string) => string) => void): {
  formRef: RefObject<HTMLFormElement | null>;
  ready: boolean;
} {
  const formRef = useRef<HTMLFormElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const form = formRef.current;
    if (form !== null) {
      const typed = new FormData(form);
      // one adoption, on the mount that makes this form interactive: the values
      // and `ready` land in the same render, so nothing is cleared on the way in
      adopt((name) => String(typed.get(name) ?? ''));
    }
    setReady(true);
    // deliberately once: a later run would overwrite what the person is typing
  }, []);

  return { formRef, ready };
}
