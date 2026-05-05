/**
 * customer.js — LocalBuy Customer Hub Logic
 * Handles all customer-facing SPA navigation and interactions:
 *   - Section navigation (navigate())
 *   - Shop browsing, search, filter
 *   - Shop modal (bottom sheet)
 *   - Order interface (type list / photo upload / time slots)
 *   - Checkout (payment selection, UPI deep link)
 *   - Live order tracker (status polling, countdown)
 *
 * Dependencies (load order in HTML):
 *   i18n.js → db-bridge.js → geo.js → upi.js → notifications.js → app.js → customer.js
 *
 * All Firebase calls are in db-bridge.js (DB object).
 * Replace DB.* stubs with real SDK calls there.
 *
 * STATE MODEL:
 *   currentShop   — selected shop object
 *   currentOrder  — in-progress order object (also persisted to localStorage)
 *   orderStatus   — current status from DB listener
 */

'use strict';

/* ─── APP STATE ────────────────────────────────────────────────────── */

const AppState = {
  currentShop:    null,   // { id, name, emoji, category, ... }
  currentOrder:   null,   // { id, shopId, text, photoDataUrl, pickupTime, payment, ... }
  orderStatus:    null,   // 'pending' | 'quoted' | 'packing' | 'ready'
  quoteAmount:    null,   // ₹ amount from shopkeeper
  quoteNotes:     '',     // substitution notes from shopkeeper
  selectedTime:   'asap', // 'asap' | ISO time string
  activeSection:  'browse',
  activeCategory: 'all',
  searchQuery:    '',
  isPreOrder:     false,  // pre-order for tomorrow
  unsubscribeOrders: null // Firestore unsubscribe function
};

/* ─── MOCK SHOP DATA ─────────────────────────────────────────────────
   Hardcoded for now.
   TODO: Replace with DB.getShops() call when Firebase is connected.
   Each shop has a mock announcement and reviews for demo purposes.
*/
const MOCK_SHOPS = [
  {
    id:           's1',
    name:         'Sharma General Store',
    category:     'kirana',
    emoji:        '🛒',
    distance:     '0.3 km',
    ready:        '8 min',
    status:       'open',
    hours:        '7:00 AM – 9:00 PM',
    lastOrder:    '8:30 PM',
    upiId:        'SHOP_UPI_VPA_RESOLVED_SERVER_SIDE', // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    announcement: '🎉 Fresh stock of Assam tea and local jaggery every Monday!',
    rating:       4.8,
    ratingCount:  47,
    reviews: [
      { initials: 'PB', name: 'Priyanka B.',   role: 'Ulubari',         text: 'Ordered before leaving office. Everything was packed. Walked right in.' },
      { initials: 'AM', name: 'Anupam M.',     role: 'Silpukhuri',      text: 'Fast service. Rajesh da keeps the store very organised.' },
      { initials: 'SG', name: 'Sneha G.',      role: 'Pan Bazar',       text: 'Got my monthly grocery list sorted in one go. Recommended!' }
    ]
  },
  {
    id:           's2',
    name:         'City Medical Hall',
    category:     'chemist',
    emoji:        '💊',
    distance:     '0.5 km',
    ready:        '5 min',
    status:       'busy',
    hours:        '8:00 AM – 10:00 PM',
    lastOrder:    '9:45 PM',
    upiId:        'SHOP_UPI_VPA_RESOLVED_SERVER_SIDE', // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    announcement: null,
    rating:       4.6,
    ratingCount:  23,
    reviews: [
      { initials: 'RD', name: 'Rahul D.',      role: 'Fancy Bazar',     text: 'Always has medicines in stock. No hunting around.' },
      { initials: 'MK', name: 'Mitali K.',     role: 'Paltan Bazar',    text: 'They called me when one item was out of stock. Helpful staff.' }
    ]
  },
  {
    id:           's3',
    name:         'Maa Kamakhya Bakery',
    category:     'bakery',
    emoji:        '🎂',
    distance:     '0.8 km',
    ready:        '12 min',
    status:       'open',
    hours:        '6:00 AM – 8:00 PM',
    lastOrder:    '7:30 PM',
    upiId:        'SHOP_UPI_VPA_RESOLVED_SERVER_SIDE', // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    announcement: '🎉 Fresh momo every Saturday morning!',
    rating:       4.9,
    ratingCount:  81,
    reviews: [
      { initials: 'JB', name: 'Jyoti B.',      role: 'Ulubari',         text: 'Best plum cake in all of Guwahati. Period.' },
      { initials: 'NK', name: 'Nilutpal K.',   role: 'Silpukhuri',      text: 'Order at 7 AM, collect by 8. Fresh out of the oven.' },
      { initials: 'PC', name: 'Pallabi C.',    role: 'Pan Bazar',       text: 'Their momo sells out fast — order early!' }
    ]
  },
  {
    id:           's4',
    name:         'Krishna Dairy Corner',
    category:     'dairy',
    emoji:        '🥛',
    distance:     '1.1 km',
    ready:        '6 min',
    status:       'closed',
    hours:        '5:00 AM – 1:00 PM',
    lastOrder:    '12:45 PM',
    upiId:        'SHOP_UPI_VPA_RESOLVED_SERVER_SIDE', // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    announcement: null,
    rating:       4.7,
    ratingCount:  34,
    reviews: [
      { initials: 'AS', name: 'Ankur S.',      role: 'Fancy Bazar',     text: 'Fresh curd every morning. Never missed a day.' },
      { initials: 'DP', name: 'Deepika P.',    role: 'Pan Bazar',       text: 'Pre-order the night before. Perfect for busy mornings.' }
    ]
  }
];

/* ─── SECTION NAVIGATION ────────────────────────────────────────────
   Central navigate(sectionId) function.
   Shows the target section, hides all others.
   Updates header title and back button visibility.
*/

const SECTION_META = {
  browse:   { title: 'Browse Shops',   showBack: false },
  order:    { title: 'Place Order',    showBack: true, backTarget: 'browse' },
  checkout: { title: 'Review & Pay',   showBack: true, backTarget: 'order'  },
  tracker:  { title: 'Order Status',   showBack: false }
};

/**
 * navigate(sectionId) — shows target section, hides all others.
 * @param {string} sectionId — one of: 'browse' | 'order' | 'checkout' | 'tracker'
 */
function navigate(sectionId) {
  // Hide all sections
  document.querySelectorAll('.app-section').forEach(el => {
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  });

  // Show target section
  const target = document.getElementById('section-' + sectionId);
  if (!target) { console.warn('[navigate] Section not found:', sectionId); return; }
  target.style.display = 'block';
  target.removeAttribute('aria-hidden');

  // Update header
  const meta = SECTION_META[sectionId] || {};
  const titleEl = document.getElementById('header-section-title');
  const backBtn = document.getElementById('header-back-btn');
  if (titleEl) titleEl.textContent = meta.title || '';
  if (backBtn) backBtn.style.display = meta.showBack ? 'flex' : 'none';

  AppState.activeSection = sectionId;

  // Scroll to top of section
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Section-specific on-enter hooks
  if (sectionId === 'browse')   onEnterBrowse();
  if (sectionId === 'order')    onEnterOrder();
  if (sectionId === 'checkout') onEnterCheckout();
  if (sectionId === 'tracker')  onEnterTracker();
}

/* ─── SECTION: BROWSE ───────────────────────────────────────────────
   On enter: render shop cards, init search, chips, GPS button.
*/

function onEnterBrowse() {
  renderShopCards(MOCK_SHOPS);
  initSearch();
  initCategoryChips();
  initGPSButton();
}

/**
 * renderShopCards(shops) — renders shop card HTML into #shop-grid.
 * Removes skeleton placeholders on first real render.
 * @param {Array} shops
 */
function renderShopCards(shops) {
  const grid = document.getElementById('shop-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid) return;

  // Remove skeleton cards
  grid.querySelectorAll('.skeleton').forEach(el => el.remove());

  if (shops.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  grid.innerHTML = shops.map(shop => buildShopCardHTML(shop)).join('');

  // Add click handlers to each card
  grid.querySelectorAll('.shop-card').forEach(card => {
    card.addEventListener('click', () => {
      const shopId = card.dataset.shopId;
      const shop = MOCK_SHOPS.find(s => s.id === shopId);
      if (shop) openShopModal(shop);
    });
    // Keyboard support
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

/**
 * buildShopCardHTML(shop) — returns HTML string for one shop card.
 * @param {object} shop
 * @returns {string} HTML
 */
function buildShopCardHTML(shop) {
  const statusLabel = { open: 'Open', busy: 'Busy', closed: 'Closed' }[shop.status] || 'Unknown';
  return `
    <div
      class="shop-card"
      data-shop-id="${shop.id}"
      data-category="${shop.category}"
      role="listitem"
      tabindex="0"
      aria-label="${shop.name}, ${statusLabel}, ${shop.distance} away"
    >
      <div class="shop-emoji-circle" aria-hidden="true">${shop.emoji}</div>
      <div class="shop-card-name">${shop.name}</div>
      <div class="shop-card-meta">
        <span>📍 ${shop.distance}</span>
        <span>⏱ Ready in ${shop.ready}</span>
      </div>
      <span class="status-badge status-${shop.status}" role="status" aria-label="Status: ${statusLabel}">
        ${statusLabel}
      </span>
    </div>
  `;
}

/* ── Search ────────────────────────────────────────────────────────── */

let searchDebounceTimer = null;

function initSearch() {
  const input = document.getElementById('shop-search');
  const clearBtn = document.getElementById('search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    // Show/hide clear button
    if (clearBtn) clearBtn.style.display = input.value ? 'flex' : 'none';

    // Debounce search 300ms
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      AppState.searchQuery = input.value.trim().toLowerCase();
      applyFilters();
    }, 300);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      AppState.searchQuery = '';
      applyFilters();
      input.focus();
    });
  }
}

/* ── Category chips ────────────────────────────────────────────────── */

function initCategoryChips() {
  const chips = document.querySelectorAll('#category-chips .chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      // Update active chip
      chips.forEach(c => {
        c.classList.remove('chip-active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('chip-active');
      chip.setAttribute('aria-pressed', 'true');

      AppState.activeCategory = chip.dataset.cat;
      applyFilters();
    });
  });
}

/**
 * applyFilters() — filters MOCK_SHOPS by active category + search query.
 * Applies 200ms opacity transition to cards.
 */
function applyFilters() {
  let filtered = [...MOCK_SHOPS];

  // Category filter
  if (AppState.activeCategory && AppState.activeCategory !== 'all') {
    filtered = filtered.filter(s => s.category === AppState.activeCategory);
  }

  // Search filter (name match)
  if (AppState.searchQuery) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(AppState.searchQuery) ||
      s.category.toLowerCase().includes(AppState.searchQuery)
    );
  }

  renderShopCards(filtered);
}

/* ── GPS sort button ───────────────────────────────────────────────── */

function initGPSButton() {
  const btn = document.getElementById('gps-sort-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.setAttribute('aria-label', 'Detecting your location…');
    const label = btn.querySelector('.gps-btn-label');
    if (label) label.textContent = 'Locating…';

    try {
      // geo.js getUserLocation() — see geo.js
      const loc = await getUserLocation();

      if (isInGuwahati(loc)) {
        showLocationBanner('📍 Showing shops nearest to you', 'success');
        // TODO: Sort MOCK_SHOPS by real distance from loc when distance data is available
        // For now: sort by hardcoded distance string (numeric prefix)
        const sorted = [...MOCK_SHOPS].sort((a, b) =>
          parseFloat(a.distance) - parseFloat(b.distance)
        );
        renderShopCards(sorted);
        if (label) label.textContent = 'Near me ✓';
      } else {
        showLocationBanner('📍 Location not detected — showing all shops', 'info');
        if (label) label.textContent = 'Near me';
      }
    } catch (err) {
      showLocationBanner('📍 Could not detect location — showing all shops', 'info');
      if (label) label.textContent = 'Near me';
    } finally {
      btn.disabled = false;
      btn.setAttribute('aria-label', 'Sort by my location');
    }
  });

  // Reset filters button (inside empty state)
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      AppState.activeCategory = 'all';
      AppState.searchQuery = '';
      const input = document.getElementById('shop-search');
      if (input) input.value = '';
      const chips = document.querySelectorAll('#category-chips .chip');
      chips.forEach(c => {
        c.classList.remove('chip-active');
        c.setAttribute('aria-pressed', 'false');
      });
      const firstChip = document.querySelector('#category-chips .chip[data-cat="all"]');
      if (firstChip) {
        firstChip.classList.add('chip-active');
        firstChip.setAttribute('aria-pressed', 'true');
      }
      applyFilters();
    });
  }
}

function showLocationBanner(text, type) {
  const banner = document.getElementById('location-banner');
  const bannerText = document.getElementById('location-banner-text');
  if (!banner || !bannerText) return;
  bannerText.textContent = text;
  banner.style.display = 'flex';

  const closeBtn = banner.querySelector('.location-banner-close');
  if (closeBtn) {
    closeBtn.onclick = () => { banner.style.display = 'none'; };
  }
  // Auto-dismiss after 4s
  setTimeout(() => { banner.style.display = 'none'; }, 4000);
}


/* ─── SECTION: SHOP MODAL ───────────────────────────────────────────
   Full-screen bottom-sheet overlay showing shop details.
   Status is computed dynamically vs current time.
*/

/**
 * openShopModal(shop) — populates and shows the shop modal.
 * @param {object} shop — shop data object from MOCK_SHOPS
 */
function openShopModal(shop) {
  AppState.currentShop = shop;

  // Populate header
  setElText('modal-shop-emoji', shop.emoji);
  setElText('modal-shop-name', shop.name);
  setElText('modal-category-badge', capitalize(shop.category));

  // Announcement
  const announcementEl = document.getElementById('modal-announcement');
  const announcementText = document.getElementById('modal-announcement-text');
  if (shop.announcement && announcementEl && announcementText) {
    announcementText.textContent = shop.announcement;
    announcementEl.style.display = 'block';
  } else if (announcementEl) {
    announcementEl.style.display = 'none';
  }

  // Hours
  setElText('modal-hours', shop.hours);
  const lastOrderEl = document.getElementById('modal-last-order');
  if (lastOrderEl) lastOrderEl.innerHTML = `Last order accepted at <strong>${shop.lastOrder}</strong>`;

  // Dynamic status
  renderModalStatus(shop);

  // Ratings
  setElText('modal-rating-avg', shop.rating.toFixed(1));
  setElText('modal-rating-count', `· ${shop.ratingCount} ratings`);
  renderReviews(shop.reviews || []);

  // Show the modal overlay
  const overlay = document.getElementById('section-modal');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.removeAttribute('aria-hidden');
    // Trap focus inside modal
    setTimeout(() => {
      const closeBtn = document.getElementById('modal-close-btn');
      if (closeBtn) closeBtn.focus();
    }, 100);
  }

  // Prevent body scroll while modal is open
  document.body.style.overflow = 'hidden';
}

/**
 * closeShopModal() — hides the modal overlay.
 */
function closeShopModal() {
  const overlay = document.getElementById('section-modal');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
  }
  document.body.style.overflow = '';
}

/**
 * getShopStatus(shop) — computes display status based on current time vs closing buffer.
 * @param {object} shop
 * @returns {'open' | 'closing-soon' | 'post-buffer' | 'closed'}
 */
function getShopStatus(shop) {
  // Parse "8:30 PM" style time strings
  try {
    const lastOrderDate = parseTimeToDate(shop.lastOrder);
    const now = new Date();

    if (shop.status === 'closed') return 'post-buffer';
    if (now > lastOrderDate) return 'post-buffer';

    const warnThreshold = new Date(lastOrderDate.getTime() - 30 * 60 * 1000); // 30 min before
    if (now >= warnThreshold) return 'closing-soon';

    return 'open';
  } catch (e) {
    // Fallback to static status if time parsing fails
    return shop.status === 'open' ? 'open' : 'post-buffer';
  }
}

/**
 * renderModalStatus(shop) — injects the status-dependent CTA into #modal-status-block.
 * @param {object} shop
 */
function renderModalStatus(shop) {
  const block = document.getElementById('modal-status-block');
  if (!block) return;

  const status = getShopStatus(shop);

  if (status === 'open') {
    block.innerHTML = `
      <button class="status-cta-open" id="modal-order-btn" aria-label="Place an order at ${shop.name}">
        Place Order
      </button>
    `;
    document.getElementById('modal-order-btn').addEventListener('click', () => {
      AppState.isPreOrder = false;
      closeShopModal();
      navigate('order');
    });

  } else if (status === 'closing-soon') {
    block.innerHTML = `
      <button class="status-cta-busy" id="modal-order-btn" aria-label="Order now — shop closing soon">
        Order Now (Closing Soon!)
      </button>
    `;
    document.getElementById('modal-order-btn').addEventListener('click', () => {
      AppState.isPreOrder = false;
      closeShopModal();
      navigate('order');
    });

  } else {
    // post-buffer or closed
    block.innerHTML = `
      <div class="status-cta-closed-msg" role="status" aria-live="polite">
        🔴 Shop is closed for today
      </div>
      <button class="status-cta-preorder" id="modal-preorder-btn" aria-label="Pre-order for tomorrow">
        📅 Pre-order for Tomorrow
      </button>
    `;
    document.getElementById('modal-preorder-btn').addEventListener('click', () => {
      AppState.isPreOrder = true;
      closeShopModal();
      navigate('order');
    });
  }
}

/**
 * renderReviews(reviews) — renders review list inside accordion.
 * @param {Array} reviews
 */
function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');
  if (!list) return;

  list.innerHTML = reviews.slice(0, 3).map(r => `
    <div class="review-item">
      <div class="review-header">
        <div class="review-avatar" aria-hidden="true">${r.initials}</div>
        <div>
          <div class="review-name">${r.name}</div>
          <div class="review-role">${r.role}</div>
        </div>
        <div class="review-stars" aria-label="5 stars" aria-hidden="true">★★★★★</div>
      </div>
      <p class="review-text"><em>"${r.text}"</em></p>
    </div>
  `).join('');

  // Reviews toggle accordion
  const toggle = document.getElementById('reviews-toggle');
  if (toggle) {
    toggle.onclick = () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      list.hidden = expanded;
      list.setAttribute('aria-hidden', String(expanded));
      toggle.querySelector('.chevron') && (toggle.querySelector('.chevron').style.transform = expanded ? '' : 'rotate(180deg)');
    };
  }
}

/* ── Modal event listeners ──────────────────────────────────────────── */

function initModalListeners() {
  // Close button
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeShopModal);

  // Backdrop tap
  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeShopModal);

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && AppState.activeSection === 'browse') {
      closeShopModal();
    }
  });
}


/* ─── SECTION: ORDER ─────────────────────────────────────────────────
   Two tabs: type list or upload photo.
   Time slot picker. Order note. "Review Order" CTA.
*/

function onEnterOrder() {
  const shop = AppState.currentShop;
  if (!shop) { navigate('browse'); return; }

  // Update shop name in top bar
  setElText('order-shop-name', shop.name);

  // Reset tabs to "Type" by default
  switchOrderTab('type');

  // Init tabs
  initOrderTabs();

  // Build time slots for this shop
  buildTimeSlots(shop);

  // Character counter for textarea
  initCharCounter();

  // Photo upload
  initPhotoUpload();

  // Clear button
  const clearBtn = document.getElementById('clear-order-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    const textarea = document.getElementById('order-text');
    if (textarea) textarea.value = '';
    clearPhoto();
    AppState.selectedTime = 'asap';
    document.querySelectorAll('.time-slot').forEach(s => {
      s.classList.remove('time-slot-selected');
      s.setAttribute('aria-pressed', 'false');
    });
    const asapSlot = document.querySelector('.time-slot[data-time="asap"]');
    if (asapSlot) {
      asapSlot.classList.add('time-slot-selected');
      asapSlot.setAttribute('aria-pressed', 'true');
    }
  });

  // Back buttons
  document.querySelectorAll('.back-btn[data-target="browse"]').forEach(btn => {
    btn.addEventListener('click', () => navigate('browse'));
  });

  // Review order button
  const reviewBtn = document.getElementById('review-order-btn');
  if (reviewBtn) reviewBtn.addEventListener('click', handleReviewOrder);

  // Pre-order banner
  if (AppState.isPreOrder) {
    showToast('📅 Pre-ordering for tomorrow', 'info');
  }
}

/* ── Order tabs ────────────────────────────────────────────────────── */

function initOrderTabs() {
  const tabType  = document.getElementById('tab-type');
  const tabPhoto = document.getElementById('tab-photo');

  if (tabType) tabType.addEventListener('click', () => switchOrderTab('type'));
  if (tabPhoto) tabPhoto.addEventListener('click', () => switchOrderTab('photo'));
}

function switchOrderTab(tab) {
  const tabType      = document.getElementById('tab-type');
  const tabPhoto     = document.getElementById('tab-photo');
  const panelType    = document.getElementById('tab-panel-type');
  const panelPhoto   = document.getElementById('tab-panel-photo');

  const isType = tab === 'type';

  if (tabType)  { tabType.classList.toggle('order-tab-active', isType);  tabType.setAttribute('aria-selected', String(isType)); }
  if (tabPhoto) { tabPhoto.classList.toggle('order-tab-active', !isType); tabPhoto.setAttribute('aria-selected', String(!isType)); }
  if (panelType)  { panelType.hidden  = !isType; }
  if (panelPhoto) { panelPhoto.hidden = isType;  }
}

/* ── Character counter ─────────────────────────────────────────────── */

function initCharCounter() {
  const textarea  = document.getElementById('order-text');
  const countEl   = document.getElementById('char-count');
  if (!textarea || !countEl) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    countEl.textContent = `${len} / 1000`;
    countEl.classList.toggle('near-limit', len > 900);
  });
}

/* ── Photo upload ──────────────────────────────────────────────────── */

function initPhotoUpload() {
  const input     = document.getElementById('photo-input');
  const preview   = document.getElementById('photo-preview');
  const thumb     = document.getElementById('photo-thumb');
  const removeBtn = document.getElementById('photo-remove-btn');

  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      AppState.currentPhotoDataUrl = dataUrl;

      if (thumb)   thumb.src = dataUrl;
      if (preview) preview.style.display = 'flex';

      // Switch to show we have a photo (switch to photo tab)
      switchOrderTab('photo');
    };
    reader.readAsDataURL(file);
  });

  if (removeBtn) removeBtn.addEventListener('click', clearPhoto);
}

function clearPhoto() {
  AppState.currentPhotoDataUrl = null;
  const input   = document.getElementById('photo-input');
  const preview = document.getElementById('photo-preview');
  const thumb   = document.getElementById('photo-thumb');
  if (input)   input.value = '';
  if (thumb)   thumb.src = '';
  if (preview) preview.style.display = 'none';
}

/* ── Time slots ────────────────────────────────────────────────────── */

/**
 * buildTimeSlots(shop) — generates pickup time buttons every 15 min
 * from now+20min to shop's lastOrder buffer time.
 * @param {object} shop
 */
function buildTimeSlots(shop) {
  const wrapper = document.getElementById('time-slots-wrapper');
  if (!wrapper) return;

  // Clear old slots (keep ASAP)
  wrapper.querySelectorAll('.time-slot:not([data-time="asap"])').forEach(el => el.remove());

  const now = new Date();
  let cursor = new Date(now.getTime() + 20 * 60 * 1000); // start at now + 20min

  // Round up to next 15-min boundary
  const minuteRemainder = cursor.getMinutes() % 15;
  if (minuteRemainder !== 0) cursor.setMinutes(cursor.getMinutes() + (15 - minuteRemainder));
  cursor.setSeconds(0, 0);

  // End at last order time
  let lastOrderDate;
  try { lastOrderDate = parseTimeToDate(shop.lastOrder); }
  catch { lastOrderDate = new Date(now.getTime() + 4 * 60 * 60 * 1000); } // fallback +4hr

  // Build slots
  while (cursor <= lastOrderDate) {
    const slotTime = new Date(cursor);
    const label    = formatTime12(slotTime);
    const isPast   = slotTime < now;
    const btn      = document.createElement('button');

    btn.className = 'time-slot';
    btn.dataset.time = slotTime.toISOString();
    btn.textContent  = label;
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `Pick up at ${label}`);
    if (isPast) { btn.disabled = true; btn.setAttribute('aria-disabled', 'true'); }

    btn.addEventListener('click', () => selectTimeSlot(btn, slotTime.toISOString()));
    wrapper.appendChild(btn);

    cursor = new Date(cursor.getTime() + 15 * 60 * 1000);
  }

  // ASAP click handler
  const asapBtn = wrapper.querySelector('[data-time="asap"]');
  if (asapBtn) {
    asapBtn.addEventListener('click', () => selectTimeSlot(asapBtn, 'asap'));
    selectTimeSlot(asapBtn, 'asap'); // default selection
  }
}

function selectTimeSlot(btn, time) {
  document.querySelectorAll('.time-slot').forEach(s => {
    s.classList.remove('time-slot-selected');
    s.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('time-slot-selected');
  btn.setAttribute('aria-pressed', 'true');
  AppState.selectedTime = time;
}

/* ── Review order validation ───────────────────────────────────────── */

function handleReviewOrder() {
  const textarea = document.getElementById('order-text');
  const textContent = textarea ? textarea.value.trim() : '';
  const hasPhoto = !!AppState.currentPhotoDataUrl;

  if (!textContent && !hasPhoto) {
    showToast('Please type your shopping list or upload a photo.', 'warning');
    textarea && textarea.focus();
    return;
  }

  // Save order draft to state
  AppState.currentOrder = {
    shopId:       AppState.currentShop.id,
    shopName:     AppState.currentShop.name,
    shopEmoji:    AppState.currentShop.emoji,
    text:         textContent,
    photoDataUrl: AppState.currentPhotoDataUrl || null,
    pickupTime:   AppState.selectedTime,
    note:         (document.getElementById('order-note') || {}).value || '',
    isPreOrder:   AppState.isPreOrder,
    payment:      null,
    createdAt:    new Date().toISOString()
  };

  navigate('checkout');
}


/* ─── SECTION: CHECKOUT ──────────────────────────────────────────────
   Order summary, payment method selection, UPI deep link, place order.
*/

function onEnterCheckout() {
  const order = AppState.currentOrder;
  const shop  = AppState.currentShop;
  if (!order || !shop) { navigate('browse'); return; }

  // Populate summary
  setElText('checkout-shop-emoji', shop.emoji);
  setElText('checkout-shop-name', shop.name);
  setElText('checkout-summary-meta',
    order.pickupTime === 'asap'
      ? 'Walk in as soon as ready'
      : `Walk in at ${formatTime12(new Date(order.pickupTime))}`
  );

  // Items text
  const itemsEl = document.getElementById('summary-items-text');
  if (itemsEl) itemsEl.textContent = order.text || '(Photo list attached)';

  // Photo in checkout
  const summaryPhoto = document.getElementById('summary-photo');
  const summaryThumb = document.getElementById('summary-photo-thumb');
  if (order.photoDataUrl && summaryPhoto && summaryThumb) {
    summaryThumb.src = order.photoDataUrl;
    summaryPhoto.style.display = 'flex';
  } else if (summaryPhoto) {
    summaryPhoto.style.display = 'none';
  }

  // Payment options
  initPaymentOptions(shop);

  // Back button
  document.querySelectorAll('.back-btn[data-target="order"]').forEach(btn => {
    btn.addEventListener('click', () => navigate('order'));
  });

  // Place order button
  const placeBtn = document.getElementById('place-order-btn');
  if (placeBtn) placeBtn.addEventListener('click', handlePlaceOrder);

  // Past orders accordion
  initPastOrders();
}

/* ── Payment options ───────────────────────────────────────────────── */

function initPaymentOptions(shop) {
  const payPickup = document.getElementById('pay-pickup');
  const payUPI    = document.getElementById('pay-upi');
  const upiApps   = document.getElementById('upi-apps');

  // TODO: Check if pickup disabled (high value order, shop policy)
  // For now: always enabled
  const pickupDisabledOverlay = document.getElementById('pickup-disabled-overlay');
  if (pickupDisabledOverlay) pickupDisabledOverlay.style.display = 'none';

  if (payPickup) {
    payPickup.addEventListener('change', () => {
      AppState.currentOrder.payment = 'pickup';
      if (upiApps) upiApps.style.display = 'none';
    });
  }

  if (payUPI) {
    payUPI.addEventListener('change', () => {
      AppState.currentOrder.payment = 'upi';
      if (upiApps) upiApps.style.display = 'block';
    });
  }

  // UPI app buttons
  document.querySelectorAll('.upi-app-btn').forEach(btn => {
    btn.addEventListener('click', () => handleUPIAppSelect(btn.dataset.app, shop));
  });
}

/**
 * handleUPIAppSelect(app, shop) — builds UPI deep link and attempts to launch it.
 * Falls back to QR if deep link fails (e.g., desktop or app not installed).
 * @param {string} app — 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'other'
 * @param {object} shop
 */
function handleUPIAppSelect(app, shop) {
  // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
  // The shop.upiId here is a placeholder — replace with server-resolved VPA
  const orderId = 'LB-' + Date.now();
  const link    = buildUPILink({
    pa: shop.upiId,   // server-resolved VPA
    pn: shop.name,
    am: 0,            // TODO: actual quoted amount from shopkeeper
    tn: `LocalBuy Order #${orderId}`,
    cu: 'INR'
  });

  // Show waiting spinner
  const waiting = document.getElementById('upi-waiting');
  if (waiting) waiting.style.display = 'flex';

  // Attempt deep link
  launchUPI(link);
}

/* ── Place order ───────────────────────────────────────────────────── */

async function handlePlaceOrder() {
  const order = AppState.currentOrder;
  if (!order) return;

  // Require payment selection
  const selectedPayment = document.querySelector('.payment-radio:checked');
  if (!selectedPayment) {
    showToast('Please select a payment method to continue.', 'warning');
    return;
  }

  const placeBtn = document.getElementById('place-order-btn');
  if (placeBtn) {
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order…';
  }

  try {
    // 1. Generate order ID
    const orderId = 'LB' + Date.now();
    order.id       = orderId;
    order.payment  = selectedPayment.value;
    order.status   = 'pending';

    // 2. Save to localStorage as currentOrder
    // TODO: Customer phone numbers stored only in order objects — encrypt at rest in Firebase, never log to console in production
    localStorage.setItem('lb_currentOrder', JSON.stringify(order));

    // Save to order history
    saveOrderToHistory(order);

    // 3. Create order via db-bridge stub
    // TODO: Replace with Firebase SDK call in db-bridge.js
    await DB.createOrder(order);

    // 4. Request push permission
    // notifications.js
    await requestPushPermission();

    // 5. Navigate to tracker
    AppState.currentOrder = order;
    navigate('tracker');

  } catch (err) {
    console.error('[PlaceOrder] Error:', err);
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    if (placeBtn) {
      placeBtn.disabled = false;
      placeBtn.textContent = 'Confirm Order';
    }
  }
}

/* ── Past orders ────────────────────────────────────────────────────── */

function initPastOrders() {
  const toggle   = document.getElementById('past-orders-toggle');
  const list     = document.getElementById('past-orders-list');
  if (!toggle || !list) return;

  // Load from localStorage
  const history = getOrderHistory();
  if (!history.length) {
    toggle.style.display = 'none';
    return;
  }

  toggle.style.display = 'flex';
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    list.hidden = expanded;
    list.setAttribute('aria-hidden', String(expanded));
  });

  // Render past orders
  list.innerHTML = history.slice(0, 3).map(o => `
    <div class="past-order-item" data-order-text="${encodeURIComponent(o.text || '')}" tabindex="0" role="button" aria-label="Re-use order from ${o.shopName}">
      <div class="past-order-shop">${o.shopName}</div>
      <div class="past-order-preview">${(o.text || '').substring(0, 60)}${o.text && o.text.length > 60 ? '…' : ''}</div>
      <span class="past-order-reuse">↩ Re-use this list</span>
    </div>
  `).join('');

  // Click to pre-fill
  list.querySelectorAll('.past-order-item').forEach(item => {
    item.addEventListener('click', () => {
      const text = decodeURIComponent(item.dataset.orderText);
      const textarea = document.getElementById('order-text');
      if (textarea && text) {
        textarea.value = text;
        // Navigate back to order section
        navigate('order');
      }
    });
  });
}

function saveOrderToHistory(order) {
  const key     = 'lb_orderHistory';
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  history.unshift({ shopName: order.shopName, text: order.text, createdAt: order.createdAt });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 10))); // keep last 10
}

function getOrderHistory() {
  return JSON.parse(localStorage.getItem('lb_orderHistory') || '[]');
}


/* ─── SECTION: TRACKER ───────────────────────────────────────────────
   4-stage vertical timeline. Live countdown. Order code card.
   Polls order status via db-bridge listenOrders().
*/

// Stage sequence
const TRACKER_STAGES = ['pending', 'quoted', 'packing', 'ready'];

let countdownTimer  = null;
let estimatedReady  = null; // Date object

function onEnterTracker() {
  const order = AppState.currentOrder;
  if (!order) { navigate('browse'); return; }

  // Set header
  setElText('tracker-order-id', order.id || 'LB-' + Date.now());
  setElText('tracker-shop-name', order.shopName);
  setElText('order-code', order.id || 'LB-XXXX');

  // Compute estimated ready time (now + shop ready time)
  const shop    = AppState.currentShop;
  const readyIn = shop ? parseInt(shop.ready) : 10;
  estimatedReady = new Date(Date.now() + readyIn * 60 * 1000);

  // Start countdown
  startCountdown(estimatedReady);

  // Set initial status = 'pending'
  AppState.orderStatus = order.status || 'pending';
  updateTrackerUI(AppState.orderStatus);

  // Cancel order button
  const cancelBtn = document.getElementById('cancel-order-btn');
  if (cancelBtn) {
    cancelBtn.style.display = 'block';
    cancelBtn.addEventListener('click', () => {
      showConfirmDialog(
        'Cancel order?',
        'The shopkeeper will be notified. This cannot be undone.',
        () => cancelCurrentOrder()
      );
    });
  }

  // Accept / decline quote buttons
  const acceptBtn  = document.getElementById('accept-quote-btn');
  const declineBtn = document.getElementById('decline-quote-btn');
  if (acceptBtn)  acceptBtn.addEventListener('click', acceptQuote);
  if (declineBtn) declineBtn.addEventListener('click', () => {
    showConfirmDialog('Cancel order?', 'This order will be cancelled.', () => cancelCurrentOrder());
  });

  // Copy code button
  const copyCodeBtn = document.getElementById('copy-code-btn');
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      const code = (document.getElementById('order-code') || {}).textContent;
      if (navigator.clipboard && code) {
        navigator.clipboard.writeText(code).then(() => showToast('Order code copied!', 'success'));
      }
    });
  }

  // "Order another" button
  const orderAnotherBtn = document.getElementById('order-another-btn');
  if (orderAnotherBtn) {
    orderAnotherBtn.addEventListener('click', () => navigate('order'));
  }

  // Start listening for order updates
  startOrderListener(order.id);

  // DEMO: Simulate status progression for demo purposes
  // TODO: Remove this when real Firebase listener is connected
  simulateOrderProgression();
}

/**
 * updateTrackerUI(status) — advances the timeline to the given stage.
 * @param {'pending'|'quoted'|'packing'|'ready'} status
 */
function updateTrackerUI(status) {
  const stages = document.querySelectorAll('.timeline-stage');
  const currentIdx = TRACKER_STAGES.indexOf(status);

  stages.forEach((stage, i) => {
    const stageName = stage.dataset.stage;
    const idx       = TRACKER_STAGES.indexOf(stageName);

    // Reset classes
    stage.classList.remove('completed');
    stage.removeAttribute('aria-current');

    if (idx < currentIdx) {
      // Completed
      stage.classList.add('completed');
      const dot = stage.querySelector('.stage-dot svg circle:last-child, .stage-dot svg circle');
      // Render filled circle with checkmark for completed
      stage.querySelector('.stage-dot').innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="11" fill="var(--color-sage)"/>
          <path d="M6.5 11l3 3 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else if (idx === currentIdx) {
      // Active
      stage.setAttribute('aria-current', 'true');
      stage.querySelector('.stage-dot').innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="10" stroke="var(--color-sage)" stroke-width="2"/>
          <circle cx="11" cy="11" r="5" fill="var(--color-sage)"/>
        </svg>
      `;
    } else {
      // Upcoming
      stage.querySelector('.stage-dot').innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="10" stroke="var(--color-border)" stroke-width="2"/>
        </svg>
      `;
    }
  });

  // Show/hide cancel button (only at pending stage)
  const cancelBtn = document.getElementById('cancel-order-btn');
  if (cancelBtn) cancelBtn.style.display = status === 'pending' ? 'block' : 'none';

  // Show/hide quote card (at quoted stage)
  const quoteCard = document.getElementById('quote-card');
  if (quoteCard) quoteCard.style.display = status === 'quoted' ? 'block' : 'none';

  // Show/hide order code card (at packing + ready)
  const orderCodeCard = document.getElementById('order-code-card');
  if (orderCodeCard) {
    const showCode = status === 'packing' || status === 'ready';
    orderCodeCard.style.display = showCode ? 'block' : 'none';
  }

  // Ready stage: stop countdown + update message
  if (status === 'ready') {
    clearInterval(countdownTimer);
    const countdownEl = document.getElementById('tracker-countdown');
    if (countdownEl) {
      countdownEl.innerHTML = '✅ Ready for pickup!';
    }
  }
}

/* ── Countdown timer ───────────────────────────────────────────────── */

function startCountdown(targetDate) {
  clearInterval(countdownTimer);
  updateCountdownDisplay(targetDate);
  countdownTimer = setInterval(() => updateCountdownDisplay(targetDate), 10000);
}

function updateCountdownDisplay(targetDate) {
  const countdownEl = document.getElementById('countdown-minutes');
  if (!countdownEl) return;
  const remaining = Math.max(0, Math.round((targetDate - Date.now()) / 60000));
  countdownEl.textContent = remaining;
}

/* ── Quote handling ─────────────────────────────────────────────────── */

function showQuote(amount, notes) {
  AppState.quoteAmount = amount;
  AppState.quoteNotes  = notes;

  setElText('quote-total', `Total: ${formatCurrency(amount)}`);
  const notesEl = document.getElementById('quote-notes');
  if (notesEl) notesEl.textContent = notes || '';

  updateTrackerUI('quoted');
}

function acceptQuote() {
  // TODO: Send acceptance to backend via db-bridge.updateOrderStatus
  DB.updateOrderStatus(AppState.currentOrder.id, 'packing', {});
  updateTrackerUI('packing');
  showToast('Quote accepted! Your order is being packed.', 'success');
}

/* ── Order cancellation ─────────────────────────────────────────────── */

function cancelCurrentOrder() {
  const order = AppState.currentOrder;
  if (!order) return;
  // TODO: Cancel via db-bridge.cancelOrder
  DB.cancelOrder(order.id, 'customer_cancelled');
  clearInterval(countdownTimer);
  showToast('Order cancelled. The shopkeeper has been notified.', 'info');
  setTimeout(() => navigate('browse'), 1500);
}

/* ── Order listener stub ────────────────────────────────────────────── */

/**
 * startOrderListener(orderId) — subscribes to order updates.
 * TODO: Replace console.log with real Firestore onSnapshot when connected.
 * @param {string} orderId
 */
function startOrderListener(orderId) {
  // Unsubscribe previous listener
  if (AppState.unsubscribeOrders) AppState.unsubscribeOrders();

  // DB.listenOrders returns unsubscribe fn (see db-bridge.js)
  AppState.unsubscribeOrders = DB.listenOrders(orderId, (updatedOrder) => {
    if (!updatedOrder) return;
    AppState.orderStatus = updatedOrder.status;
    updateTrackerUI(updatedOrder.status);

    if (updatedOrder.status === 'quoted') {
      showQuote(updatedOrder.quoteAmount, updatedOrder.quoteNotes);
    }
  });
}

/* ── DEMO: Simulated status progression ─────────────────────────────
   Simulates the shopkeeper updating the order status for demo purposes.
   TODO: Remove this block when real Firebase listener is connected.
   The real flow: shopkeeper taps buttons in shopkeeper.html → Firestore update → this listener fires.
*/
function simulateOrderProgression() {
  const sequence = ['pending', 'quoted', 'packing', 'ready'];
  let step = 0;

  // Advance status every 8 seconds for demo
  const demoTimer = setInterval(() => {
    step++;
    if (step >= sequence.length) {
      clearInterval(demoTimer);
      return;
    }

    const newStatus = sequence[step];
    AppState.orderStatus = newStatus;
    updateTrackerUI(newStatus);

    if (newStatus === 'quoted') {
      // Simulate shopkeeper sending a quote
      showQuote(347, 'No Tata Salt — added Captain Cook 1kg ✓\nMaggi available ✓');
    }

    if (newStatus === 'ready') {
      showToast('🎉 Your order is ready! Walk in to collect.', 'success');
    }
  }, 8000);
}


/* ─── CONFIRM DIALOG ─────────────────────────────────────────────────
   Replaces browser confirm(). No alert() or confirm() used.
   showConfirmDialog(title, body, onConfirm, onCancel?)
*/

function showConfirmDialog(title, body, onConfirm, onCancel) {
  const dialog    = document.getElementById('confirm-dialog');
  const titleEl   = document.getElementById('confirm-title');
  const bodyEl    = document.getElementById('confirm-body');
  const okBtn     = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!dialog) return;

  if (titleEl)   titleEl.textContent = title;
  if (bodyEl)    bodyEl.textContent  = body;

  dialog.style.display = 'flex';
  dialog.removeAttribute('aria-hidden');

  // Focus OK button
  setTimeout(() => okBtn && okBtn.focus(), 50);

  const cleanup = () => {
    dialog.style.display = 'none';
    dialog.setAttribute('aria-hidden', 'true');
    okBtn     && okBtn.removeEventListener('click', handleOk);
    cancelBtn && cancelBtn.removeEventListener('click', handleCancel);
  };

  const handleOk = () => { cleanup(); onConfirm && onConfirm(); };
  const handleCancel = () => { cleanup(); onCancel && onCancel(); };

  okBtn     && okBtn.addEventListener('click', handleOk);
  cancelBtn && cancelBtn.addEventListener('click', handleCancel);

  // Escape to cancel
  const escHandler = (e) => {
    if (e.key === 'Escape') { cleanup(); onCancel && onCancel(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}


/* ─── TOAST NOTIFICATIONS ────────────────────────────────────────────
   showToast(message, type) — shows a dismissible toast message.
   type: 'success' | 'error' | 'info' | 'warning'
   Auto-dismisses after 3.5s.
*/
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  container.appendChild(toast);

  // Auto remove after 3.5s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    setTimeout(() => container.removeChild(toast), 300);
  }, 3500);
}


/* ─── UTILITY FUNCTIONS ─────────────────────────────────────────────── */

/**
 * setElText(id, text) — safe wrapper for setting element text content.
 */
function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * capitalize(str) — capitalises the first letter of a string.
 */
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/**
 * parseTimeToDate(timeStr) — parses "8:30 PM" into a Date object for today.
 * @param {string} timeStr — e.g. "8:30 PM"
 * @returns {Date}
 */
function parseTimeToDate(timeStr) {
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) throw new Error('Cannot parse time: ' + timeStr);

  let hours   = parseInt(match[1]);
  const mins  = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  return date;
}

/**
 * formatTime12(date) — formats a Date as "2:30 PM".
 * @param {Date} date
 * @returns {string}
 */
function formatTime12(date) {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * formatCurrency(amount) — formats a number as INR currency string.
 * Uses Indian locale formatting.
 * @param {number} amount
 * @returns {string} e.g. "₹347"
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}


/* ─── INIT ───────────────────────────────────────────────────────────── */

/**
 * init() — bootstraps the customer SPA.
 * Called when DOM is ready.
 */
function init() {
  // Attach modal listeners (persistent across sections)
  initModalListeners();

  // Determine start section from URL hash
  const hash = window.location.hash.replace('#', '');
  const validSections = ['browse', 'order', 'checkout', 'tracker'];
  const startSection  = validSections.includes(hash) ? hash : 'browse';

  // Show starting section
  navigate(startSection);

  // Check for saved currentOrder (e.g., user refreshed on tracker)
  const savedOrder = localStorage.getItem('lb_currentOrder');
  if (savedOrder && startSection === 'tracker') {
    try {
      AppState.currentOrder = JSON.parse(savedOrder);
      // Find the shop from MOCK_SHOPS
      AppState.currentShop = MOCK_SHOPS.find(s => s.id === AppState.currentOrder.shopId) || null;
    } catch (e) {
      console.warn('[Init] Could not restore saved order');
    }
  }

  // Log init event (no PII)
  // TODO: Replace with real analytics when privacy-compliant solution in place
  DB.logEvent('customer_app_init', { section: startSection });
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}