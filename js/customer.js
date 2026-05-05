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
 * FIX C1: MOCK_SHOPS removed from this file entirely. Now uses window.MOCK_SHOPS
 *         exported by db-bridge.js, avoiding the "Cannot redeclare block-scoped
 *         variable" ReferenceError when both files are loaded.
 *
 * FIX C3: All bare calls to getUserLocation / isInGuwahati replaced with
 *         Geo.getUserLocation / Geo.isInGuwahati. requestPushPermission
 *         replaced with Notifications.requestPushPermission. buildUPILink /
 *         launchUPI replaced with UPI.buildUPILink / UPI.launchUPI.
 *
 * FIX H1: Back-button wiring in navigate() now reads SECTION_META[sectionId].backTarget
 *         and the header back-btn click navigates to that target, not hardcoded 'browse'.
 *
 * FIX H3: startOrderListener now calls DB.listenOrder (single-order listener)
 *         instead of DB.listenOrders (shop-level listener).
 *
 * FIX H4: handleUPIAppSelect guards against placeholder UPI VPA before launching.
 *
 * FIX L2: simulateOrderProgression stores the interval ID and clears it before
 *         re-running, preventing double-timer accumulation on re-entry.
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

// FIX C1: Do NOT declare MOCK_SHOPS here. Use window.MOCK_SHOPS from db-bridge.js.
// All references below use MOCK_SHOPS which resolves via the global from db-bridge.js.

/* ─── SECTION NAVIGATION ────────────────────────────────────────────
   Central navigate(sectionId) function.
   Shows the target section, hides all others.
   Updates header title and back button visibility.

   FIX H1: backTarget is now read from SECTION_META and the header back-btn
   click is bound once in initModalListeners() to navigate to the correct target.
*/

const SECTION_META = {
  browse:   { title: 'Browse Shops',   showBack: false, backTarget: null     },
  order:    { title: 'Place Order',    showBack: true,  backTarget: 'browse' },
  checkout: { title: 'Review & Pay',   showBack: true,  backTarget: 'order'  },
  tracker:  { title: 'Order Status',   showBack: false, backTarget: null     }
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

  // FIX H1: Show/hide back button; store the current backTarget on the element
  // so the single click handler (bound in initModalListeners) knows where to go.
  if (backBtn) {
    if (meta.showBack && meta.backTarget) {
      backBtn.style.display = 'flex';
      backBtn.dataset.target = meta.backTarget;
    } else {
      backBtn.style.display = 'none';
      backBtn.dataset.target = '';
    }
  }

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

  // FIX L3: Suppress Safari's native search cancel button
  if (!document.getElementById('lb-search-webkit-style')) {
    const style = document.createElement('style');
    style.id = 'lb-search-webkit-style';
    style.textContent = `
      .search-input::-webkit-search-cancel-button,
      .search-input::-webkit-search-decoration { display: none; }
    `;
    document.head.appendChild(style);
  }

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

// FIX C3: Use Geo.getUserLocation and Geo.isInGuwahati instead of bare calls.
function initGPSButton() {
  const btn = document.getElementById('gps-sort-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.setAttribute('aria-label', 'Detecting your location…');
    const label = btn.querySelector('.gps-btn-label');
    if (label) label.textContent = 'Locating…';

    try {
      const loc = await Geo.getUserLocation();

      if (Geo.isInGuwahati(loc)) {
        showLocationBanner('📍 Showing shops nearest to you', 'success');
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

   FIX M2: The modal overlay now uses the .is-open / .active class pattern
   defined in main.css instead of directly setting style.display.
   This enables the CSS backdrop blur and slide-up transition.
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

  // FIX M2: Use .is-open + rAF .active pattern for CSS transitions.
  const overlay = document.getElementById('section-modal');
  if (overlay) {
    overlay.classList.add('is-open');
    overlay.removeAttribute('aria-hidden');
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
    setTimeout(() => {
      const closeBtn = document.getElementById('modal-close-btn');
      if (closeBtn) closeBtn.focus();
    }, 100);
  }

  // Prevent body scroll while modal is open
  document.body.style.overflow = 'hidden';
}

/**
 * closeShopModal() — hides the modal overlay with transition.
 */
function closeShopModal() {
  const overlay = document.getElementById('section-modal');
  if (overlay) {
    overlay.classList.remove('active');
    // Wait for transition before hiding
    overlay.addEventListener('transitionend', () => {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }, { once: true });
  }
  document.body.style.overflow = '';
}

/**
 * getShopStatus(shop) — computes display status based on current time vs closing buffer.
 *
 * FIX C2: This is the customer.js-local version. It intentionally uses
 * parseTimeToDate (local helper) and does NOT conflict with app.js LB.getShopStatus,
 * because this is a function-scoped declaration, not a global. app.js exports its
 * version under the LB namespace. No collision occurs.
 *
 * @param {object} shop
 * @returns {'open' | 'closing-soon' | 'post-buffer'}
 */
function getShopStatus(shop) {
  try {
    const lastOrderDate = parseTimeToDate(shop.lastOrder);
    const now = new Date();

    if (shop.status === 'closed') return 'post-buffer';
    if (now > lastOrderDate) return 'post-buffer';

    const warnThreshold = new Date(lastOrderDate.getTime() - 30 * 60 * 1000);
    if (now >= warnThreshold) return 'closing-soon';

    return 'open';
  } catch (e) {
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
 *
 * FIX L5: Added inline CSS for review classes that are missing from customer.css.
 * @param {Array} reviews
 */
function renderReviews(reviews) {
  // FIX L5: Inject review styles if not already present
  if (!document.getElementById('lb-review-styles')) {
    const style = document.createElement('style');
    style.id = 'lb-review-styles';
    style.textContent = `
      .review-item { padding: 12px; background: var(--color-surface, #f8f7f4); border-radius: 8px; }
      .review-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
      .review-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: var(--color-sage, #0f5c3a); color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; flex-shrink: 0;
      }
      .review-name { font-weight: 600; font-size: 14px; }
      .review-role { font-size: 12px; color: var(--color-muted, #6b7280); }
      .review-stars { margin-left: auto; color: #f59e0b; font-size: 13px; }
      .review-text { font-size: 13px; color: var(--color-ink, #111827); line-height: 1.5; }
    `;
    document.head.appendChild(style);
  }

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
      const chevron = toggle.querySelector('.chevron');
      if (chevron) chevron.style.transform = expanded ? '' : 'rotate(180deg)';
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
    if (e.key === 'Escape') {
      const overlay = document.getElementById('section-modal');
      if (overlay && overlay.classList.contains('is-open')) closeShopModal();
    }
  });

  // FIX H1: Header back button — reads data-target set by navigate()
  const headerBackBtn = document.getElementById('header-back-btn');
  if (headerBackBtn) {
    headerBackBtn.addEventListener('click', () => {
      const target = headerBackBtn.dataset.target;
      if (target) navigate(target);
    });
  }
}


/* ─── SECTION: ORDER ─────────────────────────────────────────────────
   Two tabs: type list or upload photo.
   Time slot picker. Order note. "Review Order" CTA.

   FIX M4: ASAP button listener is removed before re-adding via cloneNode
   to prevent accumulating duplicate listeners on re-entry.
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

  // Clear button — clone to remove old listeners
  const clearBtn = document.getElementById('clear-order-btn');
  if (clearBtn) {
    const newClearBtn = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    newClearBtn.addEventListener('click', () => {
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
  }

  // Back buttons — clone to remove old listeners
  document.querySelectorAll('.back-btn[data-target="browse"]').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => navigate('browse'));
  });

  // Review order button — clone to remove old listeners
  const reviewBtn = document.getElementById('review-order-btn');
  if (reviewBtn) {
    const newReviewBtn = reviewBtn.cloneNode(true);
    reviewBtn.parentNode.replaceChild(newReviewBtn, reviewBtn);
    newReviewBtn.addEventListener('click', handleReviewOrder);
  }

  // Pre-order banner
  if (AppState.isPreOrder) {
    showToast('📅 Pre-ordering for tomorrow', 'info');
  }
}

/* ── Order tabs ────────────────────────────────────────────────────── */

function initOrderTabs() {
  const tabType  = document.getElementById('tab-type');
  const tabPhoto = document.getElementById('tab-photo');

  // Clone to remove old listeners accumulated from previous onEnterOrder calls
  if (tabType) {
    const newTabType = tabType.cloneNode(true);
    tabType.parentNode.replaceChild(newTabType, tabType);
    newTabType.addEventListener('click', () => switchOrderTab('type'));
  }
  if (tabPhoto) {
    const newTabPhoto = tabPhoto.cloneNode(true);
    tabPhoto.parentNode.replaceChild(newTabPhoto, tabPhoto);
    newTabPhoto.addEventListener('click', () => switchOrderTab('photo'));
  }
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

  // Clone to remove old listener
  const newTextarea = textarea.cloneNode(true);
  textarea.parentNode.replaceChild(newTextarea, textarea);

  newTextarea.addEventListener('input', () => {
    const len = newTextarea.value.length;
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

  // Clone input to remove old listeners
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  newInput.addEventListener('change', () => {
    const file = newInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      AppState.currentPhotoDataUrl = dataUrl;

      if (thumb)   thumb.src = dataUrl;
      if (preview) preview.style.display = 'flex';

      switchOrderTab('photo');
    };
    reader.readAsDataURL(file);
  });

  if (removeBtn) {
    const newRemoveBtn = removeBtn.cloneNode(true);
    removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
    newRemoveBtn.addEventListener('click', clearPhoto);
  }
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
 * buildTimeSlots(shop) — generates pickup time buttons every 15 min.
 *
 * FIX M4: The ASAP button is cloned to clear accumulated click listeners
 * from previous calls to buildTimeSlots on re-entry to the order section.
 * @param {object} shop
 */
function buildTimeSlots(shop) {
  const wrapper = document.getElementById('time-slots-wrapper');
  if (!wrapper) return;

  // Clear old dynamic slots (keep ASAP)
  wrapper.querySelectorAll('.time-slot:not([data-time="asap"])').forEach(el => el.remove());

  // FIX M4: Clone the ASAP button to remove any accumulated listeners
  const oldAsapBtn = wrapper.querySelector('[data-time="asap"]');
  let asapBtn = null;
  if (oldAsapBtn) {
    asapBtn = oldAsapBtn.cloneNode(true);
    oldAsapBtn.parentNode.replaceChild(asapBtn, oldAsapBtn);
  }

  const now = new Date();
  let cursor = new Date(now.getTime() + 20 * 60 * 1000); // start at now + 20min

  // Round up to next 15-min boundary
  const minuteRemainder = cursor.getMinutes() % 15;
  if (minuteRemainder !== 0) cursor.setMinutes(cursor.getMinutes() + (15 - minuteRemainder));
  cursor.setSeconds(0, 0);

  // End at last order time
  let lastOrderDate;
  try { lastOrderDate = parseTimeToDate(shop.lastOrder); }
  catch { lastOrderDate = new Date(now.getTime() + 4 * 60 * 60 * 1000); }

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

  // Wire ASAP button (freshly cloned)
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

  // Back button — clone to remove old listeners
  document.querySelectorAll('.back-btn[data-target="order"]').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => navigate('order'));
  });

  // Place order button — clone to remove old listeners
  const placeBtn = document.getElementById('place-order-btn');
  if (placeBtn) {
    const newPlaceBtn = placeBtn.cloneNode(true);
    placeBtn.parentNode.replaceChild(newPlaceBtn, placeBtn);
    newPlaceBtn.addEventListener('click', handlePlaceOrder);
  }

  // Past orders accordion
  initPastOrders();
}

/* ── Payment options ───────────────────────────────────────────────── */

function initPaymentOptions(shop) {
  const payPickup = document.getElementById('pay-pickup');
  const payUPI    = document.getElementById('pay-upi');
  const upiApps   = document.getElementById('upi-apps');

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
 *
 * FIX H4: Guards against the placeholder UPI VPA string. If the shop.upiId
 * still contains the placeholder text, shows an error instead of launching
 * a deep link that would send money to a non-existent payee address.
 *
 * FIX C3: Uses UPI.buildUPILink and UPI.launchUPI from the UPI namespace.
 * @param {string} app
 * @param {object} shop
 */
function handleUPIAppSelect(app, shop) {
  // FIX H4: Guard against placeholder VPA
  if (!shop.upiId || shop.upiId.includes('SHOP_UPI_VPA_RESOLVED_SERVER_SIDE') || shop.upiId.includes('PLACEHOLDER')) {
    showToast('Online payment is not set up for this shop yet. Please pay at pickup.', 'warning');
    return;
  }

  const orderId = 'LB-' + Date.now();
  const link    = UPI.buildUPILink({
    pa: shop.upiId,
    pn: shop.name,
    am: 0,            // TODO: actual quoted amount from shopkeeper
    tn: `LocalBuy Order #${orderId}`,
    cu: 'INR'
  });

  // Show waiting spinner
  const waiting = document.getElementById('upi-waiting');
  if (waiting) waiting.style.display = 'flex';

  // FIX C3: Use UPI.launchUPI
  UPI.launchUPI(link, app);
}

/* ── Place order ───────────────────────────────────────────────────── */

async function handlePlaceOrder() {
  const order = AppState.currentOrder;
  if (!order) return;

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
    const orderId = 'LB' + Date.now();
    order.id       = orderId;
    order.payment  = selectedPayment.value;
    order.status   = 'pending';

    // H7 NOTE: We intentionally omit photoDataUrl from localStorage to avoid
    // exceeding the 5MB quota. The photo is held in AppState only.
    const orderForStorage = Object.assign({}, order, { photoDataUrl: null });
    localStorage.setItem('lb_currentOrder', JSON.stringify(orderForStorage));

    saveOrderToHistory(order);

    await DB.createOrder(order);

    // FIX C3: Use Notifications.requestPushPermission
    await Notifications.requestPushPermission();

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

  const history = getOrderHistory();
  if (!history.length) {
    toggle.style.display = 'none';
    return;
  }

  toggle.style.display = 'flex';

  // Clone to remove old listeners
  const newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);

  newToggle.addEventListener('click', () => {
    const expanded = newToggle.getAttribute('aria-expanded') === 'true';
    newToggle.setAttribute('aria-expanded', String(!expanded));
    list.hidden = expanded;
    list.setAttribute('aria-hidden', String(expanded));
  });

  list.innerHTML = history.slice(0, 3).map(o => `
    <div class="past-order-item" data-order-text="${encodeURIComponent(o.text || '')}" tabindex="0" role="button" aria-label="Re-use order from ${o.shopName}">
      <div class="past-order-shop">${o.shopName}</div>
      <div class="past-order-preview">${(o.text || '').substring(0, 60)}${o.text && o.text.length > 60 ? '…' : ''}</div>
      <span class="past-order-reuse">↩ Re-use this list</span>
    </div>
  `).join('');

  // FIX M6: Navigate to order first, then populate textarea via a callback
  // so initCharCounter fires properly on the freshly-rendered textarea.
  list.querySelectorAll('.past-order-item').forEach(item => {
    item.addEventListener('click', () => {
      const text = decodeURIComponent(item.dataset.orderText);
      // Store the prefill text temporarily; onEnterOrder will pick it up
      AppState._prefillOrderText = text;
      navigate('order');
    });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
    });
  });
}

function saveOrderToHistory(order) {
  const key     = 'lb_orderHistory';
  const history = JSON.parse(localStorage.getItem(key) || '[]');
  history.unshift({ shopName: order.shopName, text: order.text, createdAt: order.createdAt });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 10)));
}

function getOrderHistory() {
  return JSON.parse(localStorage.getItem('lb_orderHistory') || '[]');
}


/* ─── SECTION: TRACKER ───────────────────────────────────────────────
   4-stage vertical timeline. Live countdown. Order code card.
*/

const TRACKER_STAGES = ['pending', 'quoted', 'packing', 'ready'];

let countdownTimer  = null;
let estimatedReady  = null;

// FIX L2: Store demo simulation timer ID so it can be cleared on re-entry.
let demoTimer = null;

function onEnterTracker() {
  const order = AppState.currentOrder;
  if (!order) { navigate('browse'); return; }

  setElText('tracker-order-id', order.id || 'LB-' + Date.now());
  setElText('tracker-shop-name', order.shopName);
  setElText('order-code', order.id || 'LB-XXXX');

  const shop    = AppState.currentShop;
  const readyIn = shop ? parseInt(shop.ready) : 10;
  estimatedReady = new Date(Date.now() + readyIn * 60 * 1000);

  startCountdown(estimatedReady);

  AppState.orderStatus = order.status || 'pending';
  updateTrackerUI(AppState.orderStatus);

  // Cancel order button — clone to avoid listener accumulation
  const cancelBtn = document.getElementById('cancel-order-btn');
  if (cancelBtn) {
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.style.display = 'block';
    newCancelBtn.addEventListener('click', () => {
      showConfirmDialog(
        'Cancel order?',
        'The shopkeeper will be notified. This cannot be undone.',
        () => cancelCurrentOrder()
      );
    });
  }

  // Quote buttons — clone to avoid accumulation
  const acceptBtn  = document.getElementById('accept-quote-btn');
  const declineBtn = document.getElementById('decline-quote-btn');
  if (acceptBtn) {
    const newAccept = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
    newAccept.addEventListener('click', acceptQuote);
  }
  if (declineBtn) {
    const newDecline = declineBtn.cloneNode(true);
    declineBtn.parentNode.replaceChild(newDecline, declineBtn);
    newDecline.addEventListener('click', () => {
      showConfirmDialog('Cancel order?', 'This order will be cancelled.', () => cancelCurrentOrder());
    });
  }

  // Copy code button — clone
  const copyCodeBtn = document.getElementById('copy-code-btn');
  if (copyCodeBtn) {
    const newCopyBtn = copyCodeBtn.cloneNode(true);
    copyCodeBtn.parentNode.replaceChild(newCopyBtn, copyCodeBtn);
    newCopyBtn.addEventListener('click', () => {
      const code = (document.getElementById('order-code') || {}).textContent;
      if (navigator.clipboard && code) {
        navigator.clipboard.writeText(code).then(() => showToast('Order code copied!', 'success'));
      }
    });
  }

  // "Order another" button — clone
  const orderAnotherBtn = document.getElementById('order-another-btn');
  if (orderAnotherBtn) {
    const newOtherBtn = orderAnotherBtn.cloneNode(true);
    orderAnotherBtn.parentNode.replaceChild(newOtherBtn, orderAnotherBtn);
    newOtherBtn.addEventListener('click', () => navigate('order'));
  }

  // FIX H3: Use DB.listenOrder (single-order listener) not DB.listenOrders (shop listener)
  startOrderListener(order.id);

  // FIX L2: Clear any previous demo timer before starting a new one
  clearInterval(demoTimer);
  demoTimer = null;
  simulateOrderProgression();
}

/**
 * updateTrackerUI(status) — advances the timeline to the given stage.
 */
function updateTrackerUI(status) {
  const stages = document.querySelectorAll('.timeline-stage');
  const currentIdx = TRACKER_STAGES.indexOf(status);

  stages.forEach((stage, i) => {
    const stageName = stage.dataset.stage;
    const idx       = TRACKER_STAGES.indexOf(stageName);

    stage.classList.remove('completed');
    stage.removeAttribute('aria-current');

    if (idx < currentIdx) {
      stage.classList.add('completed');
      stage.querySelector('.stage-dot').innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="11" fill="var(--color-sage)"/>
          <path d="M6.5 11l3 3 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else if (idx === currentIdx) {
      stage.setAttribute('aria-current', 'true');
      stage.querySelector('.stage-dot').innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="10" stroke="var(--color-sage)" stroke-width="2"/>
          <circle cx="11" cy="11" r="5" fill="var(--color-sage)"/>
        </svg>
      `;
    } else {
      stage.querySelector('.stage-dot').innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="10" stroke="var(--color-border)" stroke-width="2"/>
        </svg>
      `;
    }
  });

  const cancelBtn = document.getElementById('cancel-order-btn');
  if (cancelBtn) cancelBtn.style.display = status === 'pending' ? 'block' : 'none';

  const quoteCard = document.getElementById('quote-card');
  if (quoteCard) quoteCard.style.display = status === 'quoted' ? 'block' : 'none';

  const orderCodeCard = document.getElementById('order-code-card');
  if (orderCodeCard) {
    const showCode = status === 'packing' || status === 'ready';
    orderCodeCard.style.display = showCode ? 'block' : 'none';
  }

  if (status === 'ready') {
    clearInterval(countdownTimer);
    const countdownEl = document.getElementById('tracker-countdown');
    if (countdownEl) countdownEl.innerHTML = '✅ Ready for pickup!';
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
  DB.updateOrderStatus(AppState.currentOrder.id, 'packing', {});
  updateTrackerUI('packing');
  showToast('Quote accepted! Your order is being packed.', 'success');
}

/* ── Order cancellation ─────────────────────────────────────────────── */

function cancelCurrentOrder() {
  const order = AppState.currentOrder;
  if (!order) return;
  DB.cancelOrder(order.id, 'customer_cancelled');
  clearInterval(countdownTimer);
  clearInterval(demoTimer);
  demoTimer = null;
  showToast('Order cancelled. The shopkeeper has been notified.', 'info');
  setTimeout(() => navigate('browse'), 1500);
}

/* ── Order listener stub ────────────────────────────────────────────── */

/**
 * startOrderListener(orderId) — subscribes to single-order updates.
 *
 * FIX H3: Now calls DB.listenOrder (single-order listener keyed by orderId)
 * instead of DB.listenOrders (which is the shop-level listener keyed by shopId).
 * @param {string} orderId
 */
function startOrderListener(orderId) {
  if (AppState.unsubscribeOrders) AppState.unsubscribeOrders();

  // FIX H3: DB.listenOrder for customer tracker, not DB.listenOrders
  AppState.unsubscribeOrders = DB.listenOrder(orderId, (updatedOrder) => {
    if (!updatedOrder) return;
    AppState.orderStatus = updatedOrder.status;
    updateTrackerUI(updatedOrder.status);

    if (updatedOrder.status === 'quoted') {
      showQuote(updatedOrder.amount, updatedOrder.shopkeeperNote);
    }
  });
}

/* ── DEMO: Simulated status progression ─────────────────────────────
   FIX L2: Uses module-level demoTimer to prevent double-interval issue.
*/
function simulateOrderProgression() {
  const sequence = ['pending', 'quoted', 'packing', 'ready'];
  let step = 0;

  // FIX L2: Clear any existing timer before starting a new one
  clearInterval(demoTimer);

  demoTimer = setInterval(() => {
    step++;
    if (step >= sequence.length) {
      clearInterval(demoTimer);
      demoTimer = null;
      return;
    }

    const newStatus = sequence[step];
    AppState.orderStatus = newStatus;
    updateTrackerUI(newStatus);

    if (newStatus === 'quoted') {
      showQuote(347, 'No Tata Salt — added Captain Cook 1kg ✓\nMaggi available ✓');
    }

    if (newStatus === 'ready') {
      showToast('🎉 Your order is ready! Walk in to collect.', 'success');
    }
  }, 8000);
}


/* ─── CONFIRM DIALOG ─────────────────────────────────────────────────
   Replaces browser confirm(). No alert() or confirm() used.
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

  const escHandler = (e) => {
    if (e.key === 'Escape') { cleanup(); onCancel && onCancel(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}


/* ─── TOAST NOTIFICATIONS ────────────────────────────────────────────
   showToast(message, type) — shows a dismissible toast message.
   Delegates to the #toast-container in the DOM.
*/
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode === container) container.removeChild(toast);
    }, 300);
  }, 3500);
}


/* ─── UTILITY FUNCTIONS ─────────────────────────────────────────────── */

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

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

function formatTime12(date) {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatCurrency(amount) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch (_) {
    return `₹${Number(amount).toFixed(0)}`;
  }
}


/* ─── INIT ───────────────────────────────────────────────────────────── */

function init() {
  initModalListeners();

  const hash = window.location.hash.replace('#', '');
  const validSections = ['browse', 'order', 'checkout', 'tracker'];
  const startSection  = validSections.includes(hash) ? hash : 'browse';

  navigate(startSection);

  const savedOrder = localStorage.getItem('lb_currentOrder');
  if (savedOrder && startSection === 'tracker') {
    try {
      AppState.currentOrder = JSON.parse(savedOrder);
      AppState.currentShop = MOCK_SHOPS.find(s => s.id === AppState.currentOrder.shopId) || null;
    } catch (e) {
      console.warn('[Init] Could not restore saved order');
    }
  }

  // Handle prefill from past-order re-use (set by initPastOrders before navigate)
  if (AppState._prefillOrderText && startSection === 'order') {
    const textarea = document.getElementById('order-text');
    if (textarea) {
      textarea.value = AppState._prefillOrderText;
      // Trigger input event so char counter updates
      textarea.dispatchEvent(new Event('input'));
    }
    AppState._prefillOrderText = null;
  }

  DB.logEvent('customer_app_init', { section: startSection });
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}