// src/hooks/useScrollLock.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared scroll-lock hook.
// Uses body position:fixed (the only iOS-Safari-reliable approach) plus
// scroll-position save/restore so the page doesn't jump on close.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

export function useScrollLock() {
  useEffect(() => {
    const scrollY = window.scrollY;
    const { body } = document;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    // Prevent layout shift from scrollbar disappearing
    document.documentElement.style.setProperty(
      '--scrollbar-width',
      `${scrollbarWidth}px`
    );

    // position:fixed is the only reliable way to stop iOS Safari from
    // scrolling the background. overflow:hidden alone doesn't work there.
    body.style.overflow  = 'hidden';
    body.style.position  = 'fixed';
    body.style.top       = `-${scrollY}px`;
    body.style.left      = '0';
    body.style.right     = '0';
    body.classList.add('modal-open');

    return () => {
      body.style.overflow  = '';
      body.style.position  = '';
      body.style.top       = '';
      body.style.left      = '';
      body.style.right     = '';
      body.classList.remove('modal-open');
      document.documentElement.style.removeProperty('--scrollbar-width');
      // Restore the exact position — position:fixed resets scroll to 0
      window.scrollTo(0, scrollY);
    };
  }, []);
}