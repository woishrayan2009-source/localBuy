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
 *  - Landing page shop card rendering + chip filtering (M1 fix)
 */

'use strict';

// ─── Install Banner ──────────────────────────────────────────────────────────

const LB_INSTALL_DISMISSED_KEY = 'lb_install_dismissed';
let deferredInstallPrompt = null;

/**
 * FIX 1: Install banner only appears when the browser fires `beforeinstallprompt`.
 * The banner is NEVER shown unconditionally — `deferredInstallPrompt` must be set
 * first. `showInstallBanner()` now guards against being called without a valid
 * deferred prompt so a non-functional banner can never appear.
 */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Respect user's previous dismissal
  if (localStorage.getItem(LB_INSTALL_DISMISSED_KEY) === 'true') return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showInstallBanner, { once: true });
  } else {
    showInstallBanner();
  }
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallBanner();
  LB.analytics('pwa_installed');
});

function showInstallBanner() {
  // FIX 1: Guard — only show the banner when a deferred prompt actually exists.
  // Without this guard, any stray call to showInstallBanner() would render a
  // banner whose "Install" button would silently do nothing.
  if (!deferredInstallPrompt) return;

  const banner = document.getElementById('install-banner');
  if (!banner) return;
  banner.style.display = 'flex';
  requestAnimationFrame(() => banner.classList.add('visible'));
}

function hideInstallBanner(withAnimation = false) {
  const banner = document.getElementById('install-banner');
  if (!banner) return;

  if (withAnimation) {
    if (!document.getElementById('lb-install-banner-exit-style')) {
      const style = document.createElement('style');
      style.id = 'lb-install-banner-exit-style';
      style.textContent = `
        @keyframes bannerSlideOut {
          from { transform: translateY(0); opacity: 1; }
          to   { transform: translateY(-100%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes bannerSlideOut {
            from { opacity: 1; }
            to   { opacity: 0; }
          }
        }
        .install-banner.exiting {
          animation: bannerSlideOut 0.3s ease forwards;
        }
      `;
      document.head.appendChild(style);
    }
    banner.classList.add('exiting');
    banner.addEventListener('animationend', () => {
      banner.style.display = 'none';
      banner.classList.remove('exiting', 'visible');
    }, { once: true });
  } else {
    banner.style.display = 'none';
  }
}

function initInstallBanner() {
  const installBtn = document.getElementById('btn-install');
  const dismissBtn = document.getElementById('btn-install-dismiss');

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      // FIX 1: Guard — do nothing if no deferred prompt is available.
      if (!deferredInstallPrompt) return;
      await deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
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
  const defaultMsg =
    `🛒 এখন Guwahati-ত ঘৰৰ পৰাই order কৰক আৰু দোকানত গৈ লৈ আহক!\n\nLocalBuy — Your neighbourhood, online.\n👉 https://localbuy.in?ref=wa&utm_source=whatsapp&utm_medium=share&utm_campaign=launch`;

  const msg = encodeURIComponent(customMessage || defaultMsg);
  window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
  LB.analytics('whatsapp_share');
}

function initWhatsAppButtons() {
  document.querySelectorAll('[data-action="whatsapp-share"], [data-wa-share]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.shareMessage || null;
      shareOnWhatsApp(msg);
    });
  });
}

// ─── Custom Modal (replaces alert/confirm) ────────────────────────────────────

function createModal({
  title = '',
  body = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  dangerous = false
} = {}) {
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
        ${onConfirm ? `<button id="lb-modal-confirm" type="button" style="
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
        ${onCancel ? `<button id="lb-modal-cancel" type="button" style="
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
        @keyframes fadeOverlay  { from { opacity: 0; } to { opacity: 1; } }
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

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  return { close: closeModal };
}

// ─── Toast Notifications ──────────────────────────────────────────────────────

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
    pointer-events: all;
  `;

  toast.innerHTML = `
    <span aria-hidden="true">${iconMap[type]}</span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

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
  if (!timeStr || typeof timeStr !== 'string') return { hours: 0, minutes: 0 };
  timeStr = timeStr.trim();

  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

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
 * @param {Object} shop - shop object with lastOrder property (e.g. "8:30 PM")
 * @returns {'open' | 'closing-soon' | 'post-buffer'}
 */
function getShopStatus(shop) {
  const now = new Date();
  const { hours, minutes } = parseTime(shop.lastOrder);
  const lastOrderDate = new Date();
  lastOrderDate.setHours(hours, minutes, 0, 0);

  if (now > lastOrderDate) return 'post-buffer';

  const warnAt = addMinutes(lastOrderDate, -30);
  if (now >= warnAt) return 'closing-soon';

  return 'open';
}

/**
 * Format currency in Indian rupees
 * @param {number} amount
 * @returns {string}
 */
function formatINR(amount) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (_) {
    return `₹${Number(amount).toFixed(0)}`;
  }
}

// ─── Debounce ─────────────────────────────────────────────────────────────────
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

// ─── Landing page shop card rendering + chip filtering ────────────────────────

/**
 * renderLandingShopCards(shops)
 * Renders shop cards into the #shop-grid on index.html.
 * Only runs when window.MOCK_SHOPS is available (from db-bridge.js).
 * @param {Array} shops
 */
function renderLandingShopCards(shops) {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  // Remove skeleton placeholders
  grid.querySelectorAll('.skeleton').forEach(el => el.remove());

  if (!shops || shops.length === 0) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--color-muted);padding:24px;">No shops found.</p>';
    return;
  }

  grid.innerHTML = shops.map(shop => {
    const statusLabel = { open: 'Open', busy: 'Busy', closed: 'Closed' }[shop.status] || '';
    const statusClass = `status-badge--${shop.status}`;
    return `
      <div class="shop-card"
           data-shop-id="${shop.id}"
           data-category="${shop.category}"
           role="listitem"
           tabindex="0"
           aria-label="${shop.name}, ${statusLabel}">
        <div class="shop-card__icon" aria-hidden="true">${shop.emoji}</div>
        <p class="shop-card__name">${shop.name}</p>
        <p class="shop-card__meta">📍 ${shop.distance} · ⏱ ${shop.ready}</p>
        <span class="status-badge ${statusClass}" role="status">
          <span class="status-dot" aria-hidden="true"></span>
          ${statusLabel}
        </span>
      </div>
    `;
  }).join('');

  // Each card links to customer.html
  grid.querySelectorAll('.shop-card').forEach(card => {
    const go = () => {
      window.location.href = `customer.html#browse`;
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}

/**
 * initLandingChips()
 * Wires category chip clicks on index.html to filter #shop-grid cards.
 *
 * FIX 3: `window.MOCK_SHOPS` is now read dynamically inside each chip's click
 * handler (not captured once at init time). This means chips always reflect the
 * current value of MOCK_SHOPS even if db-bridge.js populates or updates it
 * after initLandingChips() has already run.
 */
function initLandingChips() {
  const chips = document.querySelectorAll('.category-chips .chip[data-category]');
  if (!chips.length) return;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      // Update active chip
      chips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');

      // FIX 3: Read window.MOCK_SHOPS dynamically so late-populated data is
      // always used rather than a stale snapshot captured at init time.
      const allShops = window.MOCK_SHOPS || [];
      const cat = chip.dataset.category;
      const filtered = cat === 'all'
        ? allShops
        : allShops.filter(s => s.category === cat);

      renderLandingShopCards(filtered);
    });
  });
}

/**
 * initLandingPage()
 * Entry point for index.html. Called on DOMContentLoaded.
 *
 * FIX 2: Shop cards are now rendered immediately from MOCK_SHOPS on DOM ready.
 * db-bridge.js must be loaded before app.js (via a <script> tag earlier in the
 * HTML) so that window.MOCK_SHOPS is populated by the time DOMContentLoaded
 * fires. If MOCK_SHOPS is empty or absent an empty-state message is shown
 * rather than a blank grid or an uncaught error.
 */
function initLandingPage() {
  // Only run on pages that have a landing shop-grid (index.html)
  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  // Guard: customer.html manages its own grid via customer.js — skip it.
  const isCustomerPage = document.getElementById('section-browse') !== null;
  if (isCustomerPage) return;

  // FIX 2: Read MOCK_SHOPS immediately; db-bridge.js should already have run.
  // If it hasn't (e.g. script order is wrong), we render an empty state so the
  // UI doesn't hang. Developers will see the empty state as a clear signal that
  // db-bridge.js needs to load before app.js.
  const allShops = window.MOCK_SHOPS || [];
  renderLandingShopCards(allShops);

  // Wire up chip filtering after cards are in the DOM.
  initLandingChips();
}

// ─── Namespace export ─────────────────────────────────────────────────────────
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

  // Landing page (M1)
  initLandingPage,
  renderLandingShopCards,
  initLandingChips,

  analytics: (eventName, params = {}) => {
    if (typeof __LB_DEBUG__ !== 'undefined' && __LB_DEBUG__) {
      console.log('[Analytics]', eventName, params);
    }
  }
};

// ─── Auto-init on DOM ready ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  LB.initInstallBanner();      // wires install/dismiss buttons only — banner
                               // itself is shown only if beforeinstallprompt fired
  LB.initWhatsAppButtons();
  LB.initStaggerAnimations();
  LB.initBackButtons();
  LB.initButtonActiveStates();

  // FIX 2: render shop cards + wire chips immediately on landing page.
  // db-bridge.js must appear before app.js in HTML so MOCK_SHOPS is ready.
  LB.initLandingPage();
});