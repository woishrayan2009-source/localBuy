/**
 * upi.js — LocalBuy
 * ─────────────────────────────────────────────────────────────────────────────
 * UPI deep-link builder, app launcher, and QR fallback modal.
 *
 * Security note:
 *   TODO: UPI VPA must be resolved server-side; never expose in frontend JS.
 *         In production, call POST /api/upi/intent to get a signed payment URL.
 *         The VPA returned here is for demo only.
 *
 * UPI deep-link spec:
 *   upi://pay?pa={vpa}&pn={name}&am={amount}&tn={note}&cu=INR
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ─── UPI app definitions ─────────────────────────────────────────────────── */

const UPI_APPS = [
  {
    id:      'gpay',
    name:    'GPay',
    scheme:  'tez://',        // Google Pay deep link prefix
    color:   '#4285F4',
    emoji:   '🅖',
    // Android intent for Google Pay
    intent:  (link) => link.replace('upi://', 'tez://upi/')
  },
  {
    id:      'phonepe',
    name:    'PhonePe',
    scheme:  'phonepe://',
    color:   '#5F259F',
    emoji:   '🅟',
    intent:  (link) => link.replace('upi://', 'phonepe://')
  },
  {
    id:      'paytm',
    name:    'Paytm',
    scheme:  'paytmmp://',
    color:   '#00BAF2',
    emoji:   '🅟',
    intent:  (link) => link.replace('upi://', 'paytmmp://')
  },
  {
    id:      'bhim',
    name:    'BHIM',
    scheme:  'upi://',
    color:   '#002970',
    emoji:   '🇮🇳',
    intent:  (link) => link   // BHIM uses standard upi:// scheme
  },
  {
    id:      'other',
    name:    'Other UPI',
    scheme:  'upi://',
    color:   '#0f5c3a',
    emoji:   '💳',
    intent:  (link) => link
  }
];

/* ─── Core link builder ───────────────────────────────────────────────────── */

/**
 * Build a standard UPI deep-link string.
 * @param {{ pa: string, pn: string, am: number|string, tn: string, cu?: string }} params
 * @returns {string} UPI intent URL
 *
 * TODO: In production, fetch signed payment URL from backend:
 *   const res = await fetch('/api/upi/intent', { method: 'POST', body: JSON.stringify({ orderId, amount }) });
 *   const { upiUrl } = await res.json();
 *   return upiUrl;
 */
function buildUPILink({ pa, pn, am, tn, cu = 'INR' }) {
  const params = new URLSearchParams({
    pa: pa,                     // payee address (VPA)
    pn: pn,                     // payee name
    am: Number(am).toFixed(2),  // amount — always 2 decimal places
    tn: tn,                     // transaction note
    cu: cu                      // currency
  });
  return `upi://pay?${params.toString()}`;
}

/* ─── App launcher ────────────────────────────────────────────────────────── */

/**
 * Attempt to launch a UPI app via deep link.
 * Falls back to QR modal if the app is not installed.
 *
 * @param {string} upiLink — the upi:// deep link
 * @param {string} appId   — which app to try (from UPI_APPS)
 */
function launchUPI(upiLink, appId = 'other') {
  const app    = UPI_APPS.find(a => a.id === appId) || UPI_APPS[4];
  const intent = app.intent(upiLink);

  const start  = Date.now();

  // On Android, this will switch to the UPI app if installed
  window.location.href = intent;

  // If the user is still on the page after 1.5s the app wasn't found
  setTimeout(() => {
    if (Date.now() - start < 2000) {
      showQRFallback(upiLink, appId);
    }
  }, 1500);

  // Log (no PII — only event name and app ID)
  if (window.DB) window.DB.logEvent('upi_launch_attempt', { appId });
}

/* ─── QR fallback modal ───────────────────────────────────────────────────── */

/**
 * Show a modal with the UPI link as a copyable string and a placeholder QR.
 *
 * TODO: Replace placeholder QR with real QR generation:
 *   import QRCode from 'qrcode'; // npm install qrcode (or CDN)
 *   const canvas = document.getElementById('upi-qr-canvas');
 *   await QRCode.toCanvas(canvas, upiLink, { width: 220, color: { dark: '#0f5c3a', light: '#f0faf4' } });
 *
 * @param {string} upiLink
 * @param {string} [triggeredBy] — which app button was clicked (for analytics)
 */
function showQRFallback(upiLink, triggeredBy = '') {
  // Remove existing modal if any
  const existing = document.getElementById('upi-qr-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'upi-qr-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'upi-qr-title');

  modal.innerHTML = `
    <div class="upi-qr-backdrop"></div>
    <div class="upi-qr-sheet">
      <div class="upi-qr-header">
        <h3 id="upi-qr-title">Pay via UPI</h3>
        <button class="upi-qr-close" aria-label="Close">✕</button>
      </div>

      <p class="upi-qr-sub">Scan this QR with any UPI app on your phone</p>

      <!-- QR placeholder: replace with <canvas id="upi-qr-canvas"> when qrcode.js is available -->
      <div class="upi-qr-placeholder" aria-label="QR code placeholder">
        <svg viewBox="0 0 100 100" width="200" height="200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <!-- Finder patterns (corners) -->
          <rect x="5"  y="5"  width="30" height="30" rx="3" fill="none" stroke="var(--color-sage)" stroke-width="3"/>
          <rect x="10" y="10" width="20" height="20" rx="2" fill="none" stroke="var(--color-sage)" stroke-width="2"/>
          <rect x="14" y="14" width="12" height="12" rx="1" fill="var(--color-sage)"/>

          <rect x="65" y="5"  width="30" height="30" rx="3" fill="none" stroke="var(--color-sage)" stroke-width="3"/>
          <rect x="70" y="10" width="20" height="20" rx="2" fill="none" stroke="var(--color-sage)" stroke-width="2"/>
          <rect x="74" y="14" width="12" height="12" rx="1" fill="var(--color-sage)"/>

          <rect x="5"  y="65" width="30" height="30" rx="3" fill="none" stroke="var(--color-sage)" stroke-width="3"/>
          <rect x="10" y="70" width="20" height="20" rx="2" fill="none" stroke="var(--color-sage)" stroke-width="2"/>
          <rect x="14" y="74" width="12" height="12" rx="1" fill="var(--color-sage)"/>

          <!-- Data modules (decorative dots) -->
          <g fill="var(--color-sage)" opacity="0.7">
            <rect x="42" y="5"  width="4" height="4" rx="0.5"/>
            <rect x="48" y="5"  width="4" height="4" rx="0.5"/>
            <rect x="54" y="5"  width="4" height="4" rx="0.5"/>
            <rect x="42" y="11" width="4" height="4" rx="0.5"/>
            <rect x="54" y="11" width="4" height="4" rx="0.5"/>
            <rect x="42" y="17" width="4" height="4" rx="0.5"/>
            <rect x="48" y="17" width="4" height="4" rx="0.5"/>
            <rect x="42" y="23" width="4" height="4" rx="0.5"/>
            <rect x="54" y="23" width="4" height="4" rx="0.5"/>
            <rect x="42" y="29" width="4" height="4" rx="0.5"/>
            <rect x="48" y="29" width="4" height="4" rx="0.5"/>
            <rect x="54" y="29" width="4" height="4" rx="0.5"/>
            <!-- middle rows -->
            <rect x="5"  y="42" width="4" height="4" rx="0.5"/>
            <rect x="11" y="42" width="4" height="4" rx="0.5"/>
            <rect x="17" y="42" width="4" height="4" rx="0.5"/>
            <rect x="23" y="42" width="4" height="4" rx="0.5"/>
            <rect x="29" y="42" width="4" height="4" rx="0.5"/>
            <rect x="42" y="42" width="4" height="4" rx="0.5"/>
            <rect x="48" y="42" width="4" height="4" rx="0.5"/>
            <rect x="54" y="42" width="4" height="4" rx="0.5"/>
            <rect x="60" y="42" width="4" height="4" rx="0.5"/>
            <rect x="66" y="42" width="4" height="4" rx="0.5"/>
            <rect x="72" y="42" width="4" height="4" rx="0.5"/>
            <rect x="78" y="42" width="4" height="4" rx="0.5"/>
            <rect x="84" y="42" width="4" height="4" rx="0.5"/>
            <rect x="90" y="42" width="4" height="4" rx="0.5"/>
            <rect x="5"  y="48" width="4" height="4" rx="0.5"/>
            <rect x="17" y="48" width="4" height="4" rx="0.5"/>
            <rect x="29" y="48" width="4" height="4" rx="0.5"/>
            <rect x="42" y="48" width="4" height="4" rx="0.5"/>
            <rect x="60" y="48" width="4" height="4" rx="0.5"/>
            <rect x="72" y="48" width="4" height="4" rx="0.5"/>
            <rect x="84" y="48" width="4" height="4" rx="0.5"/>
            <rect x="5"  y="54" width="4" height="4" rx="0.5"/>
            <rect x="11" y="54" width="4" height="4" rx="0.5"/>
            <rect x="23" y="54" width="4" height="4" rx="0.5"/>
            <rect x="29" y="54" width="4" height="4" rx="0.5"/>
            <rect x="48" y="54" width="4" height="4" rx="0.5"/>
            <rect x="54" y="54" width="4" height="4" rx="0.5"/>
            <rect x="66" y="54" width="4" height="4" rx="0.5"/>
            <rect x="78" y="54" width="4" height="4" rx="0.5"/>
            <rect x="90" y="54" width="4" height="4" rx="0.5"/>
            <!-- bottom rows -->
            <rect x="42" y="66" width="4" height="4" rx="0.5"/>
            <rect x="54" y="66" width="4" height="4" rx="0.5"/>
            <rect x="60" y="66" width="4" height="4" rx="0.5"/>
            <rect x="72" y="66" width="4" height="4" rx="0.5"/>
            <rect x="84" y="66" width="4" height="4" rx="0.5"/>
            <rect x="42" y="72" width="4" height="4" rx="0.5"/>
            <rect x="48" y="72" width="4" height="4" rx="0.5"/>
            <rect x="60" y="72" width="4" height="4" rx="0.5"/>
            <rect x="66" y="72" width="4" height="4" rx="0.5"/>
            <rect x="78" y="72" width="4" height="4" rx="0.5"/>
            <rect x="90" y="72" width="4" height="4" rx="0.5"/>
            <rect x="42" y="78" width="4" height="4" rx="0.5"/>
            <rect x="54" y="78" width="4" height="4" rx="0.5"/>
            <rect x="66" y="78" width="4" height="4" rx="0.5"/>
            <rect x="84" y="78" width="4" height="4" rx="0.5"/>
            <rect x="42" y="84" width="4" height="4" rx="0.5"/>
            <rect x="48" y="84" width="4" height="4" rx="0.5"/>
            <rect x="60" y="84" width="4" height="4" rx="0.5"/>
            <rect x="72" y="84" width="4" height="4" rx="0.5"/>
            <rect x="90" y="84" width="4" height="4" rx="0.5"/>
          </g>
        </svg>
        <p class="upi-qr-note">
          <!-- TODO: Replace SVG placeholder with <canvas id="upi-qr-canvas"> + qrcode.js -->
          Real QR generated after backend integration
        </p>
      </div>

      <div class="upi-link-copy">
        <label for="upi-link-input">Or copy UPI string manually</label>
        <div class="upi-link-row">
          <input id="upi-link-input" type="text" readonly value="${upiLink}" />
          <button id="upi-copy-btn" class="btn-copy">Copy</button>
        </div>
      </div>

      <p class="upi-confirm-note">
        Once payment is done, tap <strong>Back</strong> to confirm your order.
      </p>

      <!-- TODO: Verify payment status via backend webhook — do not trust client-side confirmation -->
      <button class="btn-primary upi-paid-btn" id="upi-paid-btn">
        I've completed the payment
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('visible'));

  // Close handlers
  const close = () => {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.upi-qr-close').addEventListener('click', close);
  modal.querySelector('.upi-qr-backdrop').addEventListener('click', close);

  // Copy button
  const copyBtn = modal.querySelector('#upi-copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(upiLink).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    }).catch(() => {
      // Fallback for older browsers
      const input = modal.querySelector('#upi-link-input');
      input.select();
      document.execCommand('copy');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  });

  // "I've paid" button — fires payment-complete event for customer.js to handle
  modal.querySelector('#upi-paid-btn').addEventListener('click', () => {
    close();
    // TODO: Verify payment status via backend webhook before confirming order
    document.dispatchEvent(new CustomEvent('upi:paymentComplete', {
      detail: { upiLink, triggeredBy }
    }));
    if (window.DB) window.DB.logEvent('upi_payment_claimed', { triggeredBy });
  });
}

/* ─── Render UPI app buttons ──────────────────────────────────────────────── */

/**
 * Render the row of UPI app buttons inside a given container element.
 * @param {HTMLElement} container
 * @param {string} upiLink — the pre-built upi:// link
 */
function renderUPIAppButtons(container, upiLink) {
  container.innerHTML = '';

  UPI_APPS.forEach(app => {
    const btn = document.createElement('button');
    btn.className   = 'upi-app-btn';
    btn.dataset.app = app.id;
    btn.setAttribute('aria-label', `Pay with ${app.name}`);
    btn.innerHTML   = `<span class="upi-app-emoji">${app.emoji}</span><span>${app.name}</span>`;
    btn.style.setProperty('--app-color', app.color);

    btn.addEventListener('click', () => launchUPI(upiLink, app.id));
    container.appendChild(btn);
  });
}

/* ─── Export to window ────────────────────────────────────────────────────── */
window.UPI = {
  buildUPILink,
  launchUPI,
  showQRFallback,
  renderUPIAppButtons,
  UPI_APPS
};