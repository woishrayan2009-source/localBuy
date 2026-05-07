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
    id:     'gpay',
    name:   'GPay',
    scheme: 'tez://',        // Google Pay deep link prefix
    color:  '#4285F4',
    emoji:  '🅖',
    // Android intent for Google Pay
    intent: (link) => link.replace('upi://', 'tez://upi/')
  },
  {
    id:     'phonepe',
    name:   'PhonePe',
    scheme: 'phonepe://',
    color:  '#5F259F',
    emoji:  '🅟',
    intent: (link) => link.replace('upi://', 'phonepe://')
  },
  {
    id:     'paytm',
    name:   'Paytm',
    scheme: 'paytmmp://',
    color:  '#00BAF2',
    emoji:  '🅟',
    intent: (link) => link.replace('upi://', 'paytmmp://')
  },
  {
    id:     'bhim',
    name:   'BHIM',
    scheme: 'upi://',
    color:  '#002970',
    emoji:  '🇮🇳',
    intent: (link) => link   // BHIM uses standard upi:// scheme
  },
  {
    id:     'other',
    name:   'Other UPI',
    scheme: 'upi://',
    color:  '#0f5c3a',
    emoji:  '💳',
    intent: (link) => link
  }
];

/* ─── Placeholder VPA guard ───────────────────────────────────────────────── */

/**
 * Known placeholder / demo VPA patterns that must never be sent to a real app.
 * Add any other test addresses your backend uses.
 */
const PLACEHOLDER_VPA_PATTERNS = [
  /^demo@/i,
  /^test@/i,
  /^example@/i,
  /^placeholder@/i,
  /^merchant@yourupi/i,
  /^$/ // empty string
];

/**
 * Returns true when the VPA looks like a real address.
 * A valid VPA must be "localpart@psp" — non-empty on both sides of "@".
 * @param {string} vpa
 * @returns {boolean}
 */
function isValidVPA(vpa) {
  if (!vpa || typeof vpa !== 'string') return false;
  if (PLACEHOLDER_VPA_PATTERNS.some(re => re.test(vpa.trim()))) return false;
  // Basic structural check: contains exactly one "@" with non-empty parts
  const parts = vpa.trim().split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/* ─── Core link builder ───────────────────────────────────────────────────── */

/**
 * Build a standard UPI deep-link string.
 *
 * Generates: upi://pay?pa={vpa}&pn={name}&am={amount}&cu=INR&tn={note}
 *
 * @param {{ pa: string, pn: string, am: number|string, tn: string, cu?: string }} params
 * @returns {string} UPI intent URL
 *
 * TODO: In production, fetch signed payment URL from backend:
 *   const res = await fetch('/api/upi/intent', {
 *     method: 'POST',
 *     body: JSON.stringify({ orderId, amount })
 *   });
 *   const { upiUrl } = await res.json();
 *   return upiUrl;
 */
function buildUPILink({ pa, pn, am, tn, cu = 'INR' }) {
  if (!isValidVPA(pa)) {
    throw new Error(
      `[UPI] Invalid or placeholder VPA: "${pa}". ` +
      'Resolve a real VPA server-side before building a payment link.'
    );
  }

  // URLSearchParams encodes spaces as "+" — UPI spec expects "%20", so
  // we convert after building the string.
  const params = new URLSearchParams({
    pa: pa.trim(),
    pn: pn,
    am: Number(am).toFixed(2),  // always 2 decimal places
    cu: cu,
    tn: tn
  });

  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/* ─── App launcher ────────────────────────────────────────────────────────── */

/**
 * Attempt to launch a UPI app via deep link.
 * Falls back to QR modal if the app is not installed or the redirect fails.
 *
 * Guards against placeholder VPAs before any navigation occurs.
 *
 * @param {string} upiLink — a fully built upi://pay?... deep link
 * @param {string} [appId] — which app to try (id from UPI_APPS)
 */
function launchUPI(upiLink, appId = 'other') {
  // ── Guard: reject placeholder / malformed VPAs ──────────────────────────
  let pa = '';
  try {
    // upiLink is "upi://pay?pa=...&..." — treat the query part as a URL to parse
    const queryString = upiLink.replace(/^upi:\/\/pay\?/, '');
    pa = new URLSearchParams(queryString).get('pa') || '';
  } catch (_) { /* ignore parse errors; isValidVPA('') will catch it */ }

  if (!isValidVPA(pa)) {
    console.error(`[UPI] launchUPI blocked — invalid or placeholder VPA: "${pa}"`);
    showQRFallback(upiLink, appId); // show fallback so the user isn't stranded
    return;
  }

  const app    = UPI_APPS.find(a => a.id === appId) || UPI_APPS[4];
  const intent = app.intent(upiLink);

  const start  = Date.now();

  // On Android this will hand off to the UPI app if installed.
  window.location.href = intent;

  // If the user is still on the page after 1.5 s the app wasn't found.
  setTimeout(() => {
    if (Date.now() - start < 2000) {
      showQRFallback(upiLink, appId);
    }
  }, 1500);

  // Log (no PII — only event name and app ID)
  if (window.DB) window.DB.logEvent('upi_launch_attempt', { appId });
}

/* ─── Order-status helper ─────────────────────────────────────────────────── */

/**
 * Advance the current order to "payment_claimed" status.
 *
 * TODO: Replace with a real backend call, e.g.:
 *   await fetch('/api/orders/:id/status', {
 *     method: 'PATCH',
 *     body: JSON.stringify({ status: 'payment_claimed', upiRef: triggeredBy })
 *   });
 *
 * The server-side webhook (from the UPI PSP) is the authoritative confirmation;
 * this client call only marks the order as "pending verification".
 *
 * @param {{ upiLink: string, triggeredBy: string }} detail
 */
function advanceOrderStatus({ upiLink, triggeredBy }) {
  // Dispatch a domain event that customer.js (or any other module) can handle.
  document.dispatchEvent(
    new CustomEvent('upi:paymentComplete', {
      bubbles: true,
      detail: {
        status:      'payment_claimed', // NOT yet confirmed — awaiting webhook
        upiLink,
        triggeredBy,
        timestamp:   Date.now()
      }
    })
  );

  // Optimistic UI: if your order-state machine is on window.OrderManager, call it.
  if (window.OrderManager && typeof window.OrderManager.setStatus === 'function') {
    window.OrderManager.setStatus('payment_claimed');
  }

  if (window.DB) {
    window.DB.logEvent('upi_payment_claimed', { triggeredBy });
  }
}

/* ─── QR fallback modal ───────────────────────────────────────────────────── */

/**
 * Load qrcode.js from CDN once, then invoke a callback.
 * Subsequent calls reuse the already-loaded script.
 *
 * CDN: https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
 * @param {() => void} cb
 */
function loadQRCodeLib(cb) {
  if (window.QRCode) { cb(); return; }

  const script = document.createElement('script');
  script.src   = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  script.async = true;
  script.onload  = cb;
  script.onerror = () => {
    console.warn('[UPI] qrcode.js failed to load — QR canvas will be empty.');
    cb(); // still open the modal; the copy-link fallback remains usable
  };
  document.head.appendChild(script);
}

/**
 * Show a modal with a real QR code (via qrcode.js) and a copyable UPI string.
 *
 * @param {string} upiLink      — the upi://pay?... deep link to encode
 * @param {string} [triggeredBy] — which app button was clicked (analytics only)
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

  // Escape the upiLink for safe injection into the input value attribute
  const safeLink = upiLink.replace(/"/g, '&quot;');

  modal.innerHTML = `
    <div class="upi-qr-backdrop"></div>
    <div class="upi-qr-sheet">
      <div class="upi-qr-header">
        <h3 id="upi-qr-title">Pay via UPI</h3>
        <button class="upi-qr-close" aria-label="Close">✕</button>
      </div>

      <p class="upi-qr-sub">Scan this QR with any UPI app on your phone</p>

      <!-- qrcode.js renders a canvas + img inside this div -->
      <div id="upi-qr-canvas-wrap" class="upi-qr-placeholder" aria-label="UPI QR code">
        <p class="upi-qr-loading">Generating QR…</p>
      </div>

      <div class="upi-link-copy">
        <label for="upi-link-input">Or copy UPI string manually</label>
        <div class="upi-link-row">
          <input id="upi-link-input" type="text" readonly value="${safeLink}" />
          <button id="upi-copy-btn" class="btn-copy">Copy</button>
        </div>
      </div>

      <p class="upi-confirm-note">
        Once payment is done, tap <strong>Back</strong> to confirm your order.
      </p>

      <button class="btn-primary upi-paid-btn" id="upi-paid-btn">
        I've completed the payment
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('visible'));

  /* ── Render real QR via qrcode.js ─────────────────────────────────────── */
  loadQRCodeLib(() => {
    const wrap = document.getElementById('upi-qr-canvas-wrap');
    if (!wrap) return; // modal was closed before lib loaded

    // Remove the "Generating…" placeholder text
    wrap.innerHTML = '';

    if (window.QRCode) {
      try {
        new window.QRCode(wrap, {
          text:          upiLink,
          width:         220,
          height:        220,
          colorDark:     '#0f5c3a',
          colorLight:    '#f0faf4',
          correctLevel:  window.QRCode.CorrectLevel.M
        });
      } catch (err) {
        console.error('[UPI] QRCode render failed:', err);
        wrap.innerHTML = '<p class="upi-qr-note">QR unavailable — use the copy link below.</p>';
      }
    } else {
      wrap.innerHTML = '<p class="upi-qr-note">QR unavailable — use the copy link below.</p>';
    }
  });

  /* ── Close handlers ───────────────────────────────────────────────────── */
  const close = () => {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.upi-qr-close').addEventListener('click', close);
  modal.querySelector('.upi-qr-backdrop').addEventListener('click', close);

  /* ── Copy button ──────────────────────────────────────────────────────── */
  const copyBtn = modal.querySelector('#upi-copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(upiLink)
      .then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      })
      .catch(() => {
        // Fallback for older / restricted browsers
        const input = modal.querySelector('#upi-link-input');
        input.select();
        document.execCommand('copy'); // eslint-disable-line no-restricted-globals
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
  });

  /* ── "I've paid" button ───────────────────────────────────────────────── */
  modal.querySelector('#upi-paid-btn').addEventListener('click', () => {
    close();
    // Advance order status and notify other modules via CustomEvent.
    // NOTE: This is an optimistic update only.
    //       The authoritative confirmation comes from the UPI PSP webhook.
    advanceOrderStatus({ upiLink, triggeredBy });
  });
}

/* ─── Render UPI app buttons ──────────────────────────────────────────────── */

/**
 * Render the row of UPI app buttons inside a given container element.
 * @param {HTMLElement} container
 * @param {string} upiLink — a pre-built upi://pay?... link
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
  advanceOrderStatus,
  isValidVPA,
  UPI_APPS
};