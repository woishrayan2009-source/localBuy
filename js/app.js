/**
 * LocalBuy — app.js
 * Shared utilities used across index.html, customer.html, shopkeeper.html.
 *
 * Responsibilities:
 *  - PWA install banner (beforeinstallprompt)
 *  - WhatsApp share helper
 *  - Custom modal/dialog system (replaces alert/confirm)
 *  - Toast notification system
 *  - Shared time parsing utilities
 *  - Page load animation trigger
 */

'use strict';

// ─── Install Banner ──────────────────────────────────────────────────────────
// Listens for beforeinstallprompt, shows our custom sage-green banner.
// Persists dismiss in localStorage so it doesn't keep appearing.

const LB_INSTALL_DISMISSED_KEY = 'lb_install_dismissed';
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // Stop browser's default mini-infobar
  deferredInstallPrompt = e;

  // Don't show if user previously dismissed
  if (localStorage.getItem(LB_INSTALL_DISMISSED_KEY) === 'true') return;

  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallBanner();
  console.log('[LocalBuy] PWA installed!');
  LB.analytics('pwa_installed');
});

function showInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (!banner) return;
  banner.style.display = 'flex';
  requestAnimationFrame(() => banner.classList.add('visible'));
}

function hideInstallBanner(withAnimation = false) {
  const banner = document.getElementById('install-banner');
  if (!banner) return;

  if (withAnimation) {
    banner.classList.add('exiting');
    banner.addEventListener('animationend', () => {
      banner.style.display = 'none';
      banner.classList.remove('exiting', 'visible');
    }, { once: true });
  } else {
    banner.style.display = 'none';
  }
}

// Wire up install banner buttons (called after DOM loads)
function initInstallBanner() {
  const installBtn = document.getElementById('btn-install');
  const dismissBtn = document.getElementById('btn-install-dismiss');

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      await deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('[LocalBuy] Install prompt outcome:', outcome);
      deferredInstallPrompt = null;
      hideInstallBanner(true);
      LB.analytics('pwa_install_prompt', { outcome });
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      localStorage.setItem(LB_INSTALL_DISMISSED_KEY, 'true');
      hideInstallBanner(true);
      LB.analytics('pwa_install_dismissed');
    });
  }
}

// ─── WhatsApp Share ───────────────────────────────────────────────────────────
function shareOnWhatsApp(customMessage) {
  // Assamese message with fallback to English
  const defaultMsg =
    `🛒 এখন Guwahati-ত ঘৰৰ পৰাই order কৰক আৰু দোকানত গৈ লৈ আহক!\n\nLocalBuy — Your neighbourhood, online.\n👉 https://localbuy.in?ref=wa&utm_source=whatsapp&utm_medium=share&utm_campaign=launch`;

  const msg = encodeURIComponent(customMessage || defaultMsg);
  window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
  LB.analytics('whatsapp_share');
}

// Wire up any element with data-action="whatsapp-share"
function initWhatsAppButtons() {
  document.querySelectorAll('[data-action="whatsapp-share"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.shareMessage || null;
      shareOnWhatsApp(msg);
    });
  });
}

// ─── Custom Modal (replaces alert/confirm) ────────────────────────────────────
// Usage: LB.modal({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel })

function createModal({ title = '', body = '', confirmLabel = 'OK', cancelLabel = 'Cancel', onConfirm, onCancel, dangerous = false } = {}) {
  // Remove any existing modal
  const existing = document.getElementById('lb-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'lb-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'lb-modal-title');
  overlay.style.cssText = `
    position: fixed; inset: 0;
    background: rgba(17,24,39,0.6);
    display: flex; align-items: flex-end; justify-content: center;
    z-index: 10000;
    padding: 0 0 env(safe-area-inset-bottom, 0);
    animation: fadeOverlay 0.2s ease forwards;
  `;

  overlay.innerHTML = `
    <div class="lb-modal-sheet" style="
      background: var(--color-surface, #f8f7f4);
      border-radius: 20px 20px 0 0;
      padding: 32px 24px 40px;
      max-width: 540px;
      width: 100%;
      animation: slideUpSheet 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
    ">
      <h3 id="lb-modal-title" style="
        font-family: 'Fraunces', serif;
        font-size: 20px;
        color: var(--color-ink, #111827);
        margin: 0 0 12px;
      ">${title}</h3>
      <p style="
        font-family: 'DM Sans', sans-serif;
        font-size: 15px;
        color: var(--color-muted, #6b7280);
        margin: 0 0 28px;
        line-height: 1.6;
      ">${body}</p>
      <div style="display: flex; gap: 12px; flex-direction: column;">
        ${onConfirm ? `<button id="lb-modal-confirm" style="
          background: ${dangerous ? '#dc2626' : 'var(--color-sage, #0f5c3a)'};
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          min-height: 52px;
          transition: transform 0.1s ease;
        ">${confirmLabel}</button>` : ''}
        ${onCancel ? `<button id="lb-modal-cancel" style="
          background: transparent;
          color: var(--color-muted, #6b7280);
          border: 2px solid var(--color-muted, #6b7280);
          border-radius: 12px;
          padding: 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          cursor: pointer;
          min-height: 52px;
        ">${cancelLabel}</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Inject sheet animation if needed
  if (!document.getElementById('lb-modal-style')) {
    const style = document.createElement('style');
    style.id = 'lb-modal-style';
    style.textContent = `
      @keyframes fadeOverlay { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUpSheet {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        @keyframes slideUpSheet { from { opacity: 0; } to { opacity: 1; } }
      }
      #lb-modal-confirm:active { transform: scale(0.97); }
      #lb-modal-cancel:active  { transform: scale(0.97); }
    `;
    document.head.appendChild(style);
  }

  function closeModal() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s ease';
    setTimeout(() => overlay.remove(), 150);
  }

  if (onConfirm) {
    document.getElementById('lb-modal-confirm').addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
  }

  if (onCancel) {
    document.getElementById('lb-modal-cancel').addEventListener('click', () => {
      closeModal();
      onCancel();
    });
  }

  // Close on backdrop tap
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
      if (onCancel) onCancel();
    }
  });

  return { close: closeModal };
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
// Lightweight, accessible toasts. Type: 'success' | 'error' | 'info' | 'warn'

function showToast(message, type = 'info', duration = 3500) {
  const toastContainer = getOrCreateToastContainer();

  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const iconMap = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const colorMap = {
    success: 'var(--status-open, #16a34a)',
    error:   'var(--status-closed, #dc2626)',
    info:    'var(--color-sage, #0f5c3a)',
    warn:    'var(--status-busy, #d97706)'
  };

  toast.style.cssText = `
    background: var(--color-ink, #111827);
    color: #fff;
    padding: 12px 16px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    border-left: 4px solid ${colorMap[type]};
    animation: toastIn 0.3s ease forwards;
    max-width: 320px;
    width: 100%;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  `;

  toast.innerHTML = `
    <span aria-hidden="true">${iconMap[type]}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

function getOrCreateToastContainer() {
  let container = document.getElementById('lb-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'lb-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9998;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      pointer-events: none;
      width: calc(100vw - 32px);
      max-width: 360px;
    `;
    document.body.appendChild(container);

    // Inject toast keyframes once
    if (!document.getElementById('lb-toast-style')) {
      const style = document.createElement('style');
      style.id = 'lb-toast-style';
      style.textContent = `
        @keyframes toastIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastOut { from { opacity: 1; } to { opacity: 0; transform: translateY(-4px); } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes toastIn  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes toastOut { from { opacity: 1; } to { opacity: 0; } }
        }
      `;
      document.head.appendChild(style);
    }
  }
  return container;
}

// ─── Time Utilities ───────────────────────────────────────────────────────────

/**
 * Parse a time string like "8:30 PM" or "14:30" into { hours, minutes } (24h).
 * @param {string} timeStr
 * @returns {{ hours: number, minutes: number }}
 */
function parseTime(timeStr) {
  if (!timeStr) return { hours: 0, minutes: 0 };
  timeStr = timeStr.trim();

  // Try 12-hour format: "8:30 PM"
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // Try 24-hour format: "14:30"
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { hours: parseInt(match24[1], 10), minutes: parseInt(match24[2], 10) };
  }

  return { hours: 0, minutes: 0 };
}

/**
 * Format a Date object to "hh:mm AM/PM"
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Add minutes to a Date object, returns new Date.
 * @param {Date} date
 * @param {number} minutes
 * @returns {Date}
 */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

/**
 * Get shop status based on current time vs shop hours.
 * @param {Object} shop - shop object with lastOrder property
 * @returns {'open' | 'closing-soon' | 'post-buffer' | 'closed'}
 */
function getShopStatus(shop) {
  const now = new Date();
  const { hours, minutes } = parseTime(shop.lastOrder);
  const lastOrderDate = new Date();
  lastOrderDate.setHours(hours, minutes, 0, 0);

  // If past last order time — closed
  if (now > lastOrderDate) return 'post-buffer';

  // If within 30 min of last order — closing soon
  if (now > addMinutes(lastOrderDate, -30)) return 'closing-soon';

  return 'open';
}

/**
 * Format currency in Indian rupees
 * @param {number} amount
 * @returns {string}
 */
function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

// ─── Debounce ─────────────────────────────────────────────────────────────────
/**
 * Standard debounce utility.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function showSkeletonCards(container, count = 4) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const skel = document.createElement('div');
    skel.className = 'shop-card skeleton-card';
    skel.setAttribute('aria-hidden', 'true');
    skel.innerHTML = `
      <div class="skeleton-icon"></div>
      <div class="skeleton-line long"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-badge"></div>
    `;
    container.appendChild(skel);
  }
}

// ─── Page Load Animations ─────────────────────────────────────────────────────
// Trigger staggered fadeUp on .animate-child elements inside .stagger-parent
function initStaggerAnimations() {
  const parents = document.querySelectorAll('.stagger-parent');
  parents.forEach(parent => {
    const children = parent.querySelectorAll('.animate-child');
    children.forEach((child, i) => {
      child.style.animationDelay = `${i * 0.06}s`;
      child.style.animationFillMode = 'both';
      child.classList.add('fade-up');
    });
  });
}

// ─── Back Button Utility ──────────────────────────────────────────────────────
function initBackButtons() {
  document.querySelectorAll('[data-action="back"]').forEach(btn => {
    btn.addEventListener('click', () => history.back());
  });
}

// ─── Active button scale on :active ──────────────────────────────────────────
function initButtonActiveStates() {
  // CSS handles :active on buttons with transform: scale(0.97)
  // This ensures dynamically injected buttons also get the style
  if (!document.getElementById('lb-active-style')) {
    const style = document.createElement('style');
    style.id = 'lb-active-style';
    style.textContent = `
      button:active, .btn:active, [role="button"]:active {
        transform: scale(0.97) !important;
        transition: transform 0.1s ease !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── Namespace export ─────────────────────────────────────────────────────────
// All utilities exported as LB.* for use by customer.js and shopkeeper.js

window.LB = {
  // Install
  initInstallBanner,
  showInstallBanner,
  hideInstallBanner,

  // Share
  shareOnWhatsApp,
  initWhatsAppButtons,

  // UI
  modal: createModal,
  toast: showToast,

  // Time
  parseTime,
  formatTime,
  addMinutes,
  getShopStatus,
  formatINR,

  // Utilities
  debounce,
  showSkeletonCards,
  initStaggerAnimations,
  initBackButtons,
  initButtonActiveStates,

  // Analytics stub
  // TODO: Replace with real analytics (privacy-first, no PII)
  analytics: (eventName, params = {}) => {
    console.log('[Analytics]', eventName, params);
    // TODO: POST to /api/analytics or use Firebase Analytics
  }
};

// ─── Auto-init on DOM ready ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  LB.initInstallBanner();
  LB.initWhatsAppButtons();
  LB.initStaggerAnimations();
  LB.initBackButtons();
  LB.initButtonActiveStates();
  console.log('[LocalBuy] app.js initialised');
});