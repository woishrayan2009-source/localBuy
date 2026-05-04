/**
 * LocalBuy — shopkeeper.js
 * Full SPA logic for shopkeeper.html
 *
 * Sections:
 *   #shift-start     → Pre-shift screen (shown on load)
 *   #section-dashboard → Main order feed
 *   #section-order-panel → Full-screen order action panel (bottom sheet)
 *   #shift-end       → Shift summary
 *
 * All UI text goes through i18n.js (window.i18n / window.t)
 * DB calls go through db-bridge.js (window.DB)
 * Shared utilities: window.LB (app.js)
 *
 * NEVER hardcode English text directly here. Use i18n.t('key') always.
 */

'use strict';

// ─── Shopkeeper State ─────────────────────────────────────────────────────────
const SK = {
  shopId: 's1',                      // TODO: Load from auth session
  shopName: 'Sharma General Store',  // TODO: Load from auth session
  ownerName: 'Rajesh',               // TODO: Load from auth session
  ownerPhone: '91XXXXXXXXXX',        // TODO: Load from authenticated user profile
  lang: localStorage.getItem('lb_lang') || 'en',

  shift: {
    active: false,
    startTime: null,
    ordersCompleted: 0,
    totalEarnings: 0,
    fulfillmentTimes: []
  },

  orders: [],           // Live order list
  activeOrderId: null,  // Currently open in panel
  oosItems: [],         // Out-of-stock items (cleared end of shift)

  shopConfig: {
    closingHour: 21,    // 9 PM — TODO: Load from shop profile
    closingMinute: 0
  },

  unsubscribeOrders: null,  // Cleanup fn for DB listener
  autoCloseInterval: null
};

// ─── Mock Orders (for demo) ───────────────────────────────────────────────────
// TODO: Replace with real-time DB listener (DB.listenOrders)
const MOCK_ORDERS = [
  {
    id: 'LB-8472',
    customerName: 'Priyanka B.',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    pickupTime: new Date(Date.now() + 18 * 60000).toISOString(),
    paymentMethod: 'cash',
    status: 'pending',
    orderText: 'Tata Salt 1kg × 2\nAmul Butter 500g\nMaggi Noodles × 3\nAashirvaad Atta 5kg',
    uploadedPhoto: null,
    note: 'Please keep at the counter, I\'ll arrive by 1 PM.'
  },
  {
    id: 'LB-9123',
    customerName: 'Arjun D.',
    createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
    pickupTime: new Date(Date.now() + 40 * 60000).toISOString(),
    paymentMethod: 'upi',
    status: 'quoted',
    orderText: 'Parle-G Biscuits × 4\nTata Tea Gold 250g\nDettol Soap × 3',
    uploadedPhoto: null,
    note: '',
    quote: { amount: 247, notes: 'Tata Tea Gold 250g out of stock — added Wagh Bakri 250g ✓' }
  }
];

// ─── Language Setup ───────────────────────────────────────────────────────────
function initLanguage() {
  if (window.i18n) {
    window.i18n.setLang(SK.lang);
  }

  const langBtns = document.querySelectorAll('.lang-btn');
  langBtns.forEach(btn => {
    if (btn.dataset.lang === SK.lang) btn.classList.add('active');
    btn.addEventListener('click', () => {
      SK.lang = btn.dataset.lang;
      localStorage.setItem('lb_lang', SK.lang);
      if (window.i18n) window.i18n.setLang(SK.lang);
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Re-render current section
      renderCurrentSection();
    });
  });
}

function t(key, params) {
  if (window.i18n) return window.i18n.t(key, params);
  return key; // fallback
}

// ─── Section Navigation ───────────────────────────────────────────────────────
function skNavigate(sectionId) {
  document.querySelectorAll('[data-sk-section]').forEach(s => {
    s.style.display = 'none';
    s.setAttribute('aria-hidden', 'true');
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = 'block';
    target.removeAttribute('aria-hidden');
    window.scrollTo(0, 0);
  }
}

function renderCurrentSection() {
  if (!SK.shift.active) {
    renderShiftStart();
  } else {
    renderDashboard();
  }
}

// ─── Shift Start (#shift-start) ──────────────────────────────────────────────
function renderShiftStart() {
  skNavigate('shift-start');

  const el = document.getElementById('shift-start');
  if (!el) return;

  const greeting = getGreeting();

  el.innerHTML = `
    <div class="shift-start-inner">
      <div class="shift-greeting">
        <div class="shop-logo-circle" aria-hidden="true">🛒</div>
        <h1 class="shift-welcome" data-i18n="shift.welcome">
          ${t('shift.welcome', { name: SK.ownerName })}
        </h1>
        <p class="shift-greeting-sub muted">${greeting}</p>
      </div>

      <div class="shift-status-pill offline-pill" role="status">
        <span aria-hidden="true">🔴</span>
        <span data-i18n="shift.offlineLabel">${t('shift.offlineLabel')}</span>
      </div>

      <p class="shift-desc muted" data-i18n="shift.offlineDesc">
        ${t('shift.offlineDesc')}
      </p>

      <button id="btn-start-shift" class="btn btn-primary btn-large" style="width:100%; margin-top:32px" aria-label="${t('shift.startBtn')}">
        ${t('shift.startBtn')}
      </button>

      <!-- Hidden audio for autoplay unlock -->
      <audio id="audio-unlock" preload="auto" aria-hidden="true">
        <!-- TODO: Replace data URI with actual MP3 file -->
        <source src="assets/sounds/new-order.mp3" type="audio/mpeg">
      </audio>
    </div>
  `;

  document.getElementById('btn-start-shift')?.addEventListener('click', startShift);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return t('greeting.morning');
  if (h < 17) return t('greeting.afternoon');
  return t('greeting.evening');
}

function startShift() {
  // 1. Unlock browser autoplay policy with silent audio
  const audio = document.getElementById('audio-unlock');
  if (audio) {
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(e => console.warn('[SK] Audio unlock failed:', e));
  }

  // 2. Set shift active
  SK.shift.active = true;
  SK.shift.startTime = new Date();

  // 3. Update shop status online
  window.DB.setShopStatus(SK.shopId, 'online');

  // 4. Start auto-close guard
  startAutoCloseGuard();

  // 5. Navigate to dashboard
  renderDashboard();
  startOrderListener();

  LB.analytics('shift_started', { shopId: SK.shopId });
}

// ─── Dashboard (#section-dashboard) ──────────────────────────────────────────
function renderDashboard() {
  skNavigate('section-dashboard');

  const el = document.getElementById('section-dashboard');
  if (!el) return;

  el.innerHTML = `
    <div class="sk-topbar">
      <div class="sk-shop-info">
        <span class="sk-shop-name">${SK.shopName}</span>
        <button class="status-toggle online" id="btn-status-toggle" aria-pressed="true" aria-label="${t('dashboard.goOffline')}">
          <span class="live-dot" aria-hidden="true"></span>
          <span data-i18n="dashboard.online">${t('dashboard.online')}</span>
        </button>
      </div>
      <button class="btn btn-danger-outline btn-sm" id="btn-end-shift">
        ${t('dashboard.endShift')}
      </button>
    </div>

    <div class="sk-stats-row" aria-label="${t('dashboard.statsLabel')}">
      <div class="sk-stat">
        <span class="sk-stat-value" id="stat-orders">${SK.shift.ordersCompleted}</span>
        <span class="sk-stat-label muted" data-i18n="dashboard.ordersToday">${t('dashboard.ordersToday')}</span>
      </div>
      <div class="sk-stat">
        <span class="sk-stat-value" id="stat-earnings">${LB.formatINR(SK.shift.totalEarnings)}</span>
        <span class="sk-stat-label muted" data-i18n="dashboard.earningsToday">${t('dashboard.earningsToday')}</span>
      </div>
      <div class="sk-stat">
        <span class="sk-stat-value" id="stat-ready-time">
          ${SK.shift.fulfillmentTimes.length
            ? Math.round(SK.shift.fulfillmentTimes.reduce((a,b) => a+b, 0) / SK.shift.fulfillmentTimes.length) + ' min'
            : '—'}
        </span>
        <span class="sk-stat-label muted" data-i18n="dashboard.avgReadyTime">${t('dashboard.avgReadyTime')}</span>
      </div>
    </div>

    <div class="sk-orders-header">
      <h2 class="sk-section-title" data-i18n="dashboard.activeOrders">${t('dashboard.activeOrders')}</h2>
      <span class="sk-order-count" id="order-count-badge" aria-live="polite">${SK.orders.length}</span>
    </div>

    <div id="orders-feed" class="orders-feed" role="list" aria-label="${t('dashboard.activeOrders')}">
      ${SK.orders.length === 0 ? renderEmptyFeed() : ''}
    </div>

    <!-- Audio element (unlocked in startShift) -->
    <audio id="audio-unlock" preload="auto" aria-hidden="true">
      <source src="assets/sounds/new-order.mp3" type="audio/mpeg">
    </audio>
  `;

  // Render existing mock orders
  SK.orders = [...MOCK_ORDERS];
  SK.orders.forEach(order => appendOrderCard(order, false));

  // Wire buttons
  document.getElementById('btn-status-toggle')?.addEventListener('click', toggleShopStatus);
  document.getElementById('btn-end-shift')?.addEventListener('click', promptEndShift);
}

function renderEmptyFeed() {
  return `
    <div class="empty-feed" role="status">
      <span class="empty-feed-icon" aria-hidden="true">⏳</span>
      <p class="empty-feed-title" data-i18n="dashboard.noOrders">${t('dashboard.noOrders')}</p>
      <p class="muted" data-i18n="dashboard.noOrdersDesc">${t('dashboard.noOrdersDesc')}</p>
    </div>
  `;
}

// ─── Order Cards ──────────────────────────────────────────────────────────────
function appendOrderCard(order, animate = true) {
  const feed = document.getElementById('orders-feed');
  if (!feed) return;

  // Remove empty state if present
  const emptyState = feed.querySelector('.empty-feed');
  if (emptyState) emptyState.remove();

  const card = createOrderCard(order);
  if (animate) {
    card.style.animation = 'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards';
    feed.prepend(card);
  } else {
    feed.appendChild(card);
  }

  updateOrderCount();
}

function createOrderCard(order) {
  const card = document.createElement('div');
  card.className = `order-card urgency-${getUrgencyLevel(order)}`;
  card.setAttribute('data-order-id', order.id);
  card.setAttribute('role', 'listitem');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Order ${order.id} from ${order.customerName}, ${getStatusLabel(order.status)}`);

  const createdAt = new Date(order.createdAt);
  const pickupAt  = new Date(order.pickupTime);
  const timeAgo   = getTimeAgo(createdAt);
  const pickupStr = LB.formatTime(pickupAt);

  const payLabel = order.paymentMethod === 'upi' ? t('order.payUPI') : t('order.payCash');

  card.innerHTML = `
    <div class="order-card-top">
      <div class="order-id-customer">
        <span class="order-id" aria-label="Order ${order.id}">${order.id}</span>
        <span class="order-separator" aria-hidden="true">·</span>
        <span class="order-customer">${order.customerName}</span>
      </div>
      <span class="order-time muted">${timeAgo}</span>
    </div>
    <div class="order-card-meta">
      <span class="order-payment-badge">${payLabel}</span>
      <span class="order-pickup-time">
        ${t('order.readyBy')} ${pickupStr}
      </span>
    </div>
    <p class="order-preview-text">"${truncate(order.orderText, 80)}"</p>
    <div class="order-card-footer">
      <span class="order-status-label status-${order.status}">${getStatusLabel(order.status)}</span>
      <button class="btn-text-sage order-manage-btn">
        ${t('order.tapToManage')} →
      </button>
    </div>
  `;

  function openPanel() { openOrderPanel(order.id); }
  card.addEventListener('click', openPanel);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPanel(); });

  return card;
}

function getUrgencyLevel(order) {
  const pickupAt = new Date(order.pickupTime);
  const now = new Date();
  const createdAt = new Date(order.createdAt);
  const minutesToPickup = (pickupAt - now) / 60000;
  const minutesSinceCreated = (now - createdAt) / 60000;

  if (minutesToPickup < 10 || (minutesSinceCreated > 20 && order.status === 'pending')) return 'red';
  if (minutesToPickup < 30 || minutesSinceCreated > 10) return 'amber';
  return 'green';
}

function getStatusLabel(status) {
  const labels = {
    pending: t('status.pending'),
    quoted:  t('status.quoted'),
    packing: t('status.packing'),
    ready:   t('status.ready'),
    cancelled: t('status.cancelled'),
    completed: t('status.completed')
  };
  return labels[status] || status;
}

function getTimeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 60000);
  if (diff < 1) return t('time.justNow');
  if (diff < 60) return `${diff} ${t('time.minAgo')}`;
  return LB.formatTime(date);
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function updateOrderCount() {
  const badge = document.getElementById('order-count-badge');
  if (badge) badge.textContent = SK.orders.length;
}

// ─── Incoming Order Alert ─────────────────────────────────────────────────────
// Called by DB listener when a new order arrives
function onNewOrderReceived(order) {
  SK.orders.unshift(order);
  appendOrderCard(order, true);

  // 1. Play audio
  if (window.playForegroundAlert) window.playForegroundAlert('new-order');

  // 2. Vibrate
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

  // 3. Flash screen
  flashScreen();

  // 4. Show toast
  LB.toast(`${t('alert.newOrder')} — ${order.customerName}`, 'success');

  // 5. Web Push if page not focused
  if (document.hidden && window.showPushNotification) {
    window.showPushNotification({
      title: t('notification.newOrder.title'),
      body: t('notification.newOrder.body'),
      tag: 'new-order-' + order.id,
      actionUrl: '/shopkeeper.html'
    });
  }

  LB.analytics('new_order_received', { orderId: order.id, shopId: SK.shopId });
}

function flashScreen() {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed; inset: 0; background: white; opacity: 0.7;
    pointer-events: none; z-index: 9990;
    animation: flashFade 0.3s ease forwards;
  `;
  flash.setAttribute('aria-hidden', 'true');
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 350);

  if (!document.getElementById('lb-flash-style')) {
    const style = document.createElement('style');
    style.id = 'lb-flash-style';
    style.textContent = `
      @keyframes flashFade { from { opacity: 0.7; } to { opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { @keyframes flashFade { from { opacity: 0; } to { opacity: 0; } } }
    `;
    document.head.appendChild(style);
  }
}

// ─── Order Action Panel (full-screen bottom sheet) ────────────────────────────
function openOrderPanel(orderId) {
  const order = SK.orders.find(o => o.id === orderId);
  if (!order) return;
  SK.activeOrderId = orderId;

  const panel = document.getElementById('order-panel');
  if (!panel) return;

  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'panel-order-id');

  panel.innerHTML = `
    <div class="panel-header">
      <div>
        <h2 id="panel-order-id" class="panel-title">${order.id}</h2>
        <p class="panel-customer muted">${order.customerName} · ${getTimeAgo(new Date(order.createdAt))}</p>
      </div>
      <button class="modal-close" id="btn-close-panel" aria-label="${t('panel.close')}">✕</button>
    </div>

    <div class="panel-order-info">
      <div class="panel-pickup-time">
        <span class="panel-meta-label" data-i18n="panel.pickupBy">${t('panel.pickupBy')}</span>
        <strong>${LB.formatTime(new Date(order.pickupTime))}</strong>
      </div>
      ${order.note ? `<div class="panel-customer-note"><span>📝</span> ${order.note}</div>` : ''}
    </div>

    <div class="panel-order-text">
      <label class="panel-section-label" data-i18n="panel.customerOrder">${t('panel.customerOrder')}</label>
      <pre class="panel-order-pre">${order.orderText || ''}</pre>
    </div>

    ${order.uploadedPhoto ? `
      <div class="panel-photo">
        <label class="panel-section-label">${t('panel.customerPhoto')}</label>
        <img src="${order.uploadedPhoto}" alt="Customer's handwritten order" style="width:100%; border-radius:12px; touch-action:pinch-zoom; max-height:280px; object-fit:contain;" loading="lazy">
      </div>
    ` : ''}

    <div class="panel-response">
      <label class="panel-section-label" for="bill-amount" data-i18n="panel.totalBill">${t('panel.totalBill')}</label>
      <div class="input-prefix">
        <span aria-hidden="true">₹</span>
        <input
          type="number"
          id="bill-amount"
          inputmode="decimal"
          placeholder="0.00"
          min="0"
          step="0.50"
          value="${order.quote?.amount || ''}"
          aria-label="${t('panel.totalBill')}"
        >
      </div>

      <label class="panel-section-label" for="sub-notes" data-i18n="panel.notesLabel" style="margin-top:16px">${t('panel.notesLabel')}</label>
      <textarea
        id="sub-notes"
        class="panel-notes-textarea"
        placeholder="${t('panel.notesPlaceholder')}"
        rows="3"
        aria-label="${t('panel.notesLabel')}"
      >${order.quote?.notes || ''}</textarea>

      <div class="oos-section">
        <label class="panel-section-label" data-i18n="panel.oosLabel">${t('panel.oosLabel')}</label>
        <div class="oos-chips" role="group" aria-label="${t('panel.oosLabel')}">
          ${['Tata Salt', 'Amul Butter', 'Maggi', 'Dettol', 'Parle-G', 'Surf Excel'].map(item => `
            <button
              class="oos-chip ${SK.oosItems.includes(item) ? 'oos-active' : ''}"
              data-item="${item}"
              aria-pressed="${SK.oosItems.includes(item)}"
              title="${t('panel.markOOS')}: ${item}"
            >${item}</button>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="panel-actions">
      <button class="btn btn-amber btn-large" id="btn-send-quote" style="width:100%">
        ${t('panel.sendQuote')}
      </button>
      <button class="btn btn-outline btn-large" id="btn-mark-packing" style="width:100%">
        ${t('panel.markPacking')}
      </button>
      <button class="btn btn-primary btn-xl" id="btn-mark-ready" style="width:100%">
        ${t('panel.markReady')} 🎉
      </button>
      <button class="btn-text-danger" id="btn-cancel-panel-order">
        ${t('panel.cancelOrder')}
      </button>
    </div>
  `;

  panel.style.display = 'block';
  requestAnimationFrame(() => panel.classList.add('open'));

  // Wire close button
  document.getElementById('btn-close-panel')?.addEventListener('click', closeOrderPanel);
  panel.addEventListener('click', e => { if (e.target === panel) closeOrderPanel(); });

  // OOS chips
  panel.querySelectorAll('.oos-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const item = chip.dataset.item;
      const idx = SK.oosItems.indexOf(item);
      if (idx === -1) {
        SK.oosItems.push(item);
        chip.classList.add('oos-active');
        chip.setAttribute('aria-pressed', 'true');
        // Append to notes
        const notes = document.getElementById('sub-notes');
        if (notes) notes.value += (notes.value ? '\n' : '') + `${item} — out of stock today`;
      } else {
        SK.oosItems.splice(idx, 1);
        chip.classList.remove('oos-active');
        chip.setAttribute('aria-pressed', 'false');
      }
    });
  });

  // Action buttons
  document.getElementById('btn-send-quote')?.addEventListener('click', () => sendQuote(order));
  document.getElementById('btn-mark-packing')?.addEventListener('click', () => markPacking(order));
  document.getElementById('btn-mark-ready')?.addEventListener('click', () => markReady(order));
  document.getElementById('btn-cancel-panel-order')?.addEventListener('click', () => cancelOrder(order));

  LB.analytics('order_panel_open', { orderId });
}

function closeOrderPanel() {
  const panel = document.getElementById('order-panel');
  if (!panel) return;
  panel.classList.remove('open');
  setTimeout(() => { panel.style.display = 'none'; panel.innerHTML = ''; }, 300);
  SK.activeOrderId = null;
}

// ─── Order Actions ────────────────────────────────────────────────────────────

function sendQuote(order) {
  const amount = parseFloat(document.getElementById('bill-amount')?.value || '0');
  const notes  = document.getElementById('sub-notes')?.value || '';

  if (!amount || amount <= 0) {
    LB.toast(t('panel.amountRequired'), 'warn');
    return;
  }

  order.status = 'quoted';
  order.quote = { amount, notes };

  window.DB.updateOrderStatus(order.id, 'quoted', { amount, notes });
  window.DB.notifyCustomerQuoted(order.id, amount, notes);

  updateOrderCardStatus(order.id, 'quoted');
  LB.toast(`${t('panel.quoteSent')} — ₹${amount}`, 'success');
  closeOrderPanel();
  LB.analytics('quote_sent', { orderId: order.id, amount });
}

function markPacking(order) {
  order.status = 'packing';
  window.DB.updateOrderStatus(order.id, 'packing', {});
  updateOrderCardStatus(order.id, 'packing');
  LB.toast(t('panel.packingStarted'), 'info');
  closeOrderPanel();
  LB.analytics('order_packing', { orderId: order.id });
}

function markReady(order) {
  order.status = 'ready';

  // Record fulfillment time
  const startedAt = new Date(order.createdAt);
  const fulfillmentMin = Math.round((Date.now() - startedAt) / 60000);
  SK.shift.fulfillmentTimes.push(fulfillmentMin);
  SK.shift.ordersCompleted++;
  if (order.quote?.amount) SK.shift.totalEarnings += order.quote.amount;

  window.DB.updateOrderStatus(order.id, 'ready', {});
  window.DB.notifyCustomerReady(order.id);

  updateOrderCardStatus(order.id, 'ready');
  updateStats();

  // Confetti
  triggerShopkeeperConfetti();
  LB.toast(t('panel.orderReady'), 'success');
  closeOrderPanel();
  LB.analytics('order_ready', { orderId: order.id });

  // Play ready sound
  if (window.playForegroundAlert) window.playForegroundAlert('order-ready');
}

function cancelOrder(order) {
  LB.modal({
    title: t('modal.cancelTitle'),
    body: t('modal.cancelBody'),
    confirmLabel: t('modal.cancelConfirm'),
    cancelLabel: t('modal.cancelKeep'),
    dangerous: true,
    onConfirm: () => {
      order.status = 'cancelled';
      window.DB.cancelOrder(order.id, 'Shopkeeper cancelled');
      SK.orders = SK.orders.filter(o => o.id !== order.id);
      removeOrderCard(order.id);
      updateOrderCount();
      closeOrderPanel();
      LB.toast(t('panel.orderCancelled'), 'info');
      LB.analytics('order_cancelled_by_shopkeeper', { orderId: order.id });
    }
  });
}

function updateOrderCardStatus(orderId, newStatus) {
  const card = document.querySelector(`[data-order-id="${orderId}"]`);
  if (!card) return;
  const statusLabel = card.querySelector('.order-status-label');
  if (statusLabel) {
    statusLabel.className = `order-status-label status-${newStatus}`;
    statusLabel.textContent = getStatusLabel(newStatus);
  }
}

function removeOrderCard(orderId) {
  const card = document.querySelector(`[data-order-id="${orderId}"]`);
  if (card) {
    card.style.opacity = '0';
    card.style.transform = 'translateX(-10px)';
    card.style.transition = 'all 0.3s ease';
    setTimeout(() => card.remove(), 300);
  }
}

function updateStats() {
  const ordersEl  = document.getElementById('stat-orders');
  const earningsEl = document.getElementById('stat-earnings');
  const readyEl   = document.getElementById('stat-ready-time');

  if (ordersEl) ordersEl.textContent = SK.shift.ordersCompleted;
  if (earningsEl) earningsEl.textContent = LB.formatINR(SK.shift.totalEarnings);
  if (readyEl) {
    const avg = SK.shift.fulfillmentTimes.length
      ? Math.round(SK.shift.fulfillmentTimes.reduce((a,b) => a+b, 0) / SK.shift.fulfillmentTimes.length)
      : null;
    readyEl.textContent = avg ? avg + ' min' : '—';
  }
}

// ─── Shop Status Toggle ───────────────────────────────────────────────────────
function toggleShopStatus() {
  const btn = document.getElementById('btn-status-toggle');
  if (!btn) return;

  const isOnline = btn.classList.contains('online');
  if (isOnline) {
    LB.modal({
      title: t('modal.goOfflineTitle'),
      body: t('modal.goOfflineBody'),
      confirmLabel: t('modal.goOfflineConfirm'),
      cancelLabel: t('modal.cancel'),
      onConfirm: () => {
        btn.classList.remove('online');
        btn.classList.add('offline');
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = `<span aria-hidden="true">🔴</span> <span>${t('dashboard.offline')}</span>`;
        window.DB.setShopStatus(SK.shopId, 'offline');
        LB.toast(t('alert.shopOffline'), 'warn');
      }
    });
  } else {
    btn.classList.remove('offline');
    btn.classList.add('online');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = `<span class="live-dot" aria-hidden="true"></span> <span>${t('dashboard.online')}</span>`;
    window.DB.setShopStatus(SK.shopId, 'online');
    LB.toast(t('alert.shopOnline'), 'success');
  }
}

// ─── End Shift ────────────────────────────────────────────────────────────────
function promptEndShift() {
  const pendingOrders = SK.orders.filter(o => o.status !== 'ready' && o.status !== 'cancelled').length;

  LB.modal({
    title: t('modal.endShiftTitle'),
    body: pendingOrders > 0
      ? t('modal.endShiftPendingBody', { count: pendingOrders })
      : t('modal.endShiftBody'),
    confirmLabel: t('modal.endShiftConfirm'),
    cancelLabel: t('modal.cancel'),
    dangerous: true,
    onConfirm: endShift
  });
}

function endShift() {
  SK.shift.active = false;
  window.DB.setShopStatus(SK.shopId, 'offline');

  if (SK.autoCloseInterval) clearInterval(SK.autoCloseInterval);
  if (SK.unsubscribeOrders) SK.unsubscribeOrders();

  renderShiftSummary();
  LB.analytics('shift_ended', {
    ordersCompleted: SK.shift.ordersCompleted,
    totalEarnings: SK.shift.totalEarnings
  });
}

// ─── Auto-close Guard ─────────────────────────────────────────────────────────
function startAutoCloseGuard() {
  SK.autoCloseInterval = setInterval(() => {
    const now = new Date();
    const closingTime = new Date();
    closingTime.setHours(SK.shopConfig.closingHour, SK.shopConfig.closingMinute, 0, 0);
    const warningTime = new Date(closingTime.getTime() - 15 * 60000);

    if (now >= warningTime && now < closingTime) {
      LB.toast(t('shift.closingSoon', { time: LB.formatTime(closingTime) }), 'warn');
    }

    if (now >= closingTime) {
      clearInterval(SK.autoCloseInterval);
      endShift();
    }
  }, 60000);
}

// ─── Order Listener ───────────────────────────────────────────────────────────
function startOrderListener() {
  // TODO: Replace with real Firebase real-time listener:
  // SK.unsubscribeOrders = window.DB.listenOrders(SK.shopId, orders => {
  //   const newOrders = orders.filter(o => !SK.orders.find(existing => existing.id === o.id));
  //   newOrders.forEach(order => onNewOrderReceived(order));
  // });

  // Demo: simulate a new order arriving after 15 seconds
  setTimeout(() => {
    if (SK.shift.active) {
      const demoOrder = {
        id: 'LB-' + Math.floor(Math.random() * 9000 + 1000),
        customerName: 'Meena K.',
        createdAt: new Date().toISOString(),
        pickupTime: new Date(Date.now() + 25 * 60000).toISOString(),
        paymentMethod: 'cash',
        status: 'pending',
        orderText: 'Dettol Hand Wash 250ml × 2\nColgate Toothpaste 150g\nSurf Excel 1kg',
        note: '',
        uploadedPhoto: null
      };
      onNewOrderReceived(demoOrder);
    }
  }, 15000);
}

// ─── Shift Summary (#shift-end) ───────────────────────────────────────────────
function renderShiftSummary() {
  skNavigate('shift-end');

  const el = document.getElementById('shift-end');
  if (!el) return;

  const pendingOrders = SK.orders.filter(o => o.status !== 'ready' && o.status !== 'cancelled');
  const avgTime = SK.shift.fulfillmentTimes.length
    ? Math.round(SK.shift.fulfillmentTimes.reduce((a,b) => a+b, 0) / SK.shift.fulfillmentTimes.length)
    : 0;

  el.innerHTML = `
    <div class="shift-summary-inner">
      <div class="summary-header">
        <span class="summary-icon" aria-hidden="true">🏁</span>
        <h1 class="summary-title" data-i18n="summary.title">${t('summary.title')}</h1>
        <p class="summary-shop-name">${SK.shopName}</p>
      </div>

      <div class="summary-card">
        <div class="summary-row">
          <span class="summary-label" data-i18n="summary.ordersCompleted">${t('summary.ordersCompleted')}</span>
          <strong class="summary-value">${SK.shift.ordersCompleted}</strong>
        </div>
        <div class="summary-row">
          <span class="summary-label" data-i18n="summary.totalEarnings">${t('summary.totalEarnings')}</span>
          <strong class="summary-value">${LB.formatINR(SK.shift.totalEarnings)}</strong>
        </div>
        <div class="summary-row">
          <span class="summary-label" data-i18n="summary.avgTime">${t('summary.avgTime')}</span>
          <strong class="summary-value">${avgTime ? avgTime + ' min' : '—'}</strong>
        </div>
      </div>

      ${pendingOrders.length > 0 ? `
        <div class="pending-warning" role="alert">
          <span aria-hidden="true">⚠️</span>
          <p>${t('summary.pendingWarning', { count: pendingOrders.length })}</p>
        </div>
      ` : ''}

      <button class="btn btn-wa btn-large" id="btn-export-summary" style="width:100%; margin-top:24px">
        📤 ${t('summary.exportWA')}
      </button>

      <button class="btn btn-outline btn-large" id="btn-new-shift" style="width:100%; margin-top:12px">
        ${t('summary.startNewShift')}
      </button>
    </div>
  `;

  document.getElementById('btn-export-summary')?.addEventListener('click', exportSummaryToWhatsApp);
  document.getElementById('btn-new-shift')?.addEventListener('click', () => {
    // Reset shift state
    SK.shift = { active: false, startTime: null, ordersCompleted: 0, totalEarnings: 0, fulfillmentTimes: [] };
    SK.orders = [];
    renderShiftStart();
  });
}

function exportSummaryToWhatsApp() {
  const avgTime = SK.shift.fulfillmentTimes.length
    ? Math.round(SK.shift.fulfillmentTimes.reduce((a,b) => a+b, 0) / SK.shift.fulfillmentTimes.length)
    : 0;

  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const msg = encodeURIComponent(
    `📊 *LocalBuy — Shift Summary*\n${SK.shopName}\n${date}\n\n` +
    `✅ Orders completed: ${SK.shift.ordersCompleted}\n` +
    `💰 Total earnings: ${LB.formatINR(SK.shift.totalEarnings)}\n` +
    `⏱️ Avg. ready time: ${avgTime ? avgTime + ' min' : 'N/A'}\n\n` +
    `Powered by LocalBuy 🛒 localbuy.in`
  );

  // Open WhatsApp to shop owner's own number
  // TODO: Use authenticated phone number from shop profile — never hardcode
  window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
  LB.analytics('shift_summary_exported');
}

// ─── Confetti (CSS-only) ──────────────────────────────────────────────────────
function triggerShopkeeperConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  container.setAttribute('aria-hidden', 'true');
  const colors = ['#0f5c3a', '#d97706', '#16a34a', '#fbbf24', '#059669', '#f59e0b'];
  for (let i = 0; i < 20; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%; background: ${colors[i % colors.length]};
      animation-delay: ${Math.random() * 0.4}s;
      animation-duration: ${0.7 + Math.random() * 0.7}s;
      width: ${6 + Math.random() * 6}px; height: ${6 + Math.random() * 6}px;
    `;
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 2500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLanguage();

  // Start at shift-start screen
  renderShiftStart();

  console.log('[LocalBuy] shopkeeper.js initialised');
});