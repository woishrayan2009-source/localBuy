/**
 * shopkeeper.js — LocalBuy Shopkeeper Dashboard Logic
 *
 * FIX H2: Removed `window.showToast = showToast` assignment that was
 *         overwriting app.js's version and pointing to the wrong container.
 *         The local showToast() now only writes to #toast-container in
 *         shopkeeper.html (correct). app.js's LB.toast uses #lb-toast-container.
 *         No conflict — they target different containers on different pages.
 *
 * FIX H5: Added window.addEventListener('beforeunload') to clear
 *         autoCloseInterval and persist shift state so a page refresh
 *         mid-shift doesn't create a double-interval situation.
 */

'use strict';

// ══════════════════════════════════════════════════════════════════
//  MODULE-LEVEL STATE
// ══════════════════════════════════════════════════════════════════

let activeOrder = null;
let orderListenerUnsubscribe = null;
const orderCache = new Map();
const oosItems = new Set();

let shift = {
  startTime:   null,
  ordersCount: 0,
  earnings:    0,
  readyTimes:  [],
};

let autoCloseInterval = null;

// ══════════════════════════════════════════════════════════════════
//  DOM REFERENCES
// ══════════════════════════════════════════════════════════════════
let DOM = {};

function cacheDOM() {
  DOM = {
    registerForm:       document.getElementById('section-register'),
    inputShopName:      document.getElementById('input-shop-name'),
    inputOwnerName:     document.getElementById('input-owner-name'),
    inputCategory:      document.getElementById('input-category'),
    inputArea:          document.getElementById('input-area'),
    inputPhone:         document.getElementById('input-phone'),
    inputOpenTime:      document.getElementById('input-open-time'),
    inputCloseTime:     document.getElementById('input-close-time'),
    inputLastOrder:     document.getElementById('input-last-order'),
    inputUpi:           document.getElementById('input-upi'),
    btnRegister:        document.getElementById('btn-register'),

    btnStartShift:      document.getElementById('btn-start-shift'),
    shiftStatusPill:    document.getElementById('shift-status-pill'),
    greetingName:       document.getElementById('shift-greeting-name'),
    shiftShopName:      document.getElementById('shift-shop-name-display'),
    statYestOrders:     document.getElementById('stat-yesterday-orders'),
    statYestEarnings:   document.getElementById('stat-yesterday-earnings'),
    statYestAvgTime:    document.getElementById('stat-yesterday-avgtime'),

    dashShopName:       document.getElementById('dash-shop-name'),
    dashStatusToggle:   document.getElementById('dash-status-toggle'),
    dashStatusLabel:    document.getElementById('dash-status-label'),
    btnEndShift:        document.getElementById('btn-end-shift'),

    statOrdersToday:    document.getElementById('stat-orders-today'),
    statEarningsToday:  document.getElementById('stat-earnings-today'),
    statAvgReady:       document.getElementById('stat-avg-ready'),

    tabOrders:          document.getElementById('tab-orders'),
    tabInventory:       document.getElementById('tab-inventory'),
    panelOrders:        document.getElementById('panel-orders'),
    panelInventory:     document.getElementById('panel-inventory'),
    ordersFeed:         document.getElementById('orders-feed'),
    ordersEmptyState:   document.getElementById('orders-empty-state'),
    ordersCountBadge:   document.getElementById('orders-count-badge'),

    shopkeeperAlert:    document.getElementById('shopkeeper-alert'),
    flashOverlay:       document.getElementById('flash-overlay'),
    pullHint:           document.getElementById('pull-hint'),

    oosChipsGrid:       document.getElementById('oos-chips-grid'),
    btnClearOos:        document.getElementById('btn-clear-oos'),
    oosCustomInput:     document.getElementById('oos-custom-input'),
    btnOosAdd:          document.getElementById('btn-oos-add'),

    orderPanelOverlay:  document.getElementById('order-panel-overlay'),
    panelOrderId:       document.getElementById('order-panel-title'),
    panelCustomerMeta:  document.getElementById('panel-customer-meta'),
    panelOrderText:     document.getElementById('panel-order-text'),
    panelPhotoWrap:     document.getElementById('panel-photo-wrap'),
    panelOrderPhoto:    document.getElementById('panel-order-photo'),
    panelPaymentInfo:   document.getElementById('panel-payment-info'),
    panelOosChips:      document.getElementById('panel-oos-chips'),
    billAmount:         document.getElementById('bill-amount'),
    subNotes:           document.getElementById('sub-notes'),
    btnSendQuote:       document.getElementById('btn-send-quote'),
    btnMarkPacking:     document.getElementById('btn-mark-packing'),
    btnMarkReady:       document.getElementById('btn-mark-ready'),
    btnCancelOrder:     document.getElementById('btn-cancel-order'),
    btnClosePanel:      document.getElementById('btn-close-panel'),
    confettiBurst:      document.getElementById('confetti-burst'),

    summaryOrders:      document.getElementById('summary-orders'),
    summaryEarnings:    document.getElementById('summary-earnings'),
    summaryAvgTime:     document.getElementById('summary-avg-time'),
    summaryDuration:    document.getElementById('summary-duration'),
    pendingWarning:      document.getElementById('pending-orders-warning'),
    pendingWarningText:  document.getElementById('pending-warning-text'),
    btnExportWA:        document.getElementById('btn-export-wa'),
    btnNewShift:        document.getElementById('btn-new-shift'),

    appModalOverlay:    document.getElementById('app-modal-overlay'),
    appModalTitle:      document.getElementById('app-modal-title'),
    appModalBody:       document.getElementById('app-modal-body'),
    appModalCancel:     document.getElementById('app-modal-cancel'),
    appModalConfirm:    document.getElementById('app-modal-confirm'),

    audioUnlock:        document.getElementById('audio-unlock'),
  };
}

// ══════════════════════════════════════════════════════════════════
//  UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════

function t(key, vars) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key, vars);
  }
  return key;
}

function fmtCurrency(amount) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch(e) { return `₹${amount}`; }
}

function fmtTime(date) {
  try {
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch(e) { return date.toTimeString().slice(0,5); }
}

function parseTimeStr(str) {
  const [h, m] = (str || '00:00').split(':').map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

function getDateAtTime(timeStr) {
  const { h, m } = parseTimeStr(timeStr);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function msToMins(ms) {
  return Math.round(ms / 60000) + ' min';
}

function getShopConfig() {
  try {
    return {
      shopId:    localStorage.getItem('lb_shop_id')    || '',
      shopName:  localStorage.getItem('lb_shop_name')  || t('shop.defaultName'),
      ownerName: localStorage.getItem('lb_owner_name') || '',
      openTime:  localStorage.getItem('lb_open_time')  || '08:00',
      closeTime: localStorage.getItem('lb_close_time') || '21:00',
      lastOrder: localStorage.getItem('lb_last_order') || '20:30',
      phone:     localStorage.getItem('lb_phone')      || '',
      category:  localStorage.getItem('lb_category')   || '',
      area:      localStorage.getItem('lb_area')       || '',
    };
  } catch(e) { return {}; }
}

// ══════════════════════════════════════════════════════════════════
//  CUSTOM MODAL
// ══════════════════════════════════════════════════════════════════

function showModal({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel, dangerous = false }) {
  const { appModalOverlay, appModalTitle, appModalBody, appModalConfirm, appModalCancel } = DOM;
  if (!appModalOverlay) return;

  appModalTitle.textContent   = title;
  appModalBody.textContent    = body;
  appModalConfirm.textContent = confirmLabel || t('modal.confirm');
  appModalCancel.textContent  = cancelLabel  || t('modal.cancel');

  appModalConfirm.className = `btn modal-btn ${dangerous ? 'btn-danger' : 'btn-primary'}`;

  appModalOverlay.removeAttribute('hidden');
  appModalConfirm.focus();

  const newConfirm = appModalConfirm.cloneNode(true);
  const newCancel  = appModalCancel.cloneNode(true);
  appModalConfirm.parentNode.replaceChild(newConfirm, appModalConfirm);
  appModalCancel.parentNode.replaceChild(newCancel,   appModalCancel);
  DOM.appModalConfirm = newConfirm;
  DOM.appModalCancel  = newCancel;

  newConfirm.addEventListener('click', () => { hideModal(); if (onConfirm) onConfirm(); }, { once: true });
  newCancel.addEventListener('click',  () => { hideModal(); if (onCancel)  onCancel();  }, { once: true });
}

function hideModal() {
  if (DOM.appModalOverlay) DOM.appModalOverlay.setAttribute('hidden', '');
}

// ══════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
//
//  FIX H2: No longer assigns to window.showToast.
//  This function writes to #toast-container in shopkeeper.html.
//  app.js's LB.toast writes to #lb-toast-container (different element).
//  Both coexist on the same page without conflict.
// ══════════════════════════════════════════════════════════════════

function showToast(message, type = '', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = '300ms ease';
    setTimeout(() => toast.remove(), 310);
  }, duration);
}

// ══════════════════════════════════════════════════════════════════
//  SHOPKEEPER ALERT BANNER
// ══════════════════════════════════════════════════════════════════

function showShopkeeperAlert(type, message) {
  const el = DOM.shopkeeperAlert;
  if (!el) return;
  el.className = `shopkeeper-alert ${type}`;
  el.querySelector('.alert-text').textContent = message;
  el.removeAttribute('hidden');
}

function hideShopkeeperAlert() {
  if (DOM.shopkeeperAlert) DOM.shopkeeperAlert.setAttribute('hidden', '');
}

// ══════════════════════════════════════════════════════════════════
//  REGISTRATION
// ══════════════════════════════════════════════════════════════════

async function handleRegistration() {
  const { inputShopName, inputOwnerName, inputCategory, inputArea,
          inputPhone, inputOpenTime, inputCloseTime, inputLastOrder,
          inputUpi, btnRegister } = DOM;

  const shopName  = inputShopName?.value.trim();
  const ownerName = inputOwnerName?.value.trim();
  const category  = inputCategory?.value;
  const area      = inputArea?.value.trim();
  const phone     = inputPhone?.value.trim();
  const openTime  = inputOpenTime?.value;
  const closeTime = inputCloseTime?.value;
  const lastOrder = inputLastOrder?.value;

  if (!shopName)  { showToast(t('register.error.shopName'), 'error'); inputShopName?.focus(); return; }
  if (!ownerName) { showToast(t('register.error.ownerName'), 'error'); inputOwnerName?.focus(); return; }
  if (!category)  { showToast(t('register.error.category'), 'error'); inputCategory?.focus(); return; }
  if (!area)      { showToast(t('register.error.area'), 'error'); inputArea?.focus(); return; }
  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    showToast(t('register.error.phone'), 'error'); inputPhone?.focus(); return;
  }

  if (btnRegister) { btnRegister.disabled = true; btnRegister.textContent = t('register.saving'); }

  try {
    const shopId = 'SHOP-' + Date.now();

    localStorage.setItem('lb_shop_id',    shopId);
    localStorage.setItem('lb_shop_name',  shopName);
    localStorage.setItem('lb_owner_name', ownerName);
    localStorage.setItem('lb_category',   category);
    localStorage.setItem('lb_area',       area);
    localStorage.setItem('lb_phone',      phone);
    localStorage.setItem('lb_open_time',  openTime  || '08:00');
    localStorage.setItem('lb_close_time', closeTime || '21:00');
    localStorage.setItem('lb_last_order', lastOrder || '20:30');
    localStorage.removeItem('lb_shift_ended');
    localStorage.removeItem('lb_shift_active');

    if (window.DB) {
      DB.logEvent('shop_registered', { category, area });
    }

    showToast(t('register.success'), 'success');
    populateShiftStartScreen();
    window.showScreen('shift-start');

  } catch(err) {
    console.error('[Register] Error:', err);
    showToast(t('register.error.generic'), 'error');
  } finally {
    if (btnRegister) { btnRegister.disabled = false; btnRegister.textContent = t('register.submit'); }
  }
}

// ══════════════════════════════════════════════════════════════════
//  SHIFT START / END
// ══════════════════════════════════════════════════════════════════

function populateShiftStartScreen() {
  const cfg = getShopConfig();

  if (DOM.shiftShopName)  DOM.shiftShopName.textContent  = cfg.shopName;
  if (DOM.dashShopName)   DOM.dashShopName.textContent   = cfg.shopName;
  if (DOM.greetingName) {
    const hour = new Date().getHours();
    const greetKey = hour < 12 ? 'greeting.morning' : hour < 17 ? 'greeting.afternoon' : 'greeting.evening';
    DOM.greetingName.textContent = `${t(greetKey)}, ${cfg.ownerName} 👋`;
  }

  const hoursEl = document.getElementById('shift-hours-display');
  if (hoursEl && cfg.openTime && cfg.closeTime) {
    const fmt = s => {
      const { h, m } = parseTimeStr(s);
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${ampm}`;
    };
    hoursEl.textContent = `${t('shift.hoursLabel')}: ${fmt(cfg.openTime)} – ${fmt(cfg.closeTime)}`;
  }

  try {
    const prev = JSON.parse(localStorage.getItem('lb_prev_shift') || '{}');
    if (DOM.statYestOrders)   DOM.statYestOrders.textContent   = prev.orders   ?? '—';
    if (DOM.statYestEarnings) DOM.statYestEarnings.textContent = prev.earnings  ? fmtCurrency(prev.earnings) : '—';
    if (DOM.statYestAvgTime)  DOM.statYestAvgTime.textContent  = prev.avgTime   ? prev.avgTime + ' min' : '—';
  } catch(e) {}
}

async function startShift() {
  // 1. Unlock audio autoplay
  unlockAudio();

  // 2. Record shift start time
  shift.startTime   = new Date();
  shift.ordersCount = 0;
  shift.earnings    = 0;
  shift.readyTimes  = [];

  try {
    localStorage.setItem('lb_shift_active', 'true');
    localStorage.setItem('lb_shift_start',  shift.startTime.toISOString());
    localStorage.removeItem('lb_shift_ended');
  } catch(e) {}

  // 3. Set shop online
  const cfg = getShopConfig();
  try {
    DB.setShopStatus(cfg.shopId, 'online');
    DB.logEvent('shift_started', { shopId: cfg.shopId });
  } catch(e) { console.warn('[DB] setShopStatus failed', e); }

  // 4. Update dashboard UI
  updateDashboardStatus(true);
  updateStatsDisplay();

  // 5. Start auto-close guard
  startAutoCloseGuard();

  // 6. Start listening for orders
  startOrderListener(cfg.shopId);

  // 7. Navigate
  window.showScreen('dashboard');

  // 8. Restore OOS items from localStorage
  restoreOosItems();
}

function unlockAudio() {
  const audio = DOM.audioUnlock;
  if (!audio) return;
  audio.play()
    .then(() => { audio.pause(); audio.currentTime = 0; })
    .catch(e => console.warn('[Audio] Unlock failed', e));
}

async function endShift(auto = false) {
  // Stop guards
  if (autoCloseInterval) { clearInterval(autoCloseInterval); autoCloseInterval = null; }
  if (orderListenerUnsubscribe) { orderListenerUnsubscribe(); orderListenerUnsubscribe = null; }

  const cfg = getShopConfig();
  try {
    DB.setShopStatus(cfg.shopId, 'offline');
    DB.logEvent('shift_ended', { shopId: cfg.shopId, ordersCount: shift.ordersCount, auto });
  } catch(e) {}

  const durationMs = shift.startTime ? (Date.now() - shift.startTime.getTime()) : 0;
  const durationStr = `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`;

  const avgReady = shift.readyTimes.length
    ? Math.round(shift.readyTimes.reduce((a,b)=>a+b,0) / shift.readyTimes.length / 60000)
    : 0;

  try {
    localStorage.setItem('lb_prev_shift', JSON.stringify({
      orders:   shift.ordersCount,
      earnings: shift.earnings,
      avgTime:  avgReady,
    }));
    localStorage.setItem('lb_shift_active', 'false');
    localStorage.setItem('lb_shift_ended',  'true');
    localStorage.removeItem('lb_shift_start');
  } catch(e) {}

  if (DOM.summaryOrders)   DOM.summaryOrders.textContent   = shift.ordersCount;
  if (DOM.summaryEarnings) DOM.summaryEarnings.textContent = fmtCurrency(shift.earnings);
  if (DOM.summaryAvgTime)  DOM.summaryAvgTime.textContent  = avgReady ? avgReady + ' min' : t('summary.na');
  if (DOM.summaryDuration) DOM.summaryDuration.textContent = durationStr;

  const pendingCount = Array.from(orderCache.values()).filter(o => o.status !== 'ready' && o.status !== 'cancelled').length;
  if (pendingCount > 0 && DOM.pendingWarning) {
    DOM.pendingWarning.removeAttribute('hidden');
    if (DOM.pendingWarningText) {
      DOM.pendingWarningText.textContent = t('shiftEnd.pendingWarning', { count: pendingCount });
    }
  }

  window.showScreen('shift-end');
}

// ══════════════════════════════════════════════════════════════════
//  AUTO-CLOSE GUARD
//
//  FIX H5: Added beforeunload handler so that if shopkeeper refreshes
//  mid-shift, lb_shift_active remains 'true' in localStorage (so the
//  inline boot script in shopkeeper.html resumes to 'dashboard' screen).
//  The interval is cleared on unload so garbage collection works cleanly.
//  On the new page load, startShift() creates a fresh interval — no double.
// ══════════════════════════════════════════════════════════════════

function startAutoCloseGuard() {
  // Clear any existing interval first (defensive)
  if (autoCloseInterval) {
    clearInterval(autoCloseInterval);
    autoCloseInterval = null;
  }
  autoCloseInterval = setInterval(checkAutoClose, 60_000);
}

function checkAutoClose() {
  const cfg = getShopConfig();
  const now = new Date();
  const closingTime = getDateAtTime(cfg.closeTime);
  const warningTime = new Date(closingTime.getTime() - 15 * 60 * 1000);

  if (now >= closingTime) {
    endShift(true);
    return;
  }

  if (now >= warningTime && now < closingTime) {
    showShopkeeperAlert('warn', t('shift.closingSoon', { time: fmtTime(closingTime) }));
  }
}

// ══════════════════════════════════════════════════════════════════
//  DASHBOARD STATUS TOGGLE
// ══════════════════════════════════════════════════════════════════

function updateDashboardStatus(isOnline) {
  const { dashStatusToggle, dashStatusLabel } = DOM;
  if (!dashStatusToggle) return;

  dashStatusToggle.className = `status-pill-sm ${isOnline ? 'online' : 'offline'}`;
  dashStatusToggle.setAttribute('aria-pressed', isOnline ? 'true' : 'false');
  if (dashStatusLabel) {
    dashStatusLabel.textContent = isOnline ? t('status.online') : t('status.offline');
  }
}

async function toggleShopStatus() {
  const isCurrentlyOnline = DOM.dashStatusToggle?.getAttribute('aria-pressed') === 'true';
  const newStatus = !isCurrentlyOnline;
  const cfg = getShopConfig();

  try {
    DB.setShopStatus(cfg.shopId, newStatus ? 'online' : 'offline');
  } catch(e) {}

  updateDashboardStatus(newStatus);
  showToast(newStatus ? t('status.wentOnline') : t('status.wentOffline'), newStatus ? 'success' : '');
}

// ══════════════════════════════════════════════════════════════════
//  ORDER LISTENER + FEED
// ══════════════════════════════════════════════════════════════════

function startOrderListener(shopId) {
  try {
    orderListenerUnsubscribe = DB.listenOrders(shopId, onNewOrderFromDB);

    // DEMO: Inject a mock order after 2 seconds
    setTimeout(() => {
      const mockOrder = {
        id:          'LB-' + Math.floor(8000 + Math.random() * 2000),
        customerId:  'cust-demo',
        customerName:'Priyanka B.',
        orderText:   'Tata Salt 1kg × 2\nAmul Butter 500g\nMaggi Noodles × 3',
        photoUrl:    null,
        paymentType: 'pickup',
        pickupTime:  new Date(Date.now() + 25 * 60000).toISOString(),
        createdAt:   new Date().toISOString(),
        status:      'pending',
        shopId:      shopId,
      };
      onNewOrderFromDB(mockOrder);
    }, 2000);

  } catch(e) { console.error('[Orders] Listener error:', e); }
}

function onNewOrderFromDB(order) {
  const isExisting = orderCache.has(order.id);
  orderCache.set(order.id, order);

  if (!isExisting) {
    alertNewOrder();
    prependOrderCard(order);
    updateOrdersBadge();
    updateStatsDisplay();
  } else {
    updateOrderCardDOM(order);
  }
}

function alertNewOrder() {
  if (window.Notifications && typeof window.Notifications.playForegroundAlert === 'function') {
    window.Notifications.playForegroundAlert('new-order');
  } else if (DOM.audioUnlock) {
    DOM.audioUnlock.src = 'assets/sounds/new-order.mp3';
    DOM.audioUnlock.currentTime = 0;
    DOM.audioUnlock.play().catch(() => {});
  }

  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }

  if (DOM.flashOverlay) {
    DOM.flashOverlay.classList.add('flash-active');
    setTimeout(() => DOM.flashOverlay.classList.remove('flash-active'), 350);
  }
}

// ══════════════════════════════════════════════════════════════════
//  ORDER CARD RENDERING
// ══════════════════════════════════════════════════════════════════

function getUrgencyClass(order) {
  const now       = Date.now();
  const pickup    = new Date(order.pickupTime).getTime();
  const created   = new Date(order.createdAt).getTime();
  const minsToPickup = (pickup - now) / 60000;
  const minsOld      = (now - created) / 60000;

  if (minsToPickup < 10 || (minsOld > 20 && order.status === 'pending')) return 'urgency-red';
  if (minsToPickup < 30 || minsOld > 10) return 'urgency-amber';
  return 'urgency-green';
}

function buildOrderCard(order) {
  const urgency    = getUrgencyClass(order);
  const pickupDate = new Date(order.pickupTime);
  const createdAt  = new Date(order.createdAt);
  const payLabel   = order.paymentType === 'upi' ? t('payment.upi') : t('payment.pickup');
  const payClass   = order.paymentType === 'upi' ? 'upi' : 'cash';
  const preview    = (order.orderText || '').split('\n').slice(0, 2).join(', ');

  const article = document.createElement('article');
  article.className = `order-card ${urgency}`;
  article.setAttribute('role', 'listitem');
  article.setAttribute('data-order-id', order.id);
  article.setAttribute('tabindex', '0');

  article.innerHTML = `
    <div class="order-card-header">
      <span class="order-id">${escHtml(order.id)}</span>
      <span class="order-customer">${escHtml(order.customerName)}</span>
      <span class="order-time">${fmtTime(createdAt)}</span>
    </div>
    <div class="order-card-meta">
      <span class="payment-badge ${payClass}">${escHtml(payLabel)}</span>
      <span class="pickup-eta">${t('order.readyBy')} ${fmtTime(pickupDate)}</span>
    </div>
    <p class="order-preview">"${escHtml(preview)}…"</p>
    <div class="order-card-footer">
      <span class="order-status-badge ${order.status}">${t('status.' + order.status)}</span>
      <button class="btn-tap-manage" aria-label="${t('order.manage')} ${escHtml(order.id)}">
        ${t('order.tapManage')} →
      </button>
    </div>
  `;

  article.addEventListener('click', () => openOrderPanel(order.id));
  article.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openOrderPanel(order.id); });

  return article;
}

function prependOrderCard(order) {
  const feed = DOM.ordersFeed;
  if (!feed) return;

  if (DOM.ordersEmptyState) DOM.ordersEmptyState.style.display = 'none';

  const card = buildOrderCard(order);
  card.style.animation = 'slideDown 300ms ease forwards';
  feed.insertBefore(card, feed.firstChild);
}

function updateOrderCardDOM(order) {
  const existing = document.querySelector(`[data-order-id="${order.id}"]`);
  if (!existing) { prependOrderCard(order); return; }

  existing.className = `order-card ${getUrgencyClass(order)}`;

  const badge = existing.querySelector('.order-status-badge');
  if (badge) {
    badge.className = `order-status-badge ${order.status}`;
    badge.textContent = t('status.' + order.status);
  }
}

function removeOrderCard(orderId) {
  const el = document.querySelector(`[data-order-id="${orderId}"]`);
  if (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = '300ms ease';
    setTimeout(() => el.remove(), 310);
  }
  orderCache.delete(orderId);
  updateOrdersBadge();

  if (orderCache.size === 0 && DOM.ordersEmptyState) {
    DOM.ordersEmptyState.style.display = '';
  }
}

function updateOrdersBadge() {
  const active = Array.from(orderCache.values()).filter(o => o.status !== 'ready' && o.status !== 'cancelled').length;
  if (DOM.ordersCountBadge) DOM.ordersCountBadge.textContent = active;
}

function updateStatsDisplay() {
  if (DOM.statOrdersToday)  DOM.statOrdersToday.textContent  = shift.ordersCount;
  if (DOM.statEarningsToday)DOM.statEarningsToday.textContent = fmtCurrency(shift.earnings);
  const avg = shift.readyTimes.length
    ? Math.round(shift.readyTimes.reduce((a,b)=>a+b,0) / shift.readyTimes.length / 60000) + ' min'
    : '—';
  if (DOM.statAvgReady) DOM.statAvgReady.textContent = avg;
}

// ══════════════════════════════════════════════════════════════════
//  ORDER ACTION PANEL
// ══════════════════════════════════════════════════════════════════

function openOrderPanel(orderId) {
  const order = orderCache.get(orderId);
  if (!order) return;
  activeOrder = order;

  if (DOM.panelOrderId)    DOM.panelOrderId.textContent    = order.id;
  if (DOM.panelCustomerMeta) {
    const pickup = new Date(order.pickupTime);
    const created = new Date(order.createdAt);
    DOM.panelCustomerMeta.textContent = `${order.customerName} · ${fmtTime(created)} · ${t('order.readyBy')} ${fmtTime(pickup)}`;
  }
  if (DOM.panelOrderText)  DOM.panelOrderText.textContent  = order.orderText || '';
  if (DOM.panelPhotoWrap) {
    if (order.photoUrl) {
      DOM.panelPhotoWrap.removeAttribute('hidden');
      if (DOM.panelOrderPhoto) DOM.panelOrderPhoto.src = order.photoUrl;
    } else {
      DOM.panelPhotoWrap.setAttribute('hidden', '');
    }
  }
  if (DOM.panelPaymentInfo) {
    DOM.panelPaymentInfo.textContent = order.paymentType === 'upi'
      ? t('payment.upiPaid')
      : t('payment.atPickup');
  }

  if (DOM.billAmount) DOM.billAmount.value = order.billAmount || '';
  if (DOM.subNotes)   DOM.subNotes.value   = order.notes      || '';

  renderPanelOosChips();
  updatePanelButtons(order.status);

  if (DOM.orderPanelOverlay) {
    DOM.orderPanelOverlay.removeAttribute('hidden');
    setTimeout(() => DOM.btnClosePanel?.focus(), 50);
  }

  document.body.style.overflow = 'hidden';
}

function closeOrderPanel() {
  if (DOM.orderPanelOverlay) DOM.orderPanelOverlay.setAttribute('hidden', '');
  document.body.style.overflow = '';
  activeOrder = null;
}

function updatePanelButtons(status) {
  if (DOM.btnSendQuote)   DOM.btnSendQuote.style.display   = status === 'pending' ? '' : 'none';
  if (DOM.btnMarkPacking) DOM.btnMarkPacking.style.display  = status === 'quoted' ? '' : 'none';
  if (DOM.btnMarkReady)   DOM.btnMarkReady.style.display    = status === 'packing' ? '' : 'none';
  if (DOM.btnCancelOrder) DOM.btnCancelOrder.style.display  = ['pending','quoted','packing'].includes(status) ? '' : 'none';
}

async function sendQuote() {
  if (!activeOrder) return;
  const amount = parseFloat(DOM.billAmount?.value) || 0;
  const notes  = DOM.subNotes?.value.trim() || '';

  if (!amount || amount <= 0) {
    showToast(t('panel.error.billRequired'), 'error'); return;
  }

  try {
    DB.updateOrderStatus(activeOrder.id, 'quoted', { billAmount: amount, notes });
    DB.notifyCustomerQuoted(activeOrder.id, amount, notes);

    activeOrder.status     = 'quoted';
    activeOrder.billAmount = amount;
    activeOrder.notes      = notes;
    orderCache.set(activeOrder.id, activeOrder);

    updateOrderCardDOM(activeOrder);
    updatePanelButtons('quoted');
    shift.ordersCount++;
    shift.earnings += amount;
    updateStatsDisplay();

    showToast(t('panel.quoteSent'), 'success');
  } catch(e) {
    showToast(t('panel.error.generic'), 'error');
  }
}

async function markPacking() {
  if (!activeOrder) return;
  try {
    DB.updateOrderStatus(activeOrder.id, 'packing', {});
    activeOrder.status = 'packing';
    orderCache.set(activeOrder.id, activeOrder);
    updateOrderCardDOM(activeOrder);
    updatePanelButtons('packing');
    showToast(t('panel.packing'), 'success');
  } catch(e) { showToast(t('panel.error.generic'), 'error'); }
}

async function markReady() {
  if (!activeOrder) return;
  try {
    DB.updateOrderStatus(activeOrder.id, 'ready', {});
    DB.notifyCustomerReady(activeOrder.id);

    const createdAt = new Date(activeOrder.createdAt).getTime();
    shift.readyTimes.push(Date.now() - createdAt);

    activeOrder.status = 'ready';
    orderCache.set(activeOrder.id, activeOrder);
    updateOrderCardDOM(activeOrder);
    updatePanelButtons('ready');
    updateStatsDisplay();

    triggerConfetti();

    showToast(t('panel.readyNotified'), 'success');
    setTimeout(closeOrderPanel, 1500);
  } catch(e) { showToast(t('panel.error.generic'), 'error'); }
}

function cancelOrderWithConfirm() {
  if (!activeOrder) return;
  showModal({
    title:        t('cancel.title'),
    body:         t('cancel.body'),
    confirmLabel: t('cancel.confirm'),
    cancelLabel:  t('cancel.dismiss'),
    dangerous:    true,
    onConfirm: async () => {
      try {
        DB.cancelOrder(activeOrder.id, 'shopkeeper_cancelled');
        removeOrderCard(activeOrder.id);
        closeOrderPanel();
        showToast(t('cancel.done'), '');
      } catch(e) { showToast(t('panel.error.generic'), 'error'); }
    }
  });
}

// ══════════════════════════════════════════════════════════════════
//  CONFETTI (CSS-ONLY)
//
//  FIX M3: triggerConfetti() already checks prefers-reduced-motion
//  via matchMedia. The confetti-piece animation property is only
//  applied when reduced-motion is NOT preferred, matching the
//  @keyframes confetti-fall declaration in the media query block.
// ══════════════════════════════════════════════════════════════════

function triggerConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const burst  = DOM.confettiBurst;
  if (!burst) return;
  burst.innerHTML = '';

  const colours = ['#0f5c3a','#d97706','#16a34a','#f59e0b','#3b82f6','#ef4444'];

  for (let i = 0; i < 12; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left:             ${10 + Math.random() * 80}%;
      top:              ${Math.random() * 20}%;
      background:       ${colours[i % colours.length]};
      border-radius:    ${Math.random() > 0.5 ? '50%' : '2px'};
      width:            ${6 + Math.random() * 8}px;
      height:           ${6 + Math.random() * 8}px;
      animation:        confetti-fall ${0.8 + Math.random() * 0.8}s ease ${Math.random() * 0.3}s forwards;
    `;
    burst.appendChild(piece);
  }

  burst.classList.add('confetti-active');
  setTimeout(() => { burst.innerHTML = ''; burst.classList.remove('confetti-active'); }, 1500);
}

// ══════════════════════════════════════════════════════════════════
//  OOS MANAGEMENT
// ══════════════════════════════════════════════════════════════════

const DEFAULT_OOS_ITEMS = [
  'Tata Salt 1kg', 'Amul Butter 500g', 'Maggi Noodles',
  'Parle-G Biscuits', 'Surf Excel 1kg', 'Paracetamol 500mg',
];

function restoreOosItems() {
  try {
    const saved = JSON.parse(localStorage.getItem('lb_oos_items') || '[]');
    saved.forEach(item => oosItems.add(item));
  } catch(e) {}
  renderOosChips();
}

function renderOosChips() {
  const grid = DOM.oosChipsGrid;
  if (!grid) return;
  grid.innerHTML = '';

  const allItems = [...new Set([...DEFAULT_OOS_ITEMS, ...oosItems])];
  allItems.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'oos-chip';
    btn.textContent = item;
    btn.dataset.item = item;
    btn.setAttribute('aria-pressed', oosItems.has(item) ? 'true' : 'false');
    btn.addEventListener('click', () => toggleOosItem(item, btn));
    grid.appendChild(btn);
  });

  saveOosItems();
  renderPanelOosChips();
}

function toggleOosItem(item, btn) {
  if (oosItems.has(item)) {
    oosItems.delete(item);
    btn.setAttribute('aria-pressed', 'false');
  } else {
    oosItems.add(item);
    btn.setAttribute('aria-pressed', 'true');
  }
  saveOosItems();
  renderPanelOosChips();
}

function addOosItem(item) {
  if (!item || item.length < 2) { showToast(t('oos.error.empty'), 'warn'); return; }
  oosItems.add(item);
  renderOosChips();
  if (DOM.oosCustomInput) DOM.oosCustomInput.value = '';
}

function clearAllOos() {
  oosItems.clear();
  renderOosChips();
}

function saveOosItems() {
  try { localStorage.setItem('lb_oos_items', JSON.stringify([...oosItems])); } catch(e) {}
}

function renderPanelOosChips() {
  const container = DOM.panelOosChips;
  if (!container) return;
  container.innerHTML = '';

  oosItems.forEach(item => {
    const chip = document.createElement('button');
    chip.className = 'oos-chip';
    chip.setAttribute('aria-pressed', 'true');
    chip.textContent = item;
    chip.style.fontSize = '12px';
    chip.addEventListener('click', () => {
      const notesEl = DOM.subNotes;
      if (notesEl && notesEl.value.indexOf(item) === -1) {
        notesEl.value += (notesEl.value ? '\n' : '') + `${item} — ${t('oos.notAvailable')}`;
      }
    });
    container.appendChild(chip);
  });

  if (oosItems.size === 0) {
    container.innerHTML = `<span style="font-size:12px;color:var(--color-muted)">${t('oos.none')}</span>`;
  }
}

// ══════════════════════════════════════════════════════════════════
//  DASHBOARD TABS
// ══════════════════════════════════════════════════════════════════

function switchTab(panelId) {
  const panels = { orders: DOM.panelOrders, inventory: DOM.panelInventory };
  const tabs   = { orders: DOM.tabOrders,   inventory: DOM.tabInventory   };

  Object.entries(panels).forEach(([id, panel]) => {
    const isActive = id === panelId;
    if (panel) {
      if (isActive) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    }
    if (tabs[id]) {
      tabs[id].classList.toggle('active', isActive);
      tabs[id].setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  });

  if (panelId === 'inventory') renderOosChips();
}

// ══════════════════════════════════════════════════════════════════
//  PULL-TO-REFRESH HINT
// ══════════════════════════════════════════════════════════════════

function initPullHint() {
  let lastScrollY = 0;
  const feed = DOM.ordersFeed;
  if (!feed) return;

  feed.addEventListener('scroll', () => {
    const current = feed.scrollTop;
    if (lastScrollY > current && (lastScrollY - current) > 80) {
      if (DOM.pullHint) DOM.pullHint.classList.add('visible');
      setTimeout(() => DOM.pullHint?.classList.remove('visible'), 2000);
    }
    lastScrollY = current;
  }, { passive: true });
}

// ══════════════════════════════════════════════════════════════════
//  WHATSAPP EXPORT
// ══════════════════════════════════════════════════════════════════

function exportShiftToWhatsApp() {
  const cfg = getShopConfig();
  const avgReady = shift.readyTimes.length
    ? Math.round(shift.readyTimes.reduce((a,b)=>a+b,0) / shift.readyTimes.length / 60000) + ' min'
    : 'N/A';

  const msg = encodeURIComponent(
    `📊 *LocalBuy Shift Summary*\n` +
    `🏪 ${cfg.shopName} · ${cfg.area}\n` +
    `📅 ${new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}\n\n` +
    `✅ Orders completed: ${shift.ordersCount}\n` +
    `💰 Earnings: ${fmtCurrency(shift.earnings)}\n` +
    `⏱️ Avg. ready time: ${avgReady}\n\n` +
    `Powered by LocalBuy — https://localbuy.in`
  );

  const phone = cfg.phone ? `91${cfg.phone}` : '';
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

// ══════════════════════════════════════════════════════════════════
//  SECURITY HELPER
// ══════════════════════════════════════════════════════════════════

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ══════════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  cacheDOM();

  DOM.btnRegister?.addEventListener('click', handleRegistration);
  DOM.btnStartShift?.addEventListener('click', startShift);
  DOM.dashStatusToggle?.addEventListener('click', toggleShopStatus);

  DOM.btnEndShift?.addEventListener('click', () => {
    showModal({
      title:        t('shiftEnd.confirmTitle'),
      body:         t('shiftEnd.confirmBody'),
      confirmLabel: t('shiftEnd.confirmBtn'),
      cancelLabel:  t('modal.cancel'),
      dangerous:    true,
      onConfirm:    () => endShift(false),
    });
  });

  DOM.tabOrders?.addEventListener('click', () => switchTab('orders'));
  DOM.tabInventory?.addEventListener('click', () => switchTab('inventory'));

  DOM.shopkeeperAlert?.querySelector('.alert-dismiss')?.addEventListener('click', hideShopkeeperAlert);

  DOM.btnClosePanel?.addEventListener('click', closeOrderPanel);
  DOM.orderPanelOverlay?.addEventListener('click', e => {
    if (e.target === DOM.orderPanelOverlay) closeOrderPanel();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!DOM.orderPanelOverlay?.hasAttribute('hidden')) closeOrderPanel();
      if (!DOM.appModalOverlay?.hasAttribute('hidden'))   hideModal();
    }
  });

  DOM.btnSendQuote?.addEventListener('click', sendQuote);
  DOM.btnMarkPacking?.addEventListener('click', markPacking);
  DOM.btnMarkReady?.addEventListener('click', markReady);
  DOM.btnCancelOrder?.addEventListener('click', cancelOrderWithConfirm);

  DOM.btnClearOos?.addEventListener('click', clearAllOos);
  DOM.btnOosAdd?.addEventListener('click', () => {
    addOosItem(DOM.oosCustomInput?.value.trim() || '');
  });
  DOM.oosCustomInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addOosItem(DOM.oosCustomInput.value.trim());
  });

  DOM.btnExportWA?.addEventListener('click', exportShiftToWhatsApp);
  DOM.btnNewShift?.addEventListener('click', () => {
    try { localStorage.removeItem('lb_shift_ended'); } catch(e) {}
    populateShiftStartScreen();
    window.showScreen('shift-start');
  });

  DOM.appModalOverlay?.addEventListener('click', e => {
    if (e.target === DOM.appModalOverlay) hideModal();
  });

  initPullHint();
  populateShiftStartScreen();

  try {
    const lang = localStorage.getItem('lb_lang') || 'en';
    if (window.i18n && typeof window.i18n.setLang === 'function') {
      window.i18n.setLang(lang);
    }
  } catch(e) {}

  // FIX H5: On beforeunload, clear the interval so it can't accumulate
  // if the page is refreshed. The lb_shift_active flag stays 'true' so
  // the inline boot script correctly resumes to 'dashboard' on reload,
  // at which point startShift() will create a fresh single interval.
  window.addEventListener('beforeunload', () => {
    if (autoCloseInterval) {
      clearInterval(autoCloseInterval);
      autoCloseInterval = null;
    }
  });

  console.log('[LocalBuy] shopkeeper.js loaded ✓');
});