/* ============================================================
   LocalBuy — upi.js
   UPI deep-link builder and QR fallback for payment.
   ============================================================ */

/**
 * Build a UPI deep-link URI.
 * SECURITY: In production, the `pa` (payee VPA) must NEVER be
 * embedded in frontend JS. It must be resolved server-side and
 * injected into the payment intent via a signed token.
 * TODO: UPI VPA must be resolved server-side; never expose in frontend JS
 *
 * @param {Object} opts
 * @param {string} opts.pa  - Payee VPA (UPI ID) — server-side only in production
 * @param {string} opts.pn  - Payee name
 * @param {number} opts.am  - Amount in INR
 * @param {string} opts.tn  - Transaction note
 * @param {string} opts.cu  - Currency (default: 'INR')
 * @returns {string} UPI deep link URI
 */
function buildUPILink({ pa, pn, am, tn, cu = 'INR' }) {
  if (!pa || !pn || !am) {
    console.error('[UPI] Missing required fields: pa, pn, am');
    return '';
  }
  return (
    `upi://pay` +
    `?pa=${encodeURIComponent(pa)}` +
    `&pn=${encodeURIComponent(pn)}` +
    `&am=${am}` +
    `&tn=${encodeURIComponent(tn)}` +
    `&cu=${cu}`
  );
}

/**
 * Launch a UPI deep link.
 * On mobile: tries to open the UPI app directly.
 * On desktop / unsupported: shows QR fallback after 1.5s.
 *
 * @param {string} link - UPI deep link URI from buildUPILink()
 * @param {string} containerId - DOM element ID to inject QR fallback into
 */
function launchUPI(link, containerId) {
  if (!link) return;

  const start = Date.now();

  // Attempt to open UPI app via location change
  window.location.href = link;

  // If the page is still visible after 1.5s, the UPI app didn't open
  setTimeout(() => {
    const elapsed = Date.now() - start;
    if (elapsed < 2500) {
      // Browser didn't switch to UPI app — show QR fallback
      showQRFallback(link, containerId);
    }
  }, 1500);
}

/**
 * Show a QR code fallback when deep link fails.
 * Currently renders a decorative placeholder.
 * TODO: Replace with qrcode.js or a similar QR generation library.
 *       e.g., import QRCode from 'qrcode.js'
 *             QRCode.toCanvas(canvasEl, upiLink, { width: 160 })
 *
 * @param {string} upiLink - Full UPI URI to encode in QR
 * @param {string} containerId - DOM element to inject fallback into
 */
function showQRFallback(upiLink, containerId) {
  const container = document.getElementById(containerId || 'qr-fallback-container');
  if (!container) return;

  // Build a readable UPI string for manual copy
  const upiString = decodeURIComponent(upiLink.replace('upi://pay?', '').replace(/&/g, '\n'));

  container.innerHTML = `
    <div class="qr-fallback">
      <div class="qr-box" role="img" aria-label="QR code placeholder">
        <div class="qr-corner tl"></div>
        <div class="qr-corner tr"></div>
        <div class="qr-corner bl"></div>
        <!-- TODO: Replace with actual QR canvas from qrcode.js -->
        <div style="
          position:absolute;inset:12px;
          background: repeating-linear-gradient(
            45deg,
            #5f259f 0px, #5f259f 3px,
            transparent 3px, transparent 9px
          );
          opacity:0.25;
          border-radius:4px;
        "></div>
        <span style="
          position:absolute;inset:0;display:flex;align-items:center;
          justify-content:center;font-size:11px;color:#5f259f;font-weight:700;
          text-align:center;line-height:1.3;padding:8px;
        ">Scan with<br>any UPI app</span>
      </div>
      <p style="font-size:12px;color:#6b7280;margin-bottom:8px;">
        Or copy UPI ID manually:
      </p>
      <button onclick="copyUPILink('${upiLink}')" class="btn btn-secondary" style="font-size:12px;min-height:36px;padding:0.4rem 1rem;">
        Copy UPI link
      </button>
    </div>
  `;

  container.style.display = 'block';
}

/**
 * Copy UPI link to clipboard.
 * @param {string} link
 */
async function copyUPILink(link) {
  try {
    await navigator.clipboard.writeText(link);
    showToast('UPI link copied!');
  } catch {
    // Fallback for older Android browsers
    const el = document.createElement('input');
    el.value = link;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('UPI link copied!');
  }
}

/**
 * Known UPI app packages for deep linking on Android.
 * Each entry has a display name and the UPI intent prefix.
 */
const UPI_APPS = [
  { id: 'gpay',    name: 'GPay',    intent: 'tez://upi/pay' },
  { id: 'phonepe', name: 'PhonePe', intent: 'phonepe://pay' },
  { id: 'paytm',   name: 'Paytm',   intent: 'paytmmp://pay' },
  { id: 'bhim',    name: 'BHIM',    intent: 'bhim://pay' },
  { id: 'other',   name: 'Other UPI', intent: 'upi://pay' }
];