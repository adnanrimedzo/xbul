'use client';

import { useSyncExternalStore } from 'react';

type Choice = 'system' | 'light' | 'dark';
const NEXT: Record<Choice, Choice> = { system: 'light', light: 'dark', dark: 'system' };
const KEY = 'theme';

// Runs in <head> before the first paint, so a saved choice never flashes the other theme.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

// The <html> attribute is the source of truth: the head script sets it, and a click changes it.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
const read = (): Choice => {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : 'system';
};

function apply(choice: Choice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  listeners.forEach((fn) => fn());
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, read, (): Choice => 'system');

  return (
    <button
      type="button"
      onClick={() => apply(NEXT[choice])}
      aria-label={`Theme: ${choice}. Switch to ${NEXT[choice]}`}
      title={`Theme: ${choice}`}
      className="inline-flex size-11 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:text-fg"
    >
      <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {choice === 'light' ? (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
          </>
        ) : choice === 'dark' ? (
          <path d="M16 12.5A6.5 6.5 0 0 1 7.5 4a6.5 6.5 0 1 0 8.5 8.5Z" />
        ) : (
          <>
            <circle cx="10" cy="10" r="7" />
            <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
