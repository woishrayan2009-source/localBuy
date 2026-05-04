/**
 * LocalBuy — Service Worker Registration
 * Registers sw.js and handles update prompts gracefully.
 * Shows a non-intrusive "New version available" banner when update is ready.
 *
 * Usage: <script src="js/sw-register.js" defer></script>
 */

(function () {
  'use strict';

  // Only register if supported
  if (!('serviceWorker' in navigator)) {
    console.log('[SW Register] Service workers not supported.');
    return;
  }

  // ─── Register the Service Worker ─────────────────────────────────────────
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[SW Register] Registered with scope:', registration.scope);

      // ── Listen for updates ──────────────────────────────────────────────
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[SW Register] New SW installing...');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A new SW is installed and waiting — show update banner
            console.log('[SW Register] New version available!');
            showUpdateBanner(newWorker);
          }
        });
      });

    } catch (err) {
      console.error('[SW Register] Registration failed:', err);
    }
  });

  // ─── Reload when controlled by new SW ────────────────────────────────────
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('[SW Register] New SW active — reloading page.');
      window.location.reload();
    }
  });

  // ─── Show Update Banner ───────────────────────────────────────────────────
  // A subtle, non-blocking banner at the bottom of the screen.
  // User can choose to update now or dismiss.
  function showUpdateBanner(newWorker) {
    // Don't show if already visible
    if (document.getElementById('lb-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'lb-update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-ink, #111827);
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      animation: slideUpBanner 0.3s ease forwards;
      max-width: calc(100vw - 32px);
    `;

    // Inject keyframe if not already present
    if (!document.getElementById('lb-sw-banner-style')) {
      const style = document.createElement('style');
      style.id = 'lb-sw-banner-style';
      style.textContent = `
        @keyframes slideUpBanner {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes slideUpBanner { from { opacity: 0; } to { opacity: 1; } }
        }
      `;
      document.head.appendChild(style);
    }

    banner.innerHTML = `
      <span>🔄 A new version of LocalBuy is ready.</span>
      <button id="lb-update-now" style="
        background: var(--color-sage, #0f5c3a);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        min-height: 36px;
      ">Update now</button>
      <button id="lb-update-dismiss" style="
        background: transparent;
        color: rgba(255,255,255,0.6);
        border: none;
        font-family: inherit;
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        min-height: 36px;
        min-width: 36px;
      " aria-label="Dismiss update banner">×</button>
    `;

    document.body.appendChild(banner);

    // "Update now" — tell waiting SW to take over
    document.getElementById('lb-update-now').addEventListener('click', () => {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      banner.remove();
    });

    // Dismiss — just close the banner, update will happen on next load
    document.getElementById('lb-update-dismiss').addEventListener('click', () => {
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.2s ease';
      setTimeout(() => banner.remove(), 200);
    });
  }

  // ─── Also handle messages from SW ────────────────────────────────────────
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      console.log('[SW Register] SW confirmed update.');
    }
  });

})();