'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Prompt = 'cancel' | 'back' | null;

const FALLBACK_MS = 400;

/**
 * Guards a form with unsaved changes. Next.js 16 has no router-level navigation blocking, so this
 * covers the form's own exits: Cancel (a confirm dialog), the back button and swipe-back (a history
 * entry added once the form has changes, caught on `popstate`), and closing or reloading the tab
 * (`beforeunload`). A copy of the form kept on the device covers iOS reloads.
 */
export function useUnsavedGuard(dirty: boolean, fallbackPath: string) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt>(null);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  /** Whether the extra history entry is in place. */
  const pushed = useRef(false);
  /** Where to go once that entry has been popped. */
  const pending = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // One extra history entry as soon as there is something to lose.
  useEffect(() => {
    if (dirty && !pushed.current) {
      window.history.pushState(window.history.state, '', window.location.href);
      pushed.current = true;
    }
  }, [dirty]);

  useEffect(() => {
    function onPopState() {
      if (pending.current) {
        const path = pending.current;
        pending.current = null;
        pushed.current = false;
        router.replace(path);
        return;
      }
      // Not our entry (an ordinary navigation): leave it to the router.
      if (!pushed.current) return;
      pushed.current = false;
      if (dirtyRef.current) {
        // Stay on the form, put the entry back and ask.
        window.history.pushState(window.history.state, '', window.location.href);
        pushed.current = true;
        setPrompt('back');
      } else {
        // Nothing to lose: carry on back to where the person came from.
        window.history.back();
      }
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [router]);

  /** Goes to `path` and takes the extra history entry with it, so Back doesn't land on the form. */
  const leaveTo = useCallback(
    (path: string) => {
      if (!pushed.current) {
        router.replace(path);
        return;
      }
      pending.current = path;
      window.history.back();
      // If the browser never reports the step back, go anyway.
      window.setTimeout(() => {
        if (pending.current !== path) return;
        pending.current = null;
        pushed.current = false;
        if (mounted.current) router.replace(path);
      }, FALLBACK_MS);
    },
    [router],
  );

  /** Cancel: leave straight away, or ask first when there are changes. */
  const requestCancel = useCallback(() => {
    if (dirtyRef.current) setPrompt('cancel');
    else leaveTo(fallbackPath);
  }, [leaveTo, fallbackPath]);

  const closePrompt = useCallback(() => setPrompt(null), []);

  /** The person chose to throw their changes away. */
  const confirmLeave = useCallback(() => {
    const kind = prompt;
    setPrompt(null);
    dirtyRef.current = false;
    if (kind === 'back' && pushed.current) {
      // Back or swipe-back: carry on to the page before the form (two steps: ours and the form's).
      pushed.current = false;
      window.history.go(-2);
      window.setTimeout(() => {
        if (mounted.current) router.replace(fallbackPath);
      }, FALLBACK_MS);
      return;
    }
    leaveTo(fallbackPath);
  }, [prompt, leaveTo, router, fallbackPath]);

  return { prompt, closePrompt, requestCancel, confirmLeave, leaveTo };
}
