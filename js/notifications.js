/**
 * notifications.js — LocalBuy Guwahati
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all notification surfaces for LocalBuy:
 *   • Web Push (service worker push events via VAPID)
 *   • Foreground audio alerts (shopkeeper dashboard new-order tone)
 *   • In-app toast notifications (custom, no alert() ever used)
 *   • Permission request + subscription lifecycle
 *   • Multilingual notification payloads (EN / HI / BN / AS)
 *   • Vibration patterns for mobile shopkeeper alerts
 *
 * Dependencies:
 *   • sw-register.js  — service worker must be registered before push subscribe
 *   • i18n.js         — for current language code (i18n.getLang())
 *   • db-bridge.js    — for sending push subscription to backend
 *
 * TODO: Replace all stub comments with real Firebase / backend SDK calls
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ─── VAPID Public Key ────────────────────────────────────────────────────────
// TODO: Replace with your real VAPID public key generated via:
//   npx web-push generate-vapid-keys
// NEVER put the VAPID private key here — server-side only.
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';

// ─── Audio state ─────────────────────────────────────────────────────────────
let _audioElement = null;

// ─── Autoplay gate (FIX A1) ──────────────────────────────────────────────────
// Browser autoplay policy blocks audio that is not triggered by a user gesture.
// _shiftStarted is set to true only when the shopkeeper clicks "Start Shift",
// which constitutes the required user-gesture unlock for that browsing session.
// Audio play calls are no-ops until this flag is true.
let _shiftStarted = false;

// Tracks the active push subscription
let _pushSubscription = null;

// ─── Toast queue (prevents toast stack overflow) ──────────────────────────────
const _toastQueue = [];
let _toastActive = false;

// ─────────────────────────────────────────────────────────────────────────────
// 1. INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

function init(audioEl = null) {
  if (audioEl instanceof HTMLAudioElement) {
    _audioElement = audioEl;
    console.log('[Notifications] Audio element registered.');
  }

  const cachedPermission = localStorage.getItem('lb_push_permission');
  if (cachedPermission === 'granted') {
    console.log('[Notifications] Push previously granted — will subscribe on demand.');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', _handleSWMessage);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1a. SHIFT START / STOP  (FIX A1 — autoplay gate)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * startShift()
 * Must be called inside a click handler for the "Start Shift" button.
 * This satisfies browser autoplay policy by anchoring audio permission to a
 * direct user gesture. Also pre-unlocks the HTML audio element if present.
 *
 * Usage (in your dashboard JS):
 *   document.getElementById('btn-start-shift')
 *     .addEventListener('click', () => Notifications.startShift());
 */
function startShift() {
  _shiftStarted = true;

  // Pre-unlock the HTMLAudioElement during the user gesture so that
  // subsequent programmatic play() calls (on push / SW message) are allowed.
  if (_audioElement) {
    _audioElement.volume = 0;
    _audioElement.play()
      .then(() => {
        _audioElement.pause();
        _audioElement.currentTime = 0;
        _audioElement.volume = 1;
        console.log('[Notifications] Audio element pre-unlocked for autoplay.');
      })
      .catch(() => {
        // Silently ignore — element may have no src yet; unlock still counts.
        _audioElement.volume = 1;
      });
  }

  console.log('[Notifications] Shift started — audio alerts enabled.');
}

/**
 * stopShift()
 * Revokes the audio gate when the shopkeeper ends their shift.
 */
function stopShift() {
  _shiftStarted = false;
  stopForegroundAlert();
  console.log('[Notifications] Shift ended — audio alerts disabled.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PUSH PERMISSION + SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

async function requestPushPermission() {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Web Notifications not supported in this browser.');
    return false;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Notifications] Push API not supported in this browser.');
    return false;
  }

  if (Notification.permission === 'granted') {
    await _ensurePushSubscription();
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[Notifications] Push permission previously denied by user.');
    return false;
  }

  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    permission = await new Promise(resolve => Notification.requestPermission(resolve));
  }

  localStorage.setItem('lb_push_permission', permission);

  if (permission === 'granted') {
    console.log('[Notifications] Push permission granted.');
    await _ensurePushSubscription();
    return true;
  }

  console.log('[Notifications] Push permission not granted:', permission);
  return false;
}

async function _ensurePushSubscription() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      _pushSubscription = existing;
      console.log('[Notifications] Re-using existing push subscription.');
      return;
    }

    const appServerKey = _urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey
    });

    _pushSubscription = subscription;
    console.log('[Notifications] New push subscription created:', subscription.endpoint);
    console.log('[Notifications][STUB] Would send subscription to backend:', subscription.toJSON());

  } catch (err) {
    console.error('[Notifications] Failed to create push subscription:', err.message);
    if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
      console.error('[Notifications] ⚠️  VAPID_PUBLIC_KEY is still a placeholder. Set a real key to enable push.');
    }
  }
}

async function unsubscribePush() {
  if (!_pushSubscription) return;
  try {
    await _pushSubscription.unsubscribe();
    _pushSubscription = null;
    localStorage.removeItem('lb_push_permission');
    console.log('[Notifications] Unsubscribed from push.');
  } catch (err) {
    console.error('[Notifications] Failed to unsubscribe:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FOREGROUND AUDIO ALERTS (shopkeeper dashboard)
//    FIX A1 — gated behind _shiftStarted
//    FIX A2 — Web Audio API fallback when MP3 returns 404
// ─────────────────────────────────────────────────────────────────────────────

/**
 * playForegroundAlert(sound)
 *
 * FIX A1: Returns immediately if _shiftStarted is false, enforcing the
 *         user-gesture autoplay gate. Call startShift() first.
 *
 * FIX A2: Attaches a one-shot 'error' listener to the HTMLAudioElement.
 *         If the browser fires an error (e.g. HTTP 404 on the MP3), the
 *         listener fires _playWebAudioFallback() which synthesises a
 *         two-tone beep entirely in-browser via the Web Audio API.
 *         No external assets are required for the fallback.
 *
 * @param {'new-order'|'order-ready'} sound
 */
function playForegroundAlert(sound = 'new-order') {
  // ── FIX A1 ──────────────────────────────────────────────────────────────
  if (!_shiftStarted) {
    console.warn('[Notifications] Audio blocked — shift not started. Call startShift() on user gesture.');
    return;
  }

  if (!_audioElement) {
    _audioElement = document.getElementById('audio-unlock');
  }

  const srcMap = {
    'new-order':   'assets/sounds/new-order.mp3',
    'order-ready': 'assets/sounds/order-ready.mp3'
  };

  const src = srcMap[sound] || srcMap['new-order'];

  // ── FIX A2 — attach fallback before setting src ──────────────────────────
  if (_audioElement) {
    // Remove any previous error listener to avoid duplicate handlers.
    _audioElement.removeEventListener('error', _audioElement.__lbErrorHandler);

    const fallbackTone = sound === 'order-ready' ? 'order-ready' : 'new-order';
    _audioElement.__lbErrorHandler = function _onAudioError() {
      console.warn('[Notifications] MP3 load failed — falling back to Web Audio API beep.');
      _playWebAudioFallback(fallbackTone);
    };
    _audioElement.addEventListener('error', _audioElement.__lbErrorHandler, { once: true });

    _audioElement.src = src;
    _audioElement.currentTime = 0;

    _audioElement.play().catch(err => {
      console.warn('[Notifications] Audio play() blocked:', err.message);
      // play() rejection is separate from a network/decode error.
      // The 'error' event covers 404/decode; play() rejection (DOMException)
      // is handled here as a secondary fallback.
      _playWebAudioFallback(fallbackTone);
    });

  } else {
    // No HTMLAudioElement available at all — go straight to Web Audio.
    console.warn('[Notifications] No audio element found — using Web Audio API fallback.');
    _playWebAudioFallback(sound);
  }
}

/**
 * _playWebAudioFallback(type)
 * Synthesises a short alert tone via the Web Audio API.
 * No network request, no external file — works entirely offline.
 *
 * Tone design:
 *   'new-order'   → two ascending tones (440 Hz → 660 Hz), 0.18 s each
 *   'order-ready' → three quick blips at 880 Hz, 0.1 s each
 *
 * @param {'new-order'|'order-ready'} type
 */
function _playWebAudioFallback(type = 'new-order') {
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
    console.warn('[Notifications] Web Audio API not supported — silent fallback.');
    return;
  }

  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  /**
   * _beep(freq, startTime, duration, gain)
   * Schedules a single sine-wave tone on the AudioContext timeline.
   */
  function _beep(freq, startTime, duration, gain = 0.5) {
    const osc     = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type            = 'sine';
    osc.frequency.value = freq;

    gainNode.gain.setValueAtTime(gain, startTime);
    // Short fade-out to avoid a click at tone end
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  const now = ctx.currentTime;

  if (type === 'order-ready') {
    // Three quick blips at 880 Hz
    _beep(880, now,        0.10);
    _beep(880, now + 0.15, 0.10);
    _beep(880, now + 0.30, 0.10);
  } else {
    // Two ascending tones: 440 Hz then 660 Hz (new-order default)
    _beep(440, now,        0.18);
    _beep(660, now + 0.22, 0.18);
  }

  // Close the AudioContext after all tones finish to release resources.
  const totalDuration = type === 'order-ready' ? 0.45 : 0.50;
  setTimeout(() => ctx.close(), (totalDuration + 0.1) * 1000);
}

function stopForegroundAlert() {
  if (!_audioElement) return;
  _audioElement.pause();
  _audioElement.currentTime = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. VIBRATION
// ─────────────────────────────────────────────────────────────────────────────

function vibrateAlert(type = 'new-order', customPattern = null) {
  if (!('vibrate' in navigator)) {
    console.info('[Notifications] Vibration API not supported.');
    return;
  }

  const patterns = {
    'new-order':   [200, 100, 200, 100, 200],
    'order-ready': [400, 150, 400],
    'custom':      customPattern || [200]
  };

  const pattern = patterns[type] || patterns['new-order'];
  navigator.vibrate(pattern);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SCREEN FLASH ALERT (shopkeeper — new order visual cue)
// ─────────────────────────────────────────────────────────────────────────────

function screenFlash(color = 'rgba(255, 255, 255, 0.85)') {
  let flash = document.getElementById('lb-screen-flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.id = 'lb-screen-flash';
    Object.assign(flash.style, {
      position:        'fixed',
      inset:           '0',
      zIndex:          '99999',
      pointerEvents:   'none',
      opacity:         '0',
      transition:      'opacity 150ms ease-out',
      background:      color,
      willChange:      'opacity'
    });
    document.body.appendChild(flash);
  }

  requestAnimationFrame(() => {
    flash.style.opacity = '1';
    setTimeout(() => {
      flash.style.opacity = '0';
    }, 150);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FULL NEW-ORDER ALERT SEQUENCE (shopkeeper)
// ─────────────────────────────────────────────────────────────────────────────

function triggerNewOrderAlert(order) {
  const lang = _getCurrentLang();
  const payload = NOTIFICATION_PAYLOADS.newOrder(lang);

  playForegroundAlert('new-order');
  vibrateAlert('new-order');
  screenFlash();

  showToast({
    type:     'order',
    title:    payload.title,
    message:  payload.body,
    orderId:  order.id,
    duration: 8000,
    action: {
      label:   _getCurrentLang() === 'en' ? 'View' : payload.actionLabel || 'View',
      onClick: () => {
        if (window.ShopkeeperDashboard && typeof window.ShopkeeperDashboard.openOrder === 'function') {
          window.ShopkeeperDashboard.openOrder(order.id);
        }
      }
    }
  });

  if (document.visibilityState === 'hidden') {
    console.log('[Notifications] App backgrounded — push notification handled by SW.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. IN-APP TOAST NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

function showToast(opts = {}) {
  const {
    type     = 'info',
    title    = '',
    message  = '',
    orderId  = null,
    duration = 4000,
    action   = null
  } = opts;

  if (_toastActive) {
    _toastQueue.push(opts);
    return;
  }

  _toastActive = true;

  let container = document.getElementById('lb-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'lb-toast-container';
    Object.assign(container.style, {
      position:      'fixed',
      top:           '16px',
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        '100000',
      width:         'min(calc(100vw - 32px), 400px)',
      display:       'flex',
      flexDirection: 'column',
      gap:           '8px',
      pointerEvents: 'none'
    });
    document.body.appendChild(container);
  }

  const typeStyles = {
    order:   { borderColor: 'var(--color-amber, #d97706)',    icon: '🔔', bg: 'var(--color-amber-light, #fffbf0)' },
    success: { borderColor: 'var(--color-sage, #0f5c3a)',     icon: '✓',  bg: 'var(--color-sage-pale, #f0faf4)'  },
    warning: { borderColor: 'var(--color-amber, #d97706)',    icon: '⚠️', bg: 'var(--color-amber-light, #fffbf0)' },
    error:   { borderColor: 'var(--status-closed, #dc2626)',  icon: '✕',  bg: '#fff5f5'                           },
    info:    { borderColor: 'var(--color-muted, #6b7280)',    icon: 'ℹ',  bg: 'var(--color-surface, #f8f7f4)'    }
  };

  const style = typeStyles[type] || typeStyles.info;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');

  Object.assign(toast.style, {
    background:      style.bg,
    borderLeft:      `4px solid ${style.borderColor}`,
    borderRadius:    '10px',
    boxShadow:       '0 4px 24px rgba(17,24,39,0.14)',
    padding:         '14px 16px',
    display:         'flex',
    flexDirection:   'column',
    gap:             '4px',
    pointerEvents:   'auto',
    fontFamily:      '"DM Sans", sans-serif',
    opacity:         '0',
    transform:       'translateY(-12px)',
    transition:      'opacity 0.25s ease, transform 0.25s ease',
    cursor:          action ? 'pointer' : 'default'
  });

  toast.innerHTML = `
    <div style="display:flex; align-items:flex-start; gap:10px;">
      <span style="font-size:18px; flex-shrink:0; line-height:1.2;" aria-hidden="true">${style.icon}</span>
      <div style="flex:1; min-width:0;">
        ${title ? `<div style="font-weight:700; font-size:14px; color:var(--color-ink,#111827); line-height:1.3;">${_escapeHtml(title)}</div>` : ''}
        ${message ? `<div style="font-size:13px; color:var(--color-muted,#6b7280); margin-top:2px; line-height:1.4;">${_escapeHtml(message)}</div>` : ''}
        ${orderId ? `<div style="display:inline-block; margin-top:6px; font-family:monospace; font-size:12px; font-weight:700; background:var(--color-sage-light,#e8f5ee); color:var(--color-sage,#0f5c3a); padding:2px 8px; border-radius:4px;">${_escapeHtml(orderId)}</div>` : ''}
        ${action ? `<button data-toast-action style="margin-top:8px; background:none; border:none; padding:0; font:inherit; font-size:13px; font-weight:700; color:${style.borderColor}; cursor:pointer; text-decoration:underline;">${_escapeHtml(action.label)}</button>` : ''}
      </div>
      <button data-toast-close aria-label="Dismiss notification" style="flex-shrink:0; background:none; border:none; cursor:pointer; font-size:16px; color:var(--color-muted,#6b7280); line-height:1; padding:2px;">✕</button>
    </div>
  `;

  const closeBtn = toast.querySelector('[data-toast-close]');
  const closeToast = () => _dismissToast(toast, container);
  closeBtn.addEventListener('click', closeToast);

  if (action) {
    const actionBtn = toast.querySelector('[data-toast-action]');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      action.onClick();
      closeToast();
    });
  }

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  let dismissTimer = null;
  if (duration > 0) {
    dismissTimer = setTimeout(closeToast, duration);
  }

  toast.addEventListener('mouseenter', () => {
    if (dismissTimer) clearTimeout(dismissTimer);
  });
  toast.addEventListener('mouseleave', () => {
    if (duration > 0) {
      dismissTimer = setTimeout(closeToast, duration);
    }
  });
}

function _dismissToast(toast, container) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-12px)';
  setTimeout(() => {
    if (toast.parentNode === container) {
      container.removeChild(toast);
    }
    _toastActive = false;
    if (_toastQueue.length > 0) {
      const next = _toastQueue.shift();
      showToast(next);
    }
  }, 250);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. NOTIFICATION PAYLOADS (multilingual)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NOTIFICATION_PAYLOADS
 * Multilingual notification content for every notification type.
 *
 * FIX M7: newOrder() previously had a self-referencing fallback
 * `|| NOTIFICATION_PAYLOADS.newOrder('en')` which caused a ReferenceError
 * because NOTIFICATION_PAYLOADS was not yet defined when the expression
 * evaluated. Fixed by using a local `payloads` object with a safe fallback.
 */
const NOTIFICATION_PAYLOADS = {

  /**
   * newOrder — shopkeeper receives a new customer order
   *
   * FIX M7: Replaced self-referencing fallback with local variable fallback.
   * The inner `payloads` object is fully defined before `payloads[lang]` is
   * accessed, so there is no ReferenceError risk regardless of evaluation order.
   *
   * @param {string} lang
   * @returns {{ title, body, actionLabel, tag }}
   */
  newOrder: (lang = 'en') => {
    const payloads = {
      en: {
        title:       '🔔 New Order!',
        body:        'A customer just placed an order. Tap to review.',
        actionLabel: 'View Order',
        tag:         'lb-new-order'
      },
      hi: {
        title:       '🔔 नया ऑर्डर!',
        body:        'एक ग्राहक ने अभी ऑर्डर दिया। देखने के लिए टैप करें।',
        actionLabel: 'ऑर्डर देखें',
        tag:         'lb-new-order'
      },
      bn: {
        title:       '🔔 নতুন অর্ডার!',
        body:        'একজন কাস্টমার অর্ডার দিয়েছেন। দেখতে ট্যাপ করুন।',
        actionLabel: 'অর্ডার দেখুন',
        tag:         'lb-new-order'
      },
      as: {
        title:       '🔔 নতুন অৰ্ডাৰ!',
        body:        'এগৰাকী গ্ৰাহকে অৰ্ডাৰ দিলে। চাবলৈ টেপ কৰক।',
        actionLabel: 'অৰ্ডাৰ চাওক',
        tag:         'lb-new-order'
      }
    };
    // Safe fallback — payloads is fully constructed before this line runs.
    return payloads[lang] || payloads['en'];
  },

  /**
   * orderReady — customer's order is packed and ready for pickup
   * @param {string} lang
   */
  orderReady: (lang = 'en') => ({
    en: {
      title:       '✅ Order Ready!',
      body:        'Walk in and collect your items. Show your order code at the counter.',
      actionLabel: 'View Order Code',
      tag:         'lb-order-ready'
    },
    hi: {
      title:       '✅ ऑर्डर तैयार है!',
      body:        'दुकान पर आएं और सामान लें। काउंटर पर ऑर्डर कोड दिखाएं।',
      actionLabel: 'ऑर्डर कोड देखें',
      tag:         'lb-order-ready'
    },
    bn: {
      title:       '✅ অর্ডার রেডি!',
      body:        'দোকানে এসে মাল নিয়ে যান। কাউন্টারে অর্ডার কোড দেখান।',
      actionLabel: 'অর্ডার কোড দেখুন',
      tag:         'lb-order-ready'
    },
    as: {
      title:       '✅ অৰ্ডাৰ প্ৰস্তুত!',
      body:        'দোকানলৈ আহি সামগ্ৰী লওক। কাউণ্টাৰত অৰ্ডাৰ ক\'ড দেখুৱাওক।',
      actionLabel: 'অৰ্ডাৰ ক\'ড চাওক',
      tag:         'lb-order-ready'
    }
  }[lang]),

  /**
   * orderQuoted — shopkeeper has confirmed the bill and sent a quote
   * @param {string} lang
   * @param {string} amount - Formatted amount e.g. '₹347'
   */
  orderQuoted: (lang = 'en', amount = '') => ({
    en: {
      title:       '📋 Quote Received',
      body:        `Your total is ${amount}. Tap to accept or cancel.`,
      actionLabel: 'Review Quote',
      tag:         'lb-order-quoted'
    },
    hi: {
      title:       '📋 कोटेशन मिला',
      body:        `आपका कुल बिल ${amount} है। स्वीकार या रद्द करने के लिए टैप करें।`,
      actionLabel: 'कोटेशन देखें',
      tag:         'lb-order-quoted'
    },
    bn: {
      title:       '📋 কোটেশন পেয়েছেন',
      body:        `মোট বিল ${amount}। গ্রহণ বা বাতিল করতে ট্যাপ করুন।`,
      actionLabel: 'কোটেশন দেখুন',
      tag:         'lb-order-quoted'
    },
    as: {
      title:       '📋 কোটেচন পালে',
      body:        `মুঠ বিল ${amount}। গ্ৰহণ বা বাতিল কৰিবলৈ টেপ কৰক।`,
      actionLabel: 'কোটেচন চাওক',
      tag:         'lb-order-quoted'
    }
  }[lang]),

  /**
   * orderCancelled — order was cancelled (either party)
   * @param {string} lang
   * @param {'shopkeeper'|'customer'} cancelledBy
   */
  orderCancelled: (lang = 'en', cancelledBy = 'shopkeeper') => {
    const byShop = cancelledBy === 'shopkeeper';
    return ({
      en: {
        title: '❌ Order Cancelled',
        body:  byShop
          ? 'The shopkeeper has cancelled your order. You have not been charged.'
          : 'You cancelled this order.',
        tag: 'lb-order-cancelled'
      },
      hi: {
        title: '❌ ऑर्डर रद्द',
        body:  byShop
          ? 'दुकानदार ने आपका ऑर्डर रद्द कर दिया। कोई भुगतान नहीं लिया गया।'
          : 'आपने यह ऑर्डर रद्द किया।',
        tag: 'lb-order-cancelled'
      },
      bn: {
        title: '❌ অর্ডার বাতিল',
        body:  byShop
          ? 'দোকানদার আপনার অর্ডার বাতিল করেছেন। কোনো পেমেন্ট নেওয়া হয়নি।'
          : 'আপনি এই অর্ডার বাতিল করেছেন।',
        tag: 'lb-order-cancelled'
      },
      as: {
        title: '❌ অৰ্ডাৰ বাতিল',
        body:  byShop
          ? 'দোকানদাৰে আপোনাৰ অৰ্ডাৰ বাতিল কৰিলে। কোনো পেমেণ্ট লোৱা হোৱা নাই।'
          : 'আপুনি এই অৰ্ডাৰ বাতিল কৰিলে।',
        tag: 'lb-order-cancelled'
      }
    }[lang]);
  },

  /**
   * shiftClosingSoon — auto-close warning 15 min before closing time
   * @param {string} lang
   * @param {string} time - Closing time string e.g. '9:00 PM'
   */
  shiftClosingSoon: (lang = 'en', time = '') => ({
    en: {
      title: `⏰ Closing in 15 minutes`,
      body:  `Your shop will go offline at ${time}. Wrap up any open orders.`,
      tag:   'lb-shift-warn'
    },
    hi: {
      title: `⏰ 15 मिनट में बंद`,
      body:  `आपकी दुकान ${time} बजे ऑफलाइन हो जाएगी। खुले ऑर्डर निपटाएं।`,
      tag:   'lb-shift-warn'
    },
    bn: {
      title: `⏰ ১৫ মিনিটে বন্ধ`,
      body:  `আপনার দোকান ${time}-এ অফলাইন হবে। খোলা অর্ডারগুলো সম্পন্ন করুন।`,
      tag:   'lb-shift-warn'
    },
    as: {
      title: `⏰ ১৫ মিনিটত বন্ধ`,
      body:  `আপোনাৰ দোকান ${time}-ত অফলাইন হ'ব। খোলা অৰ্ডাৰবোৰ সম্পন্ন কৰক।`,
      tag:   'lb-shift-warn'
    }
  }[lang]),

  /**
   * offlineQueued — customer tried to order while offline
   * @param {string} lang
   */
  offlineQueued: (lang = 'en') => ({
    en: {
      title: '📶 Order Saved Offline',
      body:  'No connection right now. Your order will be sent when you\'re back online.',
      tag:   'lb-offline-queue'
    },
    hi: {
      title: '📶 ऑर्डर ऑफलाइन सेव',
      body:  'अभी कनेक्शन नहीं है। ऑनलाइन होने पर ऑर्डर भेजा जाएगा।',
      tag:   'lb-offline-queue'
    },
    bn: {
      title: '📶 অর্ডার অফলাইনে সেভ',
      body:  'এখন কানেকশন নেই। অনলাইন হলে অর্ডার পাঠানো হবে।',
      tag:   'lb-offline-queue'
    },
    as: {
      title: '📶 অৰ্ডাৰ অফলাইনত সঞ্চিত',
      body:  'এতিয়া সংযোগ নাই। অনলাইন হ\'লে অৰ্ডাৰ পঠোৱা হ\'ব।',
      tag:   'lb-offline-queue'
    }
  }[lang])

};

// ─────────────────────────────────────────────────────────────────────────────
// 9. SERVICE WORKER MESSAGE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

function _handleSWMessage(event) {
  if (!event.data || !event.data.type) return;

  const { type, payload } = event.data;

  switch (type) {
    case 'ORDER_SYNCED':
      showToast({
        type:    'success',
        title:   'Order sent!',
        message: `Order ${payload.orderId} was placed successfully.`,
        orderId: payload.orderId,
        duration: 5000
      });
      break;

    case 'PUSH_RECEIVED_FOREGROUND':
      showToast({
        type:    payload.toastType || 'info',
        title:   payload.title,
        message: payload.body,
        duration: 6000
      });
      break;

    case 'SW_UPDATED':
      showToast({
        type:    'info',
        title:   'App updated',
        message: 'Refresh to get the latest version.',
        duration: 0,
        action: {
          label:   'Refresh now',
          onClick: () => window.location.reload()
        }
      });
      break;

    default:
      console.log('[Notifications] Unhandled SW message type:', type);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function _getCurrentLang() {
  const valid = ['en', 'hi', 'bn', 'as'];
  const stored = localStorage.getItem('lb_lang');
  return valid.includes(stored) ? stored : 'en';
}

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. PUBLIC API SURFACE
// ─────────────────────────────────────────────────────────────────────────────

const Notifications = {
  init,
  startShift,               // FIX A1 — call this on "Start Shift" button click
  stopShift,                // FIX A1 — call this on "End Shift" button click
  requestPushPermission,
  unsubscribePush,
  playForegroundAlert,
  stopForegroundAlert,
  vibrateAlert,
  screenFlash,
  triggerNewOrderAlert,
  showToast,
  NOTIFICATION_PAYLOADS
};

window.Notifications = Notifications;