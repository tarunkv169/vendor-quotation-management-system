import { useSyncExternalStore } from 'react';

// Light / dark theme. The choice is stored per browser; the first visit follows the operating system.
// index.html applies the stored theme before React starts, so pages never flash the wrong colours.
const STORAGE_KEY = 'vqms.theme';
const EVENT = 'vqms-theme-change';

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function getTheme() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // storage blocked (private mode): fall through to the system theme
  }
  return systemTheme();
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f8f7f3' : '#262626');
}

export function setTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // not remembered, but still applied for this page
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback) {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback); // other tabs
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Current theme ('light' | 'dark') and a toggle; re-renders when it changes (also from other tabs). */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme || getTheme());
  return { theme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
