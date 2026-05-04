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
// We keep a reference to the pre-unlocked <audio> element injected by
// shopkeeper.html on shift start. Browser autoplay policy requires the
// element to have been interacted with (play→pause) before we can
// trigger it programmatically on incoming orders.
let _audioElement = null;

// Tracks whether the user has granted notification permission
let _pushSubscription = null;

// ─── Toast queue (prevents toast stack overflow) ──────────────────────────────
const _toastQueue = [];
let _toastActive = false;

// ─────────────────────────────────────────────────────────────────────────────
// 1. INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * init()
 * Call once on page load. Wires up the audio element reference and
 * checks existing push subscription state.
 *
 * @param {HTMLAudioElement|null} audioEl - Pre-unlocked audio element from page
 */
function init(audioEl = null) {
  if (audioEl instanceof HTMLAudioElement) {
    _audioElement = audioEl;
    console.log('[Notifications] Audio element registered.');
  }

  // Restore cached permission state (avoids redundant permission prompts)
  const cachedPermission = localStorage.getItem('lb_push_permission');
  if (cachedPermission === 'granted') {
    console.log('[Notifications] Push previously granted — will subscribe on demand.');
  }

  // Listen for messages from the service worker (e.g., "order ready" while app open)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', _handleSWMessage);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PUSH PERMISSION + SUBSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * requestPushPermission()
 * Asks the browser for notification permission, then creates a push
 * subscription via the active service worker. Sends the subscription
 * object to the backend for storage.
 *
 * Called by customer.js after "Confirm Order" is tapped.
 *
 * @returns {Promise<boolean>} - true if permission granted, false otherwise
 */
async function requestPushPermission() {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Web Notifications not supported in this browser.');
    return false;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Notifications] Push API not supported in this browser.');
    return false;
  }

  // If already granted, just ensure we have a subscription
  if (Notification.permission === 'granted') {
    await _ensurePushSubscription();
    return true;
  }

  // If previously denied, don't prompt again — silently fail
  if (Notification.permission === 'denied') {
    console.warn('[Notifications] Push permission previously denied by user.');
    return false;
  }

  // Request permission from the user
  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    // Some older browsers use a callback-style API; handle gracefully
    permission = await new Promise(resolve => Notification.requestPermission(resolve));
  }

  // Persist result so we don't re-prompt unnecessarily
  localStorage.setItem('lb_push_permission', permission);

  if (permission === 'granted') {
    console.log('[Notifications] Push permission granted.');
    await _ensurePushSubscription();
    return true;
  }

  console.log('[Notifications] Push permission not granted:', permission);
  return false;
}

/**
 * _ensurePushSubscription()
 * Internal: creates or retrieves the PushSubscription object and
 * sends it to the backend.
 *
 * @private
 */
async function _ensurePushSubscription() {
  try {
    // Wait for the active service worker
    const reg = await navigator.serviceWorker.ready;

    // Check for existing subscription first (avoids duplicate sends)
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      _pushSubscription = existing;
      console.log('[Notifications] Re-using existing push subscription.');
      // TODO: Re-send to backend if sub was never confirmed:
      //   await DB.savePushSubscription(existing.toJSON());
      return;
    }

    // Convert the VAPID public key from base64 to Uint8Array (required by spec)
    const appServerKey = _urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,          // required by spec; push must show notification
      applicationServerKey: appServerKey
    });

    _pushSubscription = subscription;
    console.log('[Notifications] New push subscription created:', subscription.endpoint);

    // TODO: Replace stub with real API call:
    //   POST /api/push/subscribe  body: { subscription: subscription.toJSON(), userId, shopId }
    //   Using db-bridge.js:
    //   await DB.savePushSubscription(subscription.toJSON());
    console.log('[Notifications][STUB] Would send subscription to backend:', subscription.toJSON());

  } catch (err) {
    console.error('[Notifications] Failed to create push subscription:', err.message);
    // Common cause: VAPID key is still the placeholder string. Replace it!
    if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
      console.error('[Notifications] ⚠️  VAPID_PUBLIC_KEY is still a placeholder. Set a real key to enable push.');
    }
  }
}

/**
 * unsubscribePush()
 * Unsubscribes from push notifications. Call when shopkeeper ends their shift
 * or customer explicitly opts out.
 *
 * @returns {Promise<void>}
 */
async function unsubscribePush() {
  if (!_pushSubscription) return;
  try {
    await _pushSubscription.unsubscribe();
    _pushSubscription = null;
    localStorage.removeItem('lb_push_permission');
    console.log('[Notifications] Unsubscribed from push.');
    // TODO: Notify backend to remove subscription:
    //   await DB.deletePushSubscription(endpoint);
  } catch (err) {
    console.error('[Notifications] Failed to unsubscribe:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FOREGROUND AUDIO ALERTS (shopkeeper dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * playForegroundAlert()
 * Plays an audio tone when the shopkeeper dashboard is open and a new order
 * arrives (foreground state — push notification would not be visible).
 *
 * The audio element MUST have been pre-unlocked during shift start by calling:
 *   audioEl.play(); audioEl.pause(); audioEl.currentTime = 0;
 * This satisfies the browser's user-gesture requirement for autoplay.
 *
 * @param {'new-order'|'order-ready'} sound - Which tone to play
 */
function playForegroundAlert(sound = 'new-order') {
  if (!_audioElement) {
    // Attempt fallback: find the element in the DOM directly
    _audioElement = document.getElementById('audio-unlock');
  }

  if (!_audioElement) {
    console.warn('[Notifications] Audio element not available. Was init() called?');
    return;
  }

  const srcMap = {
    'new-order':   'assets/sounds/new-order.mp3',
    'order-ready': 'assets/sounds/order-ready.mp3'
  };

  const src = srcMap[sound] || srcMap['new-order'];

  // Reset and play
  _audioElement.src = src;
  _audioElement.currentTime = 0;

  _audioElement.play().catch(err => {
    // Autoplay blocked — this means the audio was never pre-unlocked during shift start
    console.warn('[Notifications] Audio play() blocked. Ensure shift-start pre-unlock ran:', err.message);
  });
}

/**
 * stopForegroundAlert()
 * Stops any currently playing foreground audio.
 */
function stopForegroundAlert() {
  if (!_audioElement) return;
  _audioElement.pause();
  _audioElement.currentTime = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. VIBRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * vibrateAlert()
 * Fires the device vibration motor with our standard LocalBuy pattern.
 * Pattern: buzz-pause-buzz-pause-buzz (SOS-lite — distinct from generic pings)
 *
 * @param {'new-order'|'order-ready'|'custom'} type - Alert type
 * @param {number[]} [customPattern] - Custom vibration pattern in ms (optional)
 */
function vibrateAlert(type = 'new-order', customPattern = null) {
  if (!('vibrate' in navigator)) {
    console.info('[Notifications] Vibration API not supported.');
    return;
  }

  const patterns = {
    'new-order':   [200, 100, 200, 100, 200],  // triple buzz — new order arriving
    'order-ready': [400, 150, 400],             // double long buzz — customer pickup
    'custom':      customPattern || [200]
  };

  const pattern = patterns[type] || patterns['new-order'];
  navigator.vibrate(pattern);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SCREEN FLASH ALERT (shopkeeper — new order visual cue)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * screenFlash()
 * Briefly flashes the viewport white to draw attention to a new order.
 * Uses a CSS overlay div, not document.body background change, so it
 * respects the existing layout. Matches the 300ms spec from the brief.
 *
 * @param {string} [color='rgba(255,255,255,0.85)'] - Flash colour
 */
function screenFlash(color = 'rgba(255, 255, 255, 0.85)') {
  // Reuse existing overlay or create it
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

  // Trigger: fade in → hold → fade out
  requestAnimationFrame(() => {
    flash.style.opacity = '1';
    setTimeout(() => {
      flash.style.opacity = '0';
    }, 150); // hold for 150ms, then fade out over 150ms
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. FULL NEW-ORDER ALERT SEQUENCE (shopkeeper)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * triggerNewOrderAlert()
 * Master function called by db-bridge.js onNewOrder() when the
 * shopkeeper dashboard is open. Fires all foreground alert surfaces
 * simultaneously: audio + vibration + screen flash + in-app toast.
 *
 * Also triggers a Web Push if the app is in the background.
 *
 * @param {Object} order - Order object from db-bridge
 * @param {string} order.id - Order ID e.g. 'LB-8472'
 * @param {string} order.customerName - First name only (no PII logging)
 * @param {string} order.pickupTime - ISO string or '2:30 PM'
 */
function triggerNewOrderAlert(order) {
  const lang = _getCurrentLang();
  const payload = NOTIFICATION_PAYLOADS.newOrder(lang);

  // 1. Audio
  playForegroundAlert('new-order');

  // 2. Vibration
  vibrateAlert('new-order');

  // 3. Screen flash
  screenFlash();

  // 4. In-app toast (rich, not a raw alert())
  showToast({
    type:     'order',
    title:    payload.title,
    message:  payload.body,
    orderId:  order.id,
    duration: 8000,          // stays visible longer for important order alerts
    action: {
      label:   _getCurrentLang() === 'en' ? 'View' : payload.actionLabel || 'View',
      onClick: () => {
        // TODO: Replace with real navigation to order action panel
        if (window.ShopkeeperDashboard && typeof window.ShopkeeperDashboard.openOrder === 'function') {
          window.ShopkeeperDashboard.openOrder(order.id);
        }
      }
    }
  });

  // 5. If tab is not visible, the service worker will handle push
  //    (sw.js push event handler fires when app is backgrounded)
  //    Here we only need to ensure the subscription is active.
  if (document.visibilityState === 'hidden') {
    console.log('[Notifications] App backgrounded — push notification handled by SW.');
    // TODO: Backend sends actual push via VAPID — this is handled server-side
    // The SW's 'push' event listener in sw.js will display the notification
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. IN-APP TOAST NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * showToast()
 * Displays a styled in-app toast notification. Never uses alert().
 * Supports queuing — toasts display one at a time, 8px stacked if fast-firing.
 *
 * Toast types:
 *   'order'   — new order (amber accent, 🔔)
 *   'success' — action completed (sage accent, ✓)
 *   'warning' — closing soon, offline (amber accent, ⚠)
 *   'error'   — failed action (red accent, ✕)
 *   'info'    — general info (muted, ℹ)
 *
 * @param {Object} opts
 * @param {'order'|'success'|'warning'|'error'|'info'} opts.type
 * @param {string} opts.title - Bold heading line
 * @param {string} opts.message - Body text
 * @param {string} [opts.orderId] - If set, renders an order-code chip
 * @param {number} [opts.duration=4000] - Auto-dismiss after N ms (0 = persistent)
 * @param {{label: string, onClick: Function}} [opts.action] - Optional CTA button
 */
function showToast(opts = {}) {
  const {
    type     = 'info',
    title    = '',
    message  = '',
    orderId  = null,
    duration = 4000,
    action   = null
  } = opts;

  // Enqueue if a toast is already showing
  if (_toastActive) {
    _toastQueue.push(opts);
    return;
  }

  _toastActive = true;

  // Ensure toast container exists
  let container = document.getElementById('lb-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'lb-toast-container';
    // Positioning: top of screen, centred, above everything
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
      pointerEvents: 'none'    // container itself doesn't block clicks
    });
    document.body.appendChild(container);
  }

  // Type → colour mapping (uses CSS variables; fallback to raw values)
  const typeStyles = {
    order:   { borderColor: 'var(--color-amber, #d97706)',    icon: '🔔', bg: 'var(--color-amber-light, #fffbf0)' },
    success: { borderColor: 'var(--color-sage, #0f5c3a)',     icon: '✓',  bg: 'var(--color-sage-pale, #f0faf4)'  },
    warning: { borderColor: 'var(--color-amber, #d97706)',    icon: '⚠️', bg: 'var(--color-amber-light, #fffbf0)' },
    error:   { borderColor: 'var(--status-closed, #dc2626)',  icon: '✕',  bg: '#fff5f5'                           },
    info:    { borderColor: 'var(--color-muted, #6b7280)',    icon: 'ℹ',  bg: 'var(--color-surface, #f8f7f4)'    }
  };

  const style = typeStyles[type] || typeStyles.info;

  // Build toast element
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

  // Inner HTML (safe — no user content interpolated without sanitisation)
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

  // Wire up close button
  const closeBtn = toast.querySelector('[data-toast-close]');
  const closeToast = () => _dismissToast(toast, container);
  closeBtn.addEventListener('click', closeToast);

  // Wire up action button
  if (action) {
    const actionBtn = toast.querySelector('[data-toast-action]');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      action.onClick();
      closeToast();
    });
  }

  // Append and animate in
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Auto-dismiss
  let dismissTimer = null;
  if (duration > 0) {
    dismissTimer = setTimeout(closeToast, duration);
  }

  // Pause auto-dismiss on hover (accessibility — gives user time to read)
  toast.addEventListener('mouseenter', () => {
    if (dismissTimer) clearTimeout(dismissTimer);
  });
  toast.addEventListener('mouseleave', () => {
    if (duration > 0) {
      dismissTimer = setTimeout(closeToast, duration);
    }
  });
}

/**
 * _dismissToast()
 * Animates a toast out and removes it from the DOM. Then drains queue.
 * @private
 */
function _dismissToast(toast, container) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(-12px)';
  setTimeout(() => {
    if (toast.parentNode === container) {
      container.removeChild(toast);
    }
    _toastActive = false;
    // Show next queued toast
    if (_toastQueue.length > 0) {
      const next = _toastQueue.shift();
      showToast(next);
    }
  }, 250); // matches transition duration
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. NOTIFICATION PAYLOADS (multilingual)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NOTIFICATION_PAYLOADS
 * Multilingual notification content for every notification type.
 * Each function takes a language code and returns { title, body, actionLabel, actionUrl }.
 *
 * Languages: en (English) · hi (Hindi) · bn (Bengali) · as (Assamese)
 *
 * Used by:
 *   • triggerNewOrderAlert() — foreground toast title/body
 *   • sw.js push handler     — background push notification (via event.data.json())
 *   • shopkeeper.js          — shift warning alerts
 */
const NOTIFICATION_PAYLOADS = {

  /**
   * newOrder — shopkeeper receives a new customer order
   * @param {string} lang
   * @returns {{ title: string, body: string, actionLabel: string, tag: string }}
   */
  newOrder: (lang = 'en') => ({
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
  }[lang] || NOTIFICATION_PAYLOADS.newOrder('en')),  // fallback to English

  /**
   * orderReady — customer's order is packed and ready for pickup
   * @param {string} lang
   * @returns {{ title: string, body: string, actionLabel: string, tag: string }}
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
   * @returns {{ title: string, body: string, actionLabel: string, tag: string }}
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
   * @returns {{ title: string, body: string, tag: string }}
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
   * @returns {{ title: string, body: string, tag: string }}
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
   * offlineQueued — customer tried to order while offline; order was saved locally
   * @param {string} lang
   * @returns {{ title: string, body: string, tag: string }}
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

/**
 * _handleSWMessage()
 * Handles messages posted from the service worker to the page
 * (e.g., background sync completed, push received while app open).
 *
 * @private
 * @param {MessageEvent} event
 */
function _handleSWMessage(event) {
  if (!event.data || !event.data.type) return;

  const { type, payload } = event.data;

  switch (type) {
    case 'ORDER_SYNCED':
      // Background sync succeeded — tell the user their queued order went through
      showToast({
        type:    'success',
        title:   'Order sent!',
        message: `Order ${payload.orderId} was placed successfully.`,
        orderId: payload.orderId,
        duration: 5000
      });
      break;

    case 'PUSH_RECEIVED_FOREGROUND':
      // SW can't show push while app is focused; it posts a message instead
      showToast({
        type:    payload.toastType || 'info',
        title:   payload.title,
        message: payload.body,
        duration: 6000
      });
      break;

    case 'SW_UPDATED':
      // New SW version installed — prompt user to refresh
      showToast({
        type:    'info',
        title:   'App updated',
        message: 'Refresh to get the latest version.',
        duration: 0,  // persistent — user must act
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

/**
 * _urlBase64ToUint8Array()
 * Converts a URL-safe base64 VAPID public key string to the Uint8Array
 * format required by pushManager.subscribe().
 * Standard implementation — do not modify.
 *
 * @private
 * @param {string} base64String
 * @returns {Uint8Array}
 */
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

/**
 * _getCurrentLang()
 * Reads the current language from localStorage (set by i18n.js).
 * Falls back to 'en' if not set.
 *
 * @private
 * @returns {'en'|'hi'|'bn'|'as'}
 */
function _getCurrentLang() {
  const valid = ['en', 'hi', 'bn', 'as'];
  const stored = localStorage.getItem('lb_lang');
  return valid.includes(stored) ? stored : 'en';
}

/**
 * _escapeHtml()
 * Sanitises any string before injecting into innerHTML.
 * Prevents XSS from user-controlled content in toast messages.
 *
 * @private
 * @param {string} str
 * @returns {string}
 */
function _escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. PUBLIC API SURFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exported as a single namespace object so all JS files can import cleanly:
 *
 *   // In customer.js:
 *   await Notifications.requestPushPermission();
 *
 *   // In shopkeeper.js (onNewOrder callback from db-bridge.js):
 *   Notifications.triggerNewOrderAlert(order);
 *
 *   // Anywhere:
 *   Notifications.showToast({ type: 'success', title: 'Done!', message: 'Order accepted.' });
 */
const Notifications = {
  // Lifecycle
  init,
  requestPushPermission,
  unsubscribePush,

  // Alert surfaces
  playForegroundAlert,
  stopForegroundAlert,
  vibrateAlert,
  screenFlash,
  triggerNewOrderAlert,

  // In-app toasts
  showToast,

  // Payload library (for reference by sw.js and shopkeeper.js)
  NOTIFICATION_PAYLOADS
};

// Make available globally (no module bundler — vanilla JS)
window.Notifications = Notifications;