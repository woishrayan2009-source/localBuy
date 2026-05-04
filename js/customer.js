/**
 * LocalBuy — customer.js
 * Full SPA logic for customer.html
 *
 * Sections (shown/hidden via navigate()):
 *   #section-browse   → Shop grid with search + category filters
 *   #section-modal    → Shop welcome card (full-screen bottom sheet)
 *   #section-order    → Order interface (type list or upload photo)
 *   #section-checkout → Payment selection + order confirmation
 *   #section-tracker  → Live order status tracker
 *
 * All DB calls go through db-bridge.js (window.DB)
 * All shared utilities: window.LB (app.js)
 * Translations: window.i18n (i18n.js)
 */

'use strict';

// ─── Mock Shop Data ───────────────────────────────────────────────────────────
// Hardcoded for MVP. TODO: Replace with DB.getShops() call.
const MOCK_SHOPS = [
  {
    id: 's1',
    name: 'Sharma General Store',
    category: 'kirana',
    emoji: '🛒',
    distance: '0.3 km',
    ready: '8 min',
    status: 'open',
    hours: '7:00 AM – 9:00 PM',
    lastOrder: '8:30 PM',
    rating: 4.8,
    ratingCount: 23,
    upiId: 'sharma@upi', // TODO: UPI VPA must be resolved server-side; never expose in frontend JS in production
    requiresPrePayment: false,
    announcement: '🎉 Fresh samosas every evening after 5 PM!',
    area: 'Fancy Bazar',
    reviews: [
      { name: 'Priyanka B.', rating: 5, text: 'Always fresh stock. Rajesh bhaiya is very helpful.' },
      { name: 'Arjun D.', rating: 5, text: 'Quick service. Ordered online and collected in 7 minutes.' },
      { name: 'Meena K.', rating: 4, text: 'Good variety. Wish they had more organic options.' }
    ]
  },
  {
    id: 's2',
    name: 'City Medical Hall',
    category: 'chemist',
    emoji: '💊',
    distance: '0.5 km',
    ready: '5 min',
    status: 'busy',
    hours: '8:00 AM – 10:00 PM',
    lastOrder: '9:45 PM',
    rating: 4.6,
    ratingCount: 41,
    upiId: 'citymedical@upi',
    requiresPrePayment: false,
    announcement: null,
    area: 'Pan Bazar',
    reviews: [
      { name: 'Rituraj S.', rating: 5, text: 'Best chemist in Pan Bazar. They keep all medicines.' },
      { name: 'Alina H.', rating: 4, text: 'Busy most times but the staff is knowledgeable.' },
      { name: 'Dipak N.', rating: 5, text: 'Ordered before leaving office. Ready when I arrived.' }
    ]
  },
  {
    id: 's3',
    name: 'Maa Kamakhya Bakery',
    category: 'bakery',
    emoji: '🎂',
    distance: '0.8 km',
    ready: '12 min',
    status: 'open',
    hours: '6:00 AM – 8:00 PM',
    lastOrder: '7:30 PM',
    rating: 4.9,
    ratingCount: 67,
    upiId: 'kamakhyabakery@upi',
    requiresPrePayment: false,
    announcement: '🎉 Fresh momo every Saturday morning!',
    area: 'Paltan Bazar',
    reviews: [
      { name: 'Sanjay R.', rating: 5, text: 'Best bread in Guwahati. Their momo is legendary.' },
      { name: 'Preeti A.', rating: 5, text: 'Order the pork momo — absolutely worth it.' },
      { name: 'Kabir J.', rating: 4, text: 'Great bakery. Slightly long wait but quality is top.' }
    ]
  },
  {
    id: 's4',
    name: 'Krishna Dairy Corner',
    category: 'dairy',
    emoji: '🥛',
    distance: '1.1 km',
    ready: '6 min',
    status: 'closed',
    hours: '5:00 AM – 1:00 PM',
    lastOrder: '12:45 PM',
    rating: 4.7,
    ratingCount: 18,
    upiId: 'krishnadairy@upi',
    requiresPrePayment: false,
    announcement: null,
    area: 'Ulubari',
    reviews: [
      { name: 'Binu T.', rating: 5, text: 'Freshest milk in Ulubari. Opens 5 AM sharp.' },
      { name: 'Mita G.', rating: 5, text: 'Best paneer I\'ve had. Pre-order recommended.' },
      { name: 'Hemanta B.', rating: 4, text: 'Only wish they stayed open a bit longer.' }
    ]
  }
];

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  shops: [...MOCK_SHOPS],
  filteredShops: [...MOCK_SHOPS],
  activeCategory: 'all',
  searchQuery: '',
  selectedShop: null,
  currentOrder: null,
  orderHistory: [],
  currentSection: 'section-browse',
  orderStatusInterval: null,
  selectedPaymentMethod: null,
  selectedTimeSlot: 'asap',
  uploadedPhoto: null,
  activeTab: 'text'
};

// Mock order status progression for demo
const ORDER_STAGES = ['pending', 'quoted', 'packing', 'ready'];

// ─── Navigation (SPA) ─────────────────────────────────────────────────────────
function navigate(sectionId) {
  // Hide all sections
  document.querySelectorAll('[data-section]').forEach(section => {
    section.style.display = 'none';
    section.setAttribute('aria-hidden', 'true');
  });

  // Show target section
  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = 'block';
    target.removeAttribute('aria-hidden');
    target.scrollTop = 0;
    state.currentSection = sectionId;
    window.scrollTo(0, 0);
  } else {
    console.warn('[Customer] Section not found:', sectionId);
  }
}

// ─── Shop Browse (#section-browse) ───────────────────────────────────────────

function initBrowse() {
  // Load shops from DB (stubbed)
  // TODO: DB.getShops().then(shops => { state.shops = shops; renderShopGrid(); })
  renderShopGrid();
  initCategoryChips();
  initSearchBar();
  initGPSSort();
}

function renderShopGrid() {
  const grid = document.getElementById('shop-grid');
  if (!grid) return;

  LB.showSkeletonCards(grid, 4);

  // Simulate async load (would be DB call in production)
  setTimeout(() => {
    grid.innerHTML = '';

    if (state.filteredShops.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" role="status">
          <div class="empty-state-icon" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="80" height="80" rx="20" fill="var(--color-sage-light)"/>
              <rect x="20" y="30" width="40" height="5" rx="2.5" fill="var(--color-sage)" opacity="0.3"/>
              <rect x="20" y="40" width="30" height="5" rx="2.5" fill="var(--color-sage)" opacity="0.2"/>
              <rect x="20" y="50" width="35" height="5" rx="2.5" fill="var(--color-sage)" opacity="0.15"/>
            </svg>
          </div>
          <p class="empty-state-title">No shops found</p>
          <p class="empty-state-body">Try a different category or search term.</p>
        </div>
      `;
      return;
    }

    state.filteredShops.forEach(shop => {
      const card = createShopCard(shop);
      grid.appendChild(card);
    });
  }, 400);
}

function createShopCard(shop) {
  const card = document.createElement('div');
  card.className = 'shop-card';
  card.setAttribute('data-category', shop.category);
  card.setAttribute('data-shop-id', shop.id);
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${shop.name}, ${shop.distance} away, ${shop.status}`);

  const statusLabel = { open: 'Open', busy: 'Busy', closed: 'Closed' }[shop.status];
  const statusClass = `status-${shop.status}`;

  card.innerHTML = `
    <div class="shop-card-icon" aria-hidden="true">${shop.emoji}</div>
    <div class="shop-card-body">
      <h3 class="shop-card-name">${shop.name}</h3>
      <p class="shop-card-meta">${shop.distance} · Ready in ${shop.ready}</p>
    </div>
    <span class="status-badge ${statusClass}" aria-label="Status: ${statusLabel}">
      <span class="status-dot" aria-hidden="true"></span>
      ${statusLabel}
    </span>
  `;

  // Click / keyboard open
  function openShop(e) {
    e.preventDefault();
    openShopModal(shop.id);
  }
  card.addEventListener('click', openShop);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openShop(e); });

  return card;
}

function filterShops() {
  state.filteredShops = state.shops.filter(shop => {
    const matchCategory = state.activeCategory === 'all' || shop.category === state.activeCategory;
    const q = state.searchQuery.toLowerCase();
    const matchSearch = !q
      || shop.name.toLowerCase().includes(q)
      || shop.category.toLowerCase().includes(q)
      || shop.area.toLowerCase().includes(q);
    return matchCategory && matchSearch;
  });

  // Animate filter transition
  const grid = document.getElementById('shop-grid');
  if (grid) {
    grid.style.opacity = '0';
    grid.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      renderShopGrid();
      grid.style.opacity = '1';
    }, 200);
  }
}

function initCategoryChips() {
  const chips = document.querySelectorAll('.category-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeCategory = chip.dataset.category || 'all';
      filterShops();
    });
  });
}

function initSearchBar() {
  const searchInput = document.getElementById('shop-search');
  if (!searchInput) return;

  const debouncedFilter = LB.debounce(() => {
    state.searchQuery = searchInput.value;
    filterShops();
  }, 300);

  searchInput.addEventListener('input', debouncedFilter);
}

function initGPSSort() {
  const gpsBtn = document.getElementById('btn-gps-sort');
  if (!gpsBtn) return;

  gpsBtn.addEventListener('click', async () => {
    gpsBtn.disabled = true;
    gpsBtn.textContent = '📍 Locating…';

    try {
      const loc = await window.getUserLocation();
      if (window.isInGuwahati(loc)) {
        // TODO: Sort by actual distance from loc when real coordinates available
        // For now, MOCK_SHOPS are already sorted by distance
        LB.toast('Sorted by your distance in Guwahati!', 'success');
        LB.analytics('gps_sort_success');
      } else {
        showLocationBanner('Location detected but you\'re outside Guwahati. Showing all shops.');
        LB.analytics('gps_outside_guwahati');
      }
    } catch (err) {
      showLocationBanner('Location not detected — showing all shops.');
      console.warn('[Customer] GPS failed:', err);
    }

    gpsBtn.disabled = false;
    gpsBtn.textContent = '📍 Near me';
  });
}

function showLocationBanner(message) {
  const existing = document.getElementById('location-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'location-banner';
  banner.className = 'location-banner';
  banner.setAttribute('role', 'status');
  banner.textContent = message;
  document.getElementById('section-browse')?.prepend(banner);

  setTimeout(() => banner.remove(), 5000);
}

// ─── Shop Modal (#section-modal) ──────────────────────────────────────────────

function openShopModal(shopId) {
  const shop = state.shops.find(s => s.id === shopId);
  if (!shop) return;
  state.selectedShop = shop;

  renderShopModal(shop);
  navigate('section-modal');
  LB.analytics('shop_modal_open', { shopId, shopName: shop.name });
}

function renderShopModal(shop) {
  const modal = document.getElementById('section-modal');
  if (!modal) return;

  const shopStatus = LB.getShopStatus(shop);
  const ctaHTML = buildModalCTA(shop, shopStatus);
  const announcementHTML = shop.announcement
    ? `<div class="shop-announcement" role="note">📢 ${shop.announcement}</div>`
    : '';

  modal.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="modal-shop-name">
      <div class="modal-header">
        <div class="modal-shop-identity">
          <span class="modal-shop-emoji" aria-hidden="true">${shop.emoji}</span>
          <div>
            <h2 id="modal-shop-name" class="modal-shop-name">${shop.name}</h2>
            <span class="category-pill">${shop.category}</span>
          </div>
        </div>
        <button class="modal-close" aria-label="Close shop details" onclick="navigate('section-browse')">✕</button>
      </div>

      ${announcementHTML}

      <div class="shop-hours-block">
        <div class="hours-row">
          <span class="hours-label">Open today</span>
          <span class="hours-value">${shop.hours}</span>
        </div>
        <div class="hours-row">
          <span class="hours-label">Last order</span>
          <span class="last-order-pill">${shop.lastOrder}</span>
        </div>
      </div>

      ${ctaHTML}

      <div class="ratings-block">
        <div class="ratings-header">
          <span class="rating-stars" aria-label="${shop.rating} out of 5 stars">
            ${'★'.repeat(Math.floor(shop.rating))}${shop.rating % 1 >= 0.5 ? '½' : ''}
          </span>
          <span class="rating-score">${shop.rating}</span>
          <span class="rating-count muted">${shop.ratingCount} ratings</span>
          <button class="reviews-toggle" aria-expanded="false" aria-controls="reviews-list">
            See reviews ▾
          </button>
        </div>
        <div id="reviews-list" class="reviews-list" hidden>
          ${shop.reviews.slice(0, 3).map(r => `
            <div class="review-card">
              <div class="review-header">
                <span class="review-avatar" aria-hidden="true">${r.name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                <div>
                  <span class="review-name">${r.name}</span>
                  <span class="review-stars" aria-label="${r.rating} stars">${'★'.repeat(r.rating)}</span>
                </div>
              </div>
              <p class="review-text">"${r.text}"</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="trust-badges" aria-label="Accepted payment methods and features">
        <span class="trust-badge">✓ UPI accepted</span>
        <span class="trust-badge">✓ Cash accepted</span>
        <span class="trust-badge">✓ SMS notification</span>
      </div>
    </div>
  `;

  // Wire reviews toggle
  const reviewsToggle = modal.querySelector('.reviews-toggle');
  const reviewsList   = modal.querySelector('#reviews-list');
  if (reviewsToggle && reviewsList) {
    reviewsToggle.addEventListener('click', () => {
      const expanded = reviewsToggle.getAttribute('aria-expanded') === 'true';
      reviewsToggle.setAttribute('aria-expanded', String(!expanded));
      reviewsList.hidden = expanded;
      reviewsToggle.textContent = expanded ? 'See reviews ▾' : 'Hide reviews ▴';
    });
  }

  // Wire CTA buttons (dynamic, based on status)
  const placeOrderBtn  = modal.querySelector('#btn-place-order');
  const preOrderBtn    = modal.querySelector('#btn-pre-order');

  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', () => {
      navigate('section-order');
      renderOrderInterface(shop, false);
    });
  }

  if (preOrderBtn) {
    preOrderBtn.addEventListener('click', () => {
      state.currentOrder = { scheduledDate: getTomorrow(), isPreOrder: true };
      navigate('section-order');
      renderOrderInterface(shop, true);
    });
  }
}

function buildModalCTA(shop, status) {
  if (status === 'open') {
    return `
      <button id="btn-place-order" class="btn btn-primary btn-large" style="width:100%">
        Place Order
      </button>
    `;
  }
  if (status === 'closing-soon') {
    return `
      <button id="btn-place-order" class="btn btn-busy btn-large btn-pulse" style="width:100%">
        ⚡ Order Now (Closing Soon!)
      </button>
    `;
  }
  // post-buffer or closed
  return `
    <div class="closed-notice" role="alert">
      <span class="closed-icon">🔴</span>
      <span>Shop is closed for today</span>
    </div>
    <button id="btn-pre-order" class="btn btn-outline btn-large" style="width:100%">
      Pre-order for Tomorrow
    </button>
  `;
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// ─── Order Interface (#section-order) ────────────────────────────────────────

function renderOrderInterface(shop, isPreOrder = false) {
  const section = document.getElementById('section-order');
  if (!section) return;

  const preOrderBanner = isPreOrder
    ? `<div class="pre-order-banner" role="note">📅 Pre-ordering for tomorrow — the shop will start packing in the morning.</div>`
    : '';

  section.innerHTML = `
    <div class="order-topbar">
      <button class="btn-icon" data-action="back-to-modal" aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="order-shop-name">${shop.name}</span>
      <button class="btn-text-muted" id="btn-clear-order">Clear</button>
    </div>

    ${preOrderBanner}

    <div class="order-tabs" role="tablist">
      <button class="order-tab active" role="tab" aria-selected="true" aria-controls="tab-text" id="tab-btn-text">
        📝 Type your list
      </button>
      <button class="order-tab" role="tab" aria-selected="false" aria-controls="tab-photo" id="tab-btn-photo">
        📷 Upload photo
      </button>
    </div>

    <div id="tab-text" role="tabpanel" aria-labelledby="tab-btn-text">
      <div class="textarea-wrapper">
        <textarea
          id="order-text"
          class="order-textarea"
          placeholder="Type your items here, one per line.&#10;&#10;Example:&#10;Tata Salt 1kg × 2&#10;Amul Butter 500g&#10;Maggi Noodles × 3"
          rows="8"
          maxlength="1000"
          aria-label="Your order list"
        ></textarea>
        <div class="textarea-footer">
          <span id="char-count" class="char-count">0 / 1000</span>
          <span class="textarea-tip">Tip: Add quantity for faster service</span>
        </div>
      </div>
    </div>

    <div id="tab-photo" role="tabpanel" aria-labelledby="tab-btn-photo" hidden>
      <label class="upload-zone" for="photo-upload" id="upload-label">
        <span class="upload-icon" aria-hidden="true">📷</span>
        <span class="upload-title">Take a photo of your handwritten list</span>
        <span class="upload-subtitle">Tap to open camera or choose a file</span>
        <input
          type="file"
          id="photo-upload"
          accept="image/*"
          capture="environment"
          class="visually-hidden"
          aria-label="Upload a photo of your shopping list"
        >
      </label>
      <div id="photo-preview" class="photo-preview" hidden aria-live="polite"></div>
      <p class="upload-note">Our shopkeeper will read and confirm your list.</p>
    </div>

    <div class="pickup-time-section">
      <h3 class="section-label">When will you walk in?</h3>
      <div class="time-slots" role="group" aria-label="Pickup time">
        <button class="time-slot active" data-slot="asap" aria-pressed="true">As soon as ready</button>
        ${generateTimeSlots(shop)}
      </div>
    </div>

    <div class="order-note-section">
      <label for="order-note" class="section-label">Any special requests?</label>
      <textarea
        id="order-note"
        class="order-note-textarea"
        placeholder="e.g., Please keep the items at the counter. I'll arrive by 3 PM."
        rows="3"
        aria-label="Special requests (optional)"
      ></textarea>
    </div>

    <div class="order-history-section">
      <button class="collapsible-header" aria-expanded="false" aria-controls="past-orders-list">
        <span>Your past orders</span>
        <span class="collapsible-icon" aria-hidden="true">▾</span>
      </button>
      <div id="past-orders-list" hidden>
        ${renderPastOrders()}
      </div>
    </div>

    <div class="sticky-bottom">
      <button id="btn-review-order" class="btn btn-primary btn-large" style="width:100%" disabled>
        Review Order →
      </button>
    </div>
  `;

  initOrderInterface(shop);
}

function generateTimeSlots(shop) {
  const slots = [];
  const now = new Date();
  const { hours, minutes } = LB.parseTime(shop.lastOrder);
  const lastOrder = new Date();
  lastOrder.setHours(hours, minutes, 0, 0);

  // Start 20 min from now, every 15 min
  let slotTime = new Date(now.getTime() + 20 * 60000);
  // Round up to next 15-min boundary
  slotTime.setMinutes(Math.ceil(slotTime.getMinutes() / 15) * 15, 0, 0);

  for (let i = 0; i < 12; i++) {
    const isPast = slotTime > lastOrder;
    const label = LB.formatTime(slotTime);
    const value = slotTime.toISOString();

    slots.push(`
      <button
        class="time-slot ${isPast ? 'disabled' : ''}"
        data-slot="${value}"
        ${isPast ? 'disabled aria-disabled="true"' : ''}
        aria-pressed="false"
      >${label}</button>
    `);

    slotTime = LB.addMinutes(slotTime, 15);
  }

  return slots.join('');
}

function renderPastOrders() {
  const history = JSON.parse(localStorage.getItem('lb_order_history') || '[]');
  if (!history.length) return '<p class="muted" style="padding: 12px 0; font-size: 14px;">No past orders yet.</p>';

  return history.slice(0, 3).map(order => `
    <div class="past-order-card">
      <div class="past-order-header">
        <span class="past-order-shop">${order.shopName}</span>
        <span class="past-order-date muted">${new Date(order.createdAt).toLocaleDateString('en-IN')}</span>
      </div>
      <p class="past-order-text">${order.orderText?.slice(0, 80)}${order.orderText?.length > 80 ? '…' : ''}</p>
      <button class="btn-text-sage past-order-reorder" data-order-text="${encodeURIComponent(order.orderText || '')}">
        Re-order this →
      </button>
    </div>
  `).join('');
}

function initOrderInterface(shop) {
  // Tab switching
  const tabBtns  = document.querySelectorAll('.order-tab');
  const tabPanels = document.querySelectorAll('[role="tabpanel"]');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(p => p.hidden = true);

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panelId = btn.getAttribute('aria-controls');
      const panel = document.getElementById(panelId);
      if (panel) panel.hidden = false;

      state.activeTab = panelId === 'tab-text' ? 'text' : 'photo';
    });
  });

  // Character count
  const textarea  = document.getElementById('order-text');
  const charCount = document.getElementById('char-count');
  const reviewBtn = document.getElementById('btn-review-order');

  if (textarea) {
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = `${len} / 1000`;
      reviewBtn.disabled = len === 0 && !state.uploadedPhoto;
    });
  }

  // Photo upload
  const photoUpload  = document.getElementById('photo-upload');
  const photoPreview = document.getElementById('photo-preview');

  if (photoUpload) {
    photoUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        state.uploadedPhoto = ev.target.result;
        photoPreview.hidden = false;
        photoPreview.innerHTML = `
          <img src="${ev.target.result}" alt="Your uploaded shopping list" style="width:100%; border-radius:12px; max-height:240px; object-fit:cover;">
          <button class="btn-text-muted" id="btn-remove-photo" style="margin-top:8px">Remove photo</button>
        `;
        reviewBtn.disabled = false;
        document.getElementById('btn-remove-photo')?.addEventListener('click', () => {
          state.uploadedPhoto = null;
          photoPreview.hidden = true;
          photoUpload.value = '';
          reviewBtn.disabled = !textarea?.value;
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Time slot selection
  const timeSlots = document.querySelectorAll('.time-slot:not(.disabled)');
  timeSlots.forEach(slot => {
    slot.addEventListener('click', () => {
      timeSlots.forEach(s => { s.classList.remove('active'); s.setAttribute('aria-pressed', 'false'); });
      slot.classList.add('active');
      slot.setAttribute('aria-pressed', 'true');
      state.selectedTimeSlot = slot.dataset.slot;
    });
  });

  // Review order button
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      const orderText = textarea?.value || '';
      state.currentOrder = {
        ...state.currentOrder,
        shopId: shop.id,
        shopName: shop.name,
        shopEmoji: shop.emoji,
        orderText,
        uploadedPhoto: state.uploadedPhoto,
        pickupTime: state.selectedTimeSlot,
        note: document.getElementById('order-note')?.value || '',
        createdAt: new Date().toISOString()
      };
      navigate('section-checkout');
      renderCheckout(shop);
    });
  }

  // Back button
  document.querySelector('[data-action="back-to-modal"]')?.addEventListener('click', () => {
    navigate('section-modal');
  });

  // Clear button
  document.getElementById('btn-clear-order')?.addEventListener('click', () => {
    LB.modal({
      title: 'Clear order?',
      body: 'This will remove everything you\'ve typed.',
      confirmLabel: 'Clear',
      cancelLabel: 'Keep editing',
      dangerous: true,
      onConfirm: () => {
        if (textarea) { textarea.value = ''; charCount.textContent = '0 / 1000'; }
        state.uploadedPhoto = null;
        if (photoPreview) photoPreview.hidden = true;
        reviewBtn.disabled = true;
      }
    });
  });

  // Collapsible past orders
  const collapsible = document.querySelector('.collapsible-header');
  const pastList    = document.getElementById('past-orders-list');
  collapsible?.addEventListener('click', () => {
    const expanded = collapsible.getAttribute('aria-expanded') === 'true';
    collapsible.setAttribute('aria-expanded', String(!expanded));
    if (pastList) pastList.hidden = expanded;
    collapsible.querySelector('.collapsible-icon').textContent = expanded ? '▾' : '▴';
  });

  // Re-order buttons (inside past orders)
  document.querySelectorAll('.past-order-reorder').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = decodeURIComponent(btn.dataset.orderText || '');
      if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input'));
        textarea.focus();
        // Switch to text tab
        document.getElementById('tab-btn-text')?.click();
      }
    });
  });
}

// ─── Checkout (#section-checkout) ────────────────────────────────────────────

function renderCheckout(shop) {
  const section = document.getElementById('section-checkout');
  if (!section) return;

  const order = state.currentOrder;
  const previewHtml = order.uploadedPhoto
    ? `<img src="${order.uploadedPhoto}" alt="Your shopping list photo" class="checkout-photo" loading="lazy">`
    : '';

  section.innerHTML = `
    <div class="checkout-topbar">
      <button class="btn-icon" data-action="back-to-order" aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="checkout-title">Review & Pay</span>
    </div>

    <div class="order-summary-card">
      <div class="summary-shop">
        <span class="summary-emoji" aria-hidden="true">${shop.emoji}</span>
        <div>
          <h3 class="summary-shop-name">${shop.name}</h3>
          <p class="summary-meta muted">
            ${order.pickupTime === 'asap' ? 'As soon as ready' : 'Pickup at ' + LB.formatTime(new Date(order.pickupTime))}
          </p>
        </div>
      </div>

      ${order.orderText ? `<div class="summary-items">
        <p class="summary-label">Your list</p>
        <pre class="order-text-preview">${order.orderText}</pre>
      </div>` : ''}

      ${previewHtml}
    </div>

    <div class="estimated-total-notice" role="note">
      <span class="notice-icon" aria-hidden="true">ℹ️</span>
      <p>The shopkeeper will confirm the exact total and flag anything out of stock before you pay.</p>
    </div>

    <div class="payment-section">
      <h3 class="payment-title">How will you pay?</h3>

      <label class="payment-card" data-method="cash">
        <input type="radio" name="payment" value="cash" class="visually-hidden" aria-label="Pay at pickup — cash or UPI when you collect">
        <span class="payment-card-inner">
          <span class="payment-icon" aria-hidden="true">💵</span>
          <div class="payment-details">
            <span class="payment-name">Pay at Pickup</span>
            <span class="payment-sub muted">Cash or UPI when you collect</span>
          </div>
          <span class="payment-radio-mark" aria-hidden="true"></span>
        </span>
      </label>

      <label class="payment-card" data-method="upi">
        <input type="radio" name="payment" value="upi" class="visually-hidden" aria-label="Pay now via UPI — secured, instant confirmation">
        <span class="payment-card-inner">
          <span class="payment-icon" aria-hidden="true">
            <!-- UPI SVG Logo -->
            <svg width="32" height="20" viewBox="0 0 80 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="80" height="48" rx="8" fill="var(--color-upi, #5f259f)"/>
              <text x="40" y="32" text-anchor="middle" fill="white" font-family="DM Sans, sans-serif" font-weight="700" font-size="18">UPI</text>
            </svg>
          </span>
          <div class="payment-details">
            <span class="payment-name">Pay Now via UPI</span>
            <span class="payment-sub muted">Secured · Instant confirmation</span>
          </div>
          <span class="payment-radio-mark" aria-hidden="true"></span>
        </span>
      </label>

      <!-- UPI app options (shown when UPI is selected) -->
      <div id="upi-apps" class="upi-apps" hidden aria-live="polite">
        <p class="upi-apps-label">Choose your UPI app:</p>
        <div class="upi-apps-grid">
          ${['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Other UPI'].map(app => `
            <button class="upi-app-btn" data-app="${app}" aria-label="Pay with ${app}">
              <span class="upi-app-emoji" aria-hidden="true">${getUPIAppEmoji(app)}</span>
              <span>${app}</span>
            </button>
          `).join('')}
        </div>
        <div id="upi-waiting" class="upi-waiting" hidden role="status" aria-live="polite">
          <div class="spinner" aria-hidden="true"></div>
          <span>Waiting for payment confirmation…</span>
          <!-- TODO: Verify payment status via backend webhook -->
        </div>
        <div id="qr-fallback" class="qr-fallback" hidden aria-label="QR code for UPI payment">
          <p class="qr-fallback-label">Scan with any UPI app:</p>
          <div class="qr-placeholder" aria-label="UPI QR code — scan with your UPI app">
            <div class="qr-inner"></div>
            <p class="qr-upi-id" id="qr-upi-string"><!-- UPI string injected by JS --></p>
          </div>
        </div>
      </div>
    </div>

    <div class="sticky-bottom">
      <button id="btn-confirm-order" class="btn btn-primary btn-large" style="width:100%" disabled>
        Confirm Order
      </button>
    </div>
  `;

  initCheckout(shop);
}

function getUPIAppEmoji(app) {
  const map = { GPay: '🟢', PhonePe: '💜', Paytm: '🔵', BHIM: '🇮🇳', 'Other UPI': '📱' };
  return map[app] || '📱';
}

function initCheckout(shop) {
  const radios     = document.querySelectorAll('input[name="payment"]');
  const upiApps    = document.getElementById('upi-apps');
  const confirmBtn = document.getElementById('btn-confirm-order');

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      // Remove active from all cards
      document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
      radio.closest('.payment-card').classList.add('selected');

      state.selectedPaymentMethod = radio.value;
      confirmBtn.disabled = false;

      // Show UPI apps if UPI selected
      if (upiApps) upiApps.hidden = radio.value !== 'upi';
    });
  });

  // UPI app buttons
  document.querySelectorAll('.upi-app-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // TODO: UPI VPA must be resolved server-side; never expose in frontend JS in production
      const upiLink = window.buildUPILink({
        pa: shop.upiId,
        pn: shop.name,
        am: state.currentOrder.estimatedAmount || '0',
        tn: 'LocalBuy Order',
        cu: 'INR'
      });
      window.launchUPI(upiLink);

      const upiWaiting = document.getElementById('upi-waiting');
      if (upiWaiting) upiWaiting.hidden = false;
    });
  });

  // Confirm order
  confirmBtn?.addEventListener('click', placeOrder);

  // Back button
  document.querySelector('[data-action="back-to-order"]')?.addEventListener('click', () => {
    navigate('section-order');
    renderOrderInterface(shop, state.currentOrder?.isPreOrder);
  });
}

function placeOrder() {
  const confirmBtn = document.getElementById('btn-confirm-order');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Placing order…';

  // 1. Generate order ID
  const orderId = 'LB' + Math.floor(Math.random() * 9000 + 1000);

  // 2. Build order payload
  const orderPayload = {
    id: orderId,
    ...state.currentOrder,
    paymentMethod: state.selectedPaymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString(),
    // TODO: Customer phone number — encrypt at rest in Firebase, never log to console in production
  };

  // 3. Save to localStorage
  localStorage.setItem('lb_current_order', JSON.stringify(orderPayload));

  // 4. Add to history
  const history = JSON.parse(localStorage.getItem('lb_order_history') || '[]');
  history.unshift(orderPayload);
  localStorage.setItem('lb_order_history', JSON.stringify(history.slice(0, 20)));

  // 5. Send to DB (stubbed)
  window.DB.createOrder(orderPayload).then(() => {
    console.log('[Customer] Order created:', orderId);
  });

  // 6. Request push permission
  if (window.requestPushPermission) {
    window.requestPushPermission().catch(e => console.warn('[Push]', e));
  }

  // 7. Navigate to tracker
  navigate('section-tracker');
  renderTracker(orderPayload);
  LB.analytics('order_placed', { orderId, shopId: orderPayload.shopId });
}

// ─── Order Tracker (#section-tracker) ────────────────────────────────────────

function renderTracker(order) {
  const section = document.getElementById('section-tracker');
  if (!section) return;

  // Demo: start at pending, progress automatically for UX demo
  let currentStage = 0;
  const stages = [
    {
      id: 'pending',
      label: 'Pending Review',
      desc: 'Your order is with the shopkeeper',
      icon: '⏳'
    },
    {
      id: 'quoted',
      label: 'Quoted',
      desc: 'Shopkeeper has confirmed your list',
      icon: '📋',
      extra: `
        <div class="quote-card">
          <div class="quote-row"><span>Total</span><strong>₹347</strong></div>
          <div class="quote-note">Note: No Tata Salt — added Captain Cook 1kg ✓</div>
          <div class="quote-actions">
            <button class="btn btn-primary" id="btn-accept-quote">Accept Quote</button>
            <button class="btn btn-danger-outline" id="btn-cancel-order">Cancel Order</button>
          </div>
        </div>
      `
    },
    {
      id: 'packing',
      label: 'Packing',
      desc: 'Your items are being packed',
      icon: '📦'
    },
    {
      id: 'ready',
      label: 'Ready for Pickup 🎉',
      desc: 'Walk in with your order code',
      icon: '✅'
    }
  ];

  function renderTrackerHTML(activeIdx) {
    const orderId = order.id || 'LB-' + Math.floor(Math.random() * 9000 + 1000);
    const shopName = order.shopName || 'Your Shop';
    const showCode = activeIdx >= 2; // Show at Packing and Ready stages

    return `
      <div class="tracker-topbar">
        <h2 class="tracker-title">Order ${orderId}</h2>
        <p class="tracker-shop muted">${shopName}</p>
      </div>

      <div class="tracker-countdown" role="status" aria-live="polite">
        <span class="countdown-label">Ready in</span>
        <span class="countdown-timer" id="countdown-timer">~8 min</span>
      </div>

      <div class="tracker-timeline" role="list">
        ${stages.map((stage, i) => {
          const isCompleted = i < activeIdx;
          const isActive    = i === activeIdx;
          const isPending   = i > activeIdx;

          return `
            <div class="tracker-stage ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isPending ? 'pending' : ''}"
                 role="listitem" aria-current="${isActive ? 'step' : 'false'}">
              <div class="stage-indicator" aria-hidden="true">
                ${isCompleted ? '✓' : stage.icon}
              </div>
              <div class="stage-body">
                <p class="stage-label ${isActive ? 'active-label' : ''}">${stage.label}</p>
                <p class="stage-desc muted">${stage.desc}</p>
                ${isActive && stage.extra ? stage.extra : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${showCode ? `
        <div class="order-code-card" role="region" aria-label="Your pickup code">
          <p class="order-code-label">Show this at the counter</p>
          <p class="order-code" aria-label="Order code ${orderId}">${orderId}</p>
        </div>
      ` : ''}

      <div class="tracker-actions">
        ${activeIdx === 0 ? `
          <button class="btn btn-danger-outline" id="btn-cancel-tracker" style="width:100%">
            Cancel Order
          </button>
        ` : ''}
        <a href="#section-order" class="btn-text-sage order-again-link" id="btn-order-again">
          Order another item from ${shopName}
        </a>
      </div>
    `;
  }

  section.innerHTML = renderTrackerHTML(currentStage);

  // Wire buttons
  function wireTrackerButtons() {
    document.getElementById('btn-accept-quote')?.addEventListener('click', () => {
      currentStage = 2;
      section.innerHTML = renderTrackerHTML(currentStage);
      wireTrackerButtons();
    });

    document.getElementById('btn-cancel-order')?.addEventListener('click', () => {
      LB.modal({
        title: 'Cancel order?',
        body: 'Are you sure? The shopkeeper will be notified.',
        confirmLabel: 'Yes, cancel',
        cancelLabel: 'Keep order',
        dangerous: true,
        onConfirm: () => {
          window.DB.cancelOrder(order.id, 'Customer cancelled');
          LB.toast('Order cancelled. Your shopkeeper has been notified.', 'info');
          navigate('section-browse');
        }
      });
    });

    document.getElementById('btn-cancel-tracker')?.addEventListener('click', () => {
      LB.modal({
        title: 'Cancel order?',
        body: 'Are you sure? The shopkeeper will be notified.',
        confirmLabel: 'Yes, cancel',
        cancelLabel: 'Keep order',
        dangerous: true,
        onConfirm: () => {
          window.DB.cancelOrder(order.id, 'Customer cancelled');
          LB.toast('Order cancelled.', 'info');
          navigate('section-browse');
        }
      });
    });

    document.getElementById('btn-order-again')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.selectedShop) {
        navigate('section-order');
        renderOrderInterface(state.selectedShop, false);
      } else {
        navigate('section-browse');
      }
    });
  }

  wireTrackerButtons();

  // Countdown timer
  startCountdown(8 * 60);

  // Demo: auto-progress stages after delay (remove in production)
  // TODO: Replace with real-time DB listener: DB.listenOrderStatus(order.id, callback)
  let demoStage = currentStage;
  const demoInterval = setInterval(() => {
    if (demoStage >= stages.length - 1) { clearInterval(demoInterval); return; }
    demoStage++;
    section.innerHTML = renderTrackerHTML(demoStage);
    wireTrackerButtons();
    if (demoStage === stages.length - 1) {
      // Trigger confetti on ready!
      triggerConfetti();
      clearInterval(demoInterval);
    }
  }, 8000);

  state.orderStatusInterval = demoInterval;
}

function startCountdown(seconds) {
  let remaining = seconds;
  const timerEl = document.getElementById('countdown-timer');

  const interval = setInterval(() => {
    if (!timerEl || !document.contains(timerEl)) { clearInterval(interval); return; }
    remaining = Math.max(0, remaining - 1);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    timerEl.textContent = remaining > 60 ? `~${m} min` : `${m}:${s.toString().padStart(2, '0')}`;
    if (remaining === 0) clearInterval(interval);
  }, 1000);
}

function triggerConfetti() {
  // CSS-only confetti burst using injected elements
  const container = document.createElement('div');
  container.className = 'confetti-container';
  container.setAttribute('aria-hidden', 'true');

  const colors = ['#0f5c3a', '#d97706', '#16a34a', '#fbbf24', '#059669'];
  for (let i = 0; i < 30; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.5}s;
      animation-duration: ${0.8 + Math.random() * 0.8}s;
      width: ${6 + Math.random() * 6}px;
      height: ${6 + Math.random() * 6}px;
    `;
    container.appendChild(piece);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 3000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Start at browse section
  navigate('section-browse');
  initBrowse();

  console.log('[LocalBuy] customer.js initialised');
});