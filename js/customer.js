/**
 * customer.js — LocalBuy Customer Hub Logic
 * Handles all customer-facing SPA navigation and interactions:
 *   - Section navigation (navigate())
 *   - Shop browsing, search, filter
 *   - Shop modal (bottom sheet)
 *   - Order interface (type list / photo upload / time slots)
 *   - Checkout (payment selection, UPI deep link + QR, "I have paid")
 *   - Live order tracker (status polling every 3s, countdown)
 *
 * Dependencies (load order in HTML):
 *   i18n.js → db-bridge.js → geo.js → upi.js → notifications.js → app.js → customer.js
 *   qrcode.js (for UPI QR rendering)
 *
 * FIXES APPLIED:
 *   FIX C1: MOCK_SHOPS resolved via window.MOCK_SHOPS from db-bridge.js.
 *   FIX C3: Geo.*, Notifications.*, UPI.* namespace usage.
 *   FIX H1: Back-button target from SECTION_META.backTarget.
 *   FIX H3: startOrderListener uses DB.listenOrder.
 *   FIX H4: handleUPIAppSelect guards placeholder UPI VPA.
 *   FIX L2: simulateOrderProgression clears demoTimer before re-running.
 *
 *   NEW FIXES (per spec):
 *   FIX N1: Shops render immediately on load — onEnterBrowse calls applyFilters(),
 *            not just renderShopCards(MOCK_SHOPS), so cards appear without user interaction.
 *   FIX N2: "Near Me" GPS uses navigator.geolocation.getCurrentPosition + Haversine sort;
 *            shows inline notice if denied/unavailable.
 *   FIX N3: Pay at Pickup is default selected; only disabled if shop.acceptsCash === false.
 *   FIX N4: UPI flow builds real upi://pay?pa=... deep link via window.location.href;
 *            QR rendered via QRCode.js; "I have paid" button advances the order.
 *   FIX N5: handlePlaceOrder saves full order to localStorage under 'localbuy_orders' array.
 *   FIX N6: Past orders panel reads from 'localbuy_orders' in localStorage.
 *   FIX N7: Photo upload uses FileReader for base64 data URL; preview in checkout is correct.
 *   FIX N8: 3-second polling interval syncs order status from shopkeeper page.
 */

'use strict';

/* ─── APP STATE ────────────────────────────────────────────────────── */

const AppState = {
  currentShop:    null,
  currentOrder:   null,
  orderStatus:    null,
  quoteAmount:    null,
  quoteNotes:     '',
  selectedTime:   'asap',
  activeSection:  'browse',
  activeCategory: 'all',
  searchQuery:    '',
  isPreOrder:     false,
  unsubscribeOrders: null,
  currentPhotoDataUrl: null,
  _prefillOrderText: null
};

/* ─── SECTION NAVIGATION ─────────────────────────────────────────── */

const SECTION_META = {
  browse:   { title: 'Browse Shops',   showBack: false, backTarget: null     },
  order:    { title: 'Place Order',    showBack: true,  backTarget: 'browse' },
  checkout: { title: 'Review & Pay',   showBack: true,  backTarget: 'order'  },
  tracker:  { title: 'Order Status',   showBack: false, backTarget: null     }
};

function navigate(sectionId) {
  document.querySelectorAll('.app-section').forEach(el => {
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  });

  const target = document.getElementById('section-' + sectionId);
  if (!target) { console.warn('[navigate] Section not found:', sectionId); return; }
  target.style.display = 'block';
  target.removeAttribute('aria-hidden');

  const meta = SECTION_META[sectionId] || {};
  const titleEl = document.getElementById('header-section-title');
  const backBtn = document.getElementById('header-back-btn');
  if (titleEl) titleEl.textContent = meta.title || '';

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
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (sectionId === 'browse')   onEnterBrowse();
  if (sectionId === 'order')    onEnterOrder();
  if (sectionId === 'checkout') onEnterCheckout();
  if (sectionId === 'tracker')  onEnterTracker();
}

/* ─── SECTION: BROWSE ─────────────────────────────────────────────── */

/**
 * FIX N1: onEnterBrowse now calls applyFilters() (which reads AppState.activeCategory
 * and AppState.searchQuery) instead of bare renderShopCards(MOCK_SHOPS).
 * This guarantees cards appear immediately on page load with no user interaction.
 */
function onEnterBrowse() {
  initSearch();
  initCategoryChips();
  initGPSButton();
  applyFilters(); // FIX N1: render shops immediately
}

function renderShopCards(shops) {
  const grid = document.getElementById('shop-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid) return;

  grid.querySelectorAll('.skeleton').forEach(el => el.remove());

  if (!shops || shops.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  grid.innerHTML = shops.map(shop => buildShopCardHTML(shop)).join('');

  grid.querySelectorAll('.shop-card').forEach(card => {
    card.addEventListener('click', () => {
      const shopId = card.dataset.shopId;
      const shop = (window.MOCK_SHOPS || []).find(s => s.id === shopId);
      if (shop) openShopModal(shop);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
}

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

/* ── Search ─────────────────────────────────────────────────────────── */

let searchDebounceTimer = null;

function initSearch() {
  const input = document.getElementById('shop-search');
  const clearBtn = document.getElementById('search-clear');
  if (!input) return;

  if (!document.getElementById('lb-search-webkit-style')) {
    const style = document.createElement('style');
    style.id = 'lb-search-webkit-style';
    style.textContent = `
      .search-input::-webkit-search-cancel-button,
      .search-input::-webkit-search-decoration { display: none; }
    `;
    document.head.appendChild(style);
  }

  // Clone to remove any prior listeners
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  newInput.addEventListener('input', () => {
    if (clearBtn) clearBtn.style.display = newInput.value ? 'flex' : 'none';
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      AppState.searchQuery = newInput.value.trim().toLowerCase();
      applyFilters();
    }, 300);
  });

  if (clearBtn) {
    const newClearBtn = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    newClearBtn.addEventListener('click', () => {
      newInput.value = '';
      newClearBtn.style.display = 'none';
      AppState.searchQuery = '';
      applyFilters();
      newInput.focus();
    });
  }
}

/* ── Category chips ─────────────────────────────────────────────────── */

function initCategoryChips() {
  const chips = document.querySelectorAll('#category-chips .chip');
  chips.forEach(chip => {
    // Clone to remove accumulated listeners
    const newChip = chip.cloneNode(true);
    chip.parentNode.replaceChild(newChip, chip);
    newChip.addEventListener('click', () => {
      document.querySelectorAll('#category-chips .chip').forEach(c => {
        c.classList.remove('chip-active');
        c.setAttribute('aria-pressed', 'false');
      });
      newChip.classList.add('chip-active');
      newChip.setAttribute('aria-pressed', 'true');
      AppState.activeCategory = newChip.dataset.cat;
      applyFilters();
    });
  });
}

/**
 * applyFilters() — filters window.MOCK_SHOPS by active category + search query.
 * FIX N1: Called directly from onEnterBrowse so shops appear on load.
 */
function applyFilters() {
  const shops = window.MOCK_SHOPS || [];
  let filtered = [...shops];

  if (AppState.activeCategory && AppState.activeCategory !== 'all') {
    filtered = filtered.filter(s => s.category === AppState.activeCategory);
  }

  if (AppState.searchQuery) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(AppState.searchQuery) ||
      s.category.toLowerCase().includes(AppState.searchQuery)
    );
  }

  renderShopCards(filtered);
}

/* ── GPS / Near Me button ───────────────────────────────────────────── */

/**
 * FIX N2: "Near Me" GPS uses navigator.geolocation.getCurrentPosition directly
 * with Haversine distance sort. Shows inline notice if permission denied.
 * Falls back to Geo.getUserLocation if available.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function initGPSButton() {
  const btn = document.getElementById('gps-sort-btn');
  if (!btn) return;

  // Clone to remove old listeners
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener('click', () => {
    newBtn.disabled = true;
    newBtn.setAttribute('aria-label', 'Detecting your location…');
    const label = newBtn.querySelector('.gps-btn-label');
    if (label) label.textContent = 'Locating…';

    if (!navigator.geolocation) {
      showLocationBanner('📍 Geolocation not supported by your browser.', 'info');
      if (label) label.textContent = 'Near me';
      newBtn.disabled = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        const shops = window.MOCK_SHOPS || [];

        const sorted = [...shops].sort((a, b) => {
          // Each shop should have lat/lon; fall back to parsing distance string
          const distA = (a.lat && a.lon)
            ? haversineDistance(userLat, userLon, a.lat, a.lon)
            : parseFloat(a.distance) || 999;
          const distB = (b.lat && b.lon)
            ? haversineDistance(userLat, userLon, b.lat, b.lon)
            : parseFloat(b.distance) || 999;
          return distA - distB;
        });

        renderShopCards(sorted);
        showLocationBanner('📍 Showing shops nearest to you', 'success');
        if (label) label.textContent = 'Near me ✓';
        newBtn.disabled = false;
        newBtn.setAttribute('aria-label', 'Sort by my location');
      },
      (err) => {
        let msg = '📍 Location access denied — showing all shops';
        if (err.code === err.POSITION_UNAVAILABLE) msg = '📍 Location unavailable — showing all shops';
        if (err.code === err.TIMEOUT)             msg = '📍 Location timed out — showing all shops';
        showLocationBanner(msg, 'info');
        if (label) label.textContent = 'Near me';
        newBtn.disabled = false;
        newBtn.setAttribute('aria-label', 'Sort by my location');
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  });

  // Reset filters button (inside empty state)
  const resetBtn = document.getElementById('reset-filters-btn');
  if (resetBtn) {
    const newReset = resetBtn.cloneNode(true);
    resetBtn.parentNode.replaceChild(newReset, resetBtn);
    newReset.addEventListener('click', () => {
      AppState.activeCategory = 'all';
      AppState.searchQuery = '';
      const searchInput = document.getElementById('shop-search');
      if (searchInput) searchInput.value = '';
      document.querySelectorAll('#category-chips .chip').forEach(c => {
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
  if (closeBtn) closeBtn.onclick = () => { banner.style.display = 'none'; };
  setTimeout(() => { banner.style.display = 'none'; }, 4000);
}

/* ─── SECTION: SHOP MODAL ─────────────────────────────────────────── */

function openShopModal(shop) {
  AppState.currentShop = shop;

  setElText('modal-shop-emoji', shop.emoji);
  setElText('modal-shop-name', shop.name);
  setElText('modal-category-badge', capitalize(shop.category));

  const announcementEl   = document.getElementById('modal-announcement');
  const announcementText = document.getElementById('modal-announcement-text');
  if (shop.announcement && announcementEl && announcementText) {
    announcementText.textContent = shop.announcement;
    announcementEl.style.display = 'block';
  } else if (announcementEl) {
    announcementEl.style.display = 'none';
  }

  setElText('modal-hours', shop.hours);
  const lastOrderEl = document.getElementById('modal-last-order');
  if (lastOrderEl) lastOrderEl.innerHTML = `Last order accepted at <strong>${shop.lastOrder}</strong>`;

  renderModalStatus(shop);

  setElText('modal-rating-avg', shop.rating.toFixed(1));
  setElText('modal-rating-count', `· ${shop.ratingCount} ratings`);
  renderReviews(shop.reviews || []);

  const overlay = document.getElementById('section-modal');
  if (overlay) {
    overlay.classList.add('is-open');
    overlay.removeAttribute('aria-hidden');
    requestAnimationFrame(() => overlay.classList.add('active'));
    setTimeout(() => {
      const closeBtn = document.getElementById('modal-close-btn');
      if (closeBtn) closeBtn.focus();
    }, 100);
  }

  document.body.style.overflow = 'hidden';
}

function closeShopModal() {
  const overlay = document.getElementById('section-modal');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.addEventListener('transitionend', () => {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }, { once: true });
  }
  document.body.style.overflow = '';
}

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

function renderReviews(reviews) {
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

  const toggle = document.getElementById('reviews-toggle');
  if (toggle) {
    const newToggle = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(newToggle, toggle);
    newToggle.onclick = () => {
      const expanded = newToggle.getAttribute('aria-expanded') === 'true';
      newToggle.setAttribute('aria-expanded', String(!expanded));
      list.hidden = expanded;
      list.setAttribute('aria-hidden', String(expanded));
      const chevron = newToggle.querySelector('.chevron');
      if (chevron) chevron.style.transform = expanded ? '' : 'rotate(180deg)';
    };
  }
}

/* ── Modal event listeners ──────────────────────────────────────────── */

function initModalListeners() {
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeShopModal);

  const backdrop = document.getElementById('modal-backdrop');
  if (backdrop) backdrop.addEventListener('click', closeShopModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('section-modal');
      if (overlay && overlay.classList.contains('is-open')) closeShopModal();
    }
  });

  // FIX H1: Header back button reads data-target set by navigate()
  const headerBackBtn = document.getElementById('header-back-btn');
  if (headerBackBtn) {
    headerBackBtn.addEventListener('click', () => {
      const target = headerBackBtn.dataset.target;
      if (target) navigate(target);
    });
  }
}

/* ─── SECTION: ORDER ─────────────────────────────────────────────── */

function onEnterOrder() {
  const shop = AppState.currentShop;
  if (!shop) { navigate('browse'); return; }

  setElText('order-shop-name', shop.name);
  switchOrderTab('type');
  initOrderTabs();
  buildTimeSlots(shop);
  initCharCounter();
  initPhotoUpload(); // FIX N7: proper FileReader-based photo upload

  // Apply prefill text from past orders (FIX N6)
  if (AppState._prefillOrderText) {
    const textarea = document.getElementById('order-text');
    if (textarea) {
      textarea.value = AppState._prefillOrderText;
      textarea.dispatchEvent(new Event('input'));
    }
    AppState._prefillOrderText = null;
  }

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

  // Back buttons — clone
  document.querySelectorAll('.back-btn[data-target="browse"]').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => navigate('browse'));
  });

  // Review order button — clone
  const reviewBtn = document.getElementById('review-order-btn');
  if (reviewBtn) {
    const newReviewBtn = reviewBtn.cloneNode(true);
    reviewBtn.parentNode.replaceChild(newReviewBtn, reviewBtn);
    newReviewBtn.addEventListener('click', handleReviewOrder);
  }

  if (AppState.isPreOrder) showToast('📅 Pre-ordering for tomorrow', 'info');
}

/* ── Order tabs ─────────────────────────────────────────────────────── */

function initOrderTabs() {
  const tabType  = document.getElementById('tab-type');
  const tabPhoto = document.getElementById('tab-photo');

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
  const tabType    = document.getElementById('tab-type');
  const tabPhoto   = document.getElementById('tab-photo');
  const panelType  = document.getElementById('tab-panel-type');
  const panelPhoto = document.getElementById('tab-panel-photo');
  const isType     = tab === 'type';

  if (tabType)  { tabType.classList.toggle('order-tab-active', isType);  tabType.setAttribute('aria-selected', String(isType)); }
  if (tabPhoto) { tabPhoto.classList.toggle('order-tab-active', !isType); tabPhoto.setAttribute('aria-selected', String(!isType)); }
  if (panelType)  panelType.hidden  = !isType;
  if (panelPhoto) panelPhoto.hidden = isType;
}

/* ── Character counter ──────────────────────────────────────────────── */

function initCharCounter() {
  const textarea = document.getElementById('order-text');
  const countEl  = document.getElementById('char-count');
  if (!textarea || !countEl) return;

  const newTextarea = textarea.cloneNode(true);
  textarea.parentNode.replaceChild(newTextarea, textarea);

  newTextarea.addEventListener('input', () => {
    const len = newTextarea.value.length;
    countEl.textContent = `${len} / 1000`;
    countEl.classList.toggle('near-limit', len > 900);
  });
}

/* ── Photo upload — FIX N7 ──────────────────────────────────────────── */

/**
 * FIX N7: Photo upload uses FileReader to produce a base64 data URL.
 * The data URL is stored in AppState.currentPhotoDataUrl and rendered
 * as a preview both in the order section and in checkout summary.
 */
function initPhotoUpload() {
  const input     = document.getElementById('photo-input');
  const preview   = document.getElementById('photo-preview');
  const thumb     = document.getElementById('photo-thumb');
  const removeBtn = document.getElementById('photo-remove-btn');

  if (!input) return;

  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);

  newInput.addEventListener('change', () => {
    const file = newInput.files && newInput.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      AppState.currentPhotoDataUrl = dataUrl;

      if (thumb)   { thumb.src = dataUrl; thumb.alt = 'Order photo preview'; }
      if (preview) preview.style.display = 'flex';

      switchOrderTab('photo');
      showToast('Photo attached ✓', 'success');
    };
    reader.onerror = () => {
      showToast('Could not read the image file. Please try again.', 'error');
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
  if (thumb)   { thumb.src = ''; thumb.alt = ''; }
  if (preview) preview.style.display = 'none';
}

/* ── Time slots ─────────────────────────────────────────────────────── */

function buildTimeSlots(shop) {
  const wrapper = document.getElementById('time-slots-wrapper');
  if (!wrapper) return;

  wrapper.querySelectorAll('.time-slot:not([data-time="asap"])').forEach(el => el.remove());

  // FIX M4: Clone ASAP button to clear accumulated listeners
  const oldAsapBtn = wrapper.querySelector('[data-time="asap"]');
  let asapBtn = null;
  if (oldAsapBtn) {
    asapBtn = oldAsapBtn.cloneNode(true);
    oldAsapBtn.parentNode.replaceChild(asapBtn, oldAsapBtn);
  }

  const now = new Date();
  let cursor = new Date(now.getTime() + 20 * 60 * 1000);
  const minuteRemainder = cursor.getMinutes() % 15;
  if (minuteRemainder !== 0) cursor.setMinutes(cursor.getMinutes() + (15 - minuteRemainder));
  cursor.setSeconds(0, 0);

  let lastOrderDate;
  try { lastOrderDate = parseTimeToDate(shop.lastOrder); }
  catch { lastOrderDate = new Date(now.getTime() + 4 * 60 * 60 * 1000); }

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

  if (asapBtn) {
    asapBtn.addEventListener('click', () => selectTimeSlot(asapBtn, 'asap'));
    selectTimeSlot(asapBtn, 'asap');
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

/* ── Review order validation ────────────────────────────────────────── */

function handleReviewOrder() {
  const textarea    = document.getElementById('order-text');
  const textContent = textarea ? textarea.value.trim() : '';
  const hasPhoto    = !!AppState.currentPhotoDataUrl;

  if (!textContent && !hasPhoto) {
    showToast('Please type your shopping list or upload a photo.', 'warning');
    textarea && textarea.focus();
    return;
  }

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

/* ─── SECTION: CHECKOUT ──────────────────────────────────────────── */

function onEnterCheckout() {
  const order = AppState.currentOrder;
  const shop  = AppState.currentShop;
  if (!order || !shop) { navigate('browse'); return; }

  setElText('checkout-shop-emoji', shop.emoji);
  setElText('checkout-shop-name', shop.name);
  setElText('checkout-summary-meta',
    order.pickupTime === 'asap'
      ? 'Walk in as soon as ready'
      : `Walk in at ${formatTime12(new Date(order.pickupTime))}`
  );

  const itemsEl = document.getElementById('summary-items-text');
  if (itemsEl) itemsEl.textContent = order.text || '(Photo list attached)';

  // FIX N7: Render photo preview in checkout summary
  const summaryPhoto = document.getElementById('summary-photo');
  const summaryThumb = document.getElementById('summary-photo-thumb');
  if (order.photoDataUrl && summaryPhoto && summaryThumb) {
    summaryThumb.src = order.photoDataUrl;
    summaryThumb.alt = 'Attached order photo';
    summaryPhoto.style.display = 'flex';
  } else if (summaryPhoto) {
    summaryPhoto.style.display = 'none';
  }

  // FIX N3: Pay at Pickup default + conditional disable
  initPaymentOptions(shop);

  // Back buttons — clone
  document.querySelectorAll('.back-btn[data-target="order"]').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => navigate('order'));
  });

  // Place order button — clone
  const placeBtn = document.getElementById('place-order-btn');
  if (placeBtn) {
    const newPlaceBtn = placeBtn.cloneNode(true);
    placeBtn.parentNode.replaceChild(newPlaceBtn, placeBtn);
    newPlaceBtn.addEventListener('click', handlePlaceOrder);
  }

  initPastOrders();
}

/* ── Payment options — FIX N3 + N4 ────────────────────────────────── */

/**
 * FIX N3: Pay at Pickup is selected by default.
 * It is only disabled (with an overlay) if shop.acceptsCash === false.
 * FIX N4: UPI flow launches real upi://pay deep link, renders QR via QRCode.js,
 * and shows "I have paid" button to advance the order.
 */
function initPaymentOptions(shop) {
  const payPickup = document.getElementById('pay-pickup');
  const payUPI    = document.getElementById('pay-upi');
  const upiSection = document.getElementById('upi-apps');
  const pickupDisabledOverlay = document.getElementById('pickup-disabled-overlay');

  // FIX N3: default to Pay at Pickup unless shop.acceptsCash === false
  const cashEnabled = shop.acceptsCash !== false;

  if (payPickup) {
    if (!cashEnabled) {
      payPickup.disabled = true;
      if (pickupDisabledOverlay) pickupDisabledOverlay.style.display = 'flex';
    } else {
      payPickup.disabled = false;
      if (pickupDisabledOverlay) pickupDisabledOverlay.style.display = 'none';
      // Set default selection
      payPickup.checked = true;
      if (AppState.currentOrder) AppState.currentOrder.payment = 'pickup';
      if (upiSection) upiSection.style.display = 'none';
    }
  }

  // If cash disabled, auto-select UPI
  if (!cashEnabled && payUPI) {
    payUPI.checked = true;
    if (AppState.currentOrder) AppState.currentOrder.payment = 'upi';
    if (upiSection) upiSection.style.display = 'block';
    buildUPISection(shop);
  }

  // Clone radio listeners to avoid accumulation
  if (payPickup) {
    const newPayPickup = payPickup.cloneNode(true);
    payPickup.parentNode.replaceChild(newPayPickup, payPickup);
    if (!cashEnabled) {
      newPayPickup.disabled = true;
    } else {
      newPayPickup.checked = true;
      newPayPickup.addEventListener('change', () => {
        if (AppState.currentOrder) AppState.currentOrder.payment = 'pickup';
        if (upiSection) upiSection.style.display = 'none';
      });
    }
  }

  if (payUPI) {
    const newPayUPI = payUPI.cloneNode(true);
    payUPI.parentNode.replaceChild(newPayUPI, payUPI);
    if (!cashEnabled) newPayUPI.checked = true;
    newPayUPI.addEventListener('change', () => {
      if (AppState.currentOrder) AppState.currentOrder.payment = 'upi';
      if (upiSection) upiSection.style.display = 'block';
      buildUPISection(shop);
    });
  }

  // UPI app buttons (existing pattern for app-specific deep links)
  document.querySelectorAll('.upi-app-btn').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => handleUPIAppSelect(newBtn.dataset.app, shop));
  });
}

/**
 * buildUPISection(shop) — renders the UPI QR code and deep link button.
 * FIX N4: Generates real upi://pay?pa=... URI, renders QR via QRCode.js.
 */
function buildUPISection(shop) {
  const upiSection = document.getElementById('upi-apps');
  if (!upiSection) return;

  if (!shop.upiId || shop.upiId.includes('PLACEHOLDER') || shop.upiId.includes('SHOP_UPI_VPA')) {
    upiSection.innerHTML = `
      <p class="upi-unavailable-msg" style="color:var(--color-muted,#6b7280);font-size:13px;padding:8px 0;">
        🚫 UPI payment not set up for this shop. Please pay at pickup.
      </p>
    `;
    return;
  }

  const orderId   = AppState.currentOrder ? AppState.currentOrder.id || ('LB-' + Date.now()) : ('LB-' + Date.now());
  const amount    = AppState.quoteAmount || 0;
  const upiParams = new URLSearchParams({
    pa: shop.upiId,
    pn: encodeURIComponent(shop.name),
    am: amount > 0 ? amount.toFixed(2) : '',
    tn: encodeURIComponent('LocalBuy Order #' + orderId),
    cu: 'INR'
  });
  const upiUri = 'upi://pay?' + upiParams.toString();

  upiSection.innerHTML = `
    <div id="upi-qr-container" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px 0;">
      <div id="upi-qr-canvas" style="background:#fff;padding:8px;border-radius:8px;"></div>
      <p style="font-size:12px;color:var(--color-muted,#6b7280);text-align:center;margin:0;">
        Scan with any UPI app
      </p>
      <a
        href="${upiUri}"
        id="upi-open-app-btn"
        class="upi-open-btn"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--color-sage,#0f5c3a);color:#fff;border-radius:24px;font-size:14px;font-weight:600;text-decoration:none;"
        aria-label="Open UPI app to pay"
      >
        💳 Open UPI App
      </a>
      <button
        id="upi-paid-btn"
        class="upi-paid-btn"
        style="margin-top:4px;padding:10px 20px;background:transparent;border:2px solid var(--color-sage,#0f5c3a);color:var(--color-sage,#0f5c3a);border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;"
        aria-label="I have completed the UPI payment"
      >
        ✅ I Have Paid
      </button>
    </div>
  `;

  // Render QR code via QRCode.js (if library available)
  const qrContainer = document.getElementById('upi-qr-canvas');
  if (qrContainer && typeof QRCode !== 'undefined') {
    new QRCode(qrContainer, {
      text: upiUri,
      width: 180,
      height: 180,
      colorDark: '#111827',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } else if (qrContainer) {
    // Fallback: show the UPI URI as text if QRCode.js not loaded
    qrContainer.innerHTML = `<code style="font-size:10px;word-break:break-all;max-width:200px;display:block;">${upiUri}</code>`;
  }

  // "Open UPI App" uses window.location.href for the deep link (FIX N4)
  const openAppBtn = document.getElementById('upi-open-app-btn');
  if (openAppBtn) {
    openAppBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = upiUri;
    });
  }

  // "I Have Paid" button — advances to order placed state
  const paidBtn = document.getElementById('upi-paid-btn');
  if (paidBtn) {
    paidBtn.addEventListener('click', () => {
      if (AppState.currentOrder) AppState.currentOrder.payment = 'upi_confirmed';
      showToast('Payment noted! Placing your order…', 'success');
      setTimeout(() => handlePlaceOrder(), 800);
    });
  }
}

/**
 * handleUPIAppSelect — FIX H4: guards placeholder VPA; FIX N4: uses window.location.href.
 */
function handleUPIAppSelect(app, shop) {
  if (!shop.upiId || shop.upiId.includes('SHOP_UPI_VPA_RESOLVED_SERVER_SIDE') || shop.upiId.includes('PLACEHOLDER')) {
    showToast('Online payment is not set up for this shop yet. Please pay at pickup.', 'warning');
    return;
  }

  const orderId = AppState.currentOrder ? AppState.currentOrder.id || ('LB-' + Date.now()) : ('LB-' + Date.now());
  const upiParams = new URLSearchParams({
    pa: shop.upiId,
    pn: encodeURIComponent(shop.name),
    am: AppState.quoteAmount ? AppState.quoteAmount.toFixed(2) : '',
    tn: encodeURIComponent('LocalBuy Order #' + orderId),
    cu: 'INR'
  });

  const appPrefixes = {
    gpay:    'tez://upi/pay?',
    phonepe: 'phonepe://pay?',
    paytm:   'paytmmp://pay?',
    bhim:    'bhim://pay?'
  };

  const prefix = appPrefixes[app] || 'upi://pay?';
  const deepLink = prefix + upiParams.toString();

  // FIX N4: Use window.location.href for deep link
  window.location.href = deepLink;

  const waiting = document.getElementById('upi-waiting');
  if (waiting) waiting.style.display = 'flex';
}

/* ── Place order — FIX N5 ───────────────────────────────────────────── */

/**
 * FIX N5: handlePlaceOrder saves the full order object to localStorage
 * under the 'localbuy_orders' array (not just 'lb_currentOrder').
 */
async function handlePlaceOrder() {
  const order = AppState.currentOrder;
  if (!order) return;

  const selectedPaymentEl = document.querySelector('.payment-radio:checked');
  const paymentMethod = selectedPaymentEl
    ? selectedPaymentEl.value
    : (order.payment || null);

  if (!paymentMethod) {
    showToast('Please select a payment method to continue.', 'warning');
    return;
  }

  const placeBtn = document.getElementById('place-order-btn');
  if (placeBtn) {
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing order…';
  }

  try {
    const orderId   = 'LB' + Date.now();
    order.id        = orderId;
    order.payment   = paymentMethod;
    order.status    = 'pending';
    order.updatedAt = new Date().toISOString();

    // FIX N5: Save to 'localbuy_orders' array in localStorage
    saveOrderToLocalStorage(order);

    // Also persist current order reference (without large photo data)
    const orderForRef = Object.assign({}, order, { photoDataUrl: null });
    localStorage.setItem('lb_currentOrder', JSON.stringify(orderForRef));

    // Legacy history (for backwards compat with initPastOrders)
    saveOrderToHistory(order);

    await DB.createOrder(order);

    // FIX C3
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

/**
 * FIX N5: Saves full order to 'localbuy_orders' array in localStorage.
 * Strips photoDataUrl to avoid quota issues.
 */
function saveOrderToLocalStorage(order) {
  const key    = 'localbuy_orders';
  let   orders = [];
  try {
    orders = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (_) {
    orders = [];
  }

  // Store without photo binary data to avoid 5MB quota
  const orderToStore = Object.assign({}, order, { photoDataUrl: null });

  // Update existing order if same id, otherwise prepend
  const existingIdx = orders.findIndex(o => o.id === order.id);
  if (existingIdx >= 0) {
    orders[existingIdx] = orderToStore;
  } else {
    orders.unshift(orderToStore);
  }

  // Keep last 50 orders
  try {
    localStorage.setItem(key, JSON.stringify(orders.slice(0, 50)));
  } catch (e) {
    console.warn('[saveOrderToLocalStorage] Storage quota hit, trimming history.');
    try {
      localStorage.setItem(key, JSON.stringify(orders.slice(0, 10)));
    } catch (_) {}
  }
}

/**
 * updateOrderInLocalStorage(orderId, updates) — patches an existing order in 'localbuy_orders'.
 */
function updateOrderInLocalStorage(orderId, updates) {
  const key    = 'localbuy_orders';
  let   orders = [];
  try { orders = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}

  const idx = orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    orders[idx] = Object.assign({}, orders[idx], updates, { updatedAt: new Date().toISOString() });
    try { localStorage.setItem(key, JSON.stringify(orders)); } catch (_) {}
  }
}

/* ── Past orders — FIX N6 ───────────────────────────────────────────── */

/**
 * FIX N6: Past orders panel reads from 'localbuy_orders' in localStorage
 * and renders them with their current status.
 */
function initPastOrders() {
  const toggle = document.getElementById('past-orders-toggle');
  const list   = document.getElementById('past-orders-list');
  if (!toggle || !list) return;

  // Read from 'localbuy_orders' (FIX N6)
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem('localbuy_orders') || '[]');
  } catch (_) {
    orders = [];
  }

  // Fallback to legacy lb_orderHistory if localbuy_orders is empty
  if (!orders.length) {
    orders = getOrderHistory();
  }

  if (!orders.length) {
    toggle.style.display = 'none';
    return;
  }

  toggle.style.display = 'flex';

  const newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);

  newToggle.addEventListener('click', () => {
    const expanded = newToggle.getAttribute('aria-expanded') === 'true';
    newToggle.setAttribute('aria-expanded', String(!expanded));
    list.hidden = expanded;
    list.setAttribute('aria-hidden', String(expanded));
  });

  const statusLabels = {
    pending: '🟡 Pending',
    quoted:  '💬 Quoted',
    packing: '📦 Packing',
    ready:   '✅ Ready',
    cancelled: '❌ Cancelled',
    completed: '✔ Completed'
  };

  list.innerHTML = orders.slice(0, 5).map(o => {
    const statusBadge = o.status ? `<span class="past-order-status">${statusLabels[o.status] || o.status}</span>` : '';
    const preview = (o.text || '').substring(0, 60) + (o.text && o.text.length > 60 ? '…' : '');
    return `
      <div
        class="past-order-item"
        data-order-text="${encodeURIComponent(o.text || '')}"
        tabindex="0"
        role="button"
        aria-label="Re-use order from ${o.shopName}"
      >
        <div class="past-order-shop">${o.shopName || ''}${statusBadge}</div>
        <div class="past-order-preview">${preview || '(photo order)'}</div>
        <span class="past-order-reuse">↩ Re-use this list</span>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.past-order-item').forEach(item => {
    item.addEventListener('click', () => {
      const text = decodeURIComponent(item.dataset.orderText);
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
  history.unshift({
    shopName:  order.shopName,
    text:      order.text,
    status:    order.status,
    createdAt: order.createdAt
  });
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(0, 10)));
  } catch (_) {}
}

function getOrderHistory() {
  try {
    return JSON.parse(localStorage.getItem('lb_orderHistory') || '[]');
  } catch (_) {
    return [];
  }
}

/* ─── SECTION: TRACKER ───────────────────────────────────────────── */

const TRACKER_STAGES = ['pending', 'quoted', 'packing', 'ready'];

let countdownTimer = null;
let estimatedReady = null;
let demoTimer      = null; // FIX L2

// FIX N8: 3-second polling interval for order status sync
let statusPollTimer = null;

function onEnterTracker() {
  const order = AppState.currentOrder;
  if (!order) { navigate('browse'); return; }

  setElText('tracker-order-id', order.id || 'LB-' + Date.now());
  setElText('tracker-shop-name', order.shopName);
  setElText('order-code', order.id || 'LB-XXXX');

  const shop    = AppState.currentShop;
  const readyIn = shop ? parseInt(shop.ready) || 10 : 10;
  estimatedReady = new Date(Date.now() + readyIn * 60 * 1000);

  startCountdown(estimatedReady);

  AppState.orderStatus = order.status || 'pending';
  updateTrackerUI(AppState.orderStatus);

  // Cancel order button — clone
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

  // Quote buttons — clone
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

  // FIX H3: Use DB.listenOrder (single-order listener)
  startOrderListener(order.id);

  // FIX L2: Clear any previous demo timer
  clearInterval(demoTimer);
  demoTimer = null;
  simulateOrderProgression();

  // FIX N8: Start 3-second polling for status sync with shopkeeper page
  startStatusPolling(order.id);
}

/**
 * FIX N8: startStatusPolling — polls DB every 3 seconds for order status updates.
 * This complements the Firestore real-time listener and ensures status changes
 * made on the shopkeeper page are reflected promptly even if the listener lags.
 */
function startStatusPolling(orderId) {
  clearInterval(statusPollTimer);
  statusPollTimer = null;

  if (!orderId) return;

  statusPollTimer = setInterval(async () => {
    try {
      const updatedOrder = await DB.getOrder(orderId);
      if (!updatedOrder) return;

      // Only update if status actually changed
      if (updatedOrder.status && updatedOrder.status !== AppState.orderStatus) {
        AppState.orderStatus = updatedOrder.status;
        updateTrackerUI(updatedOrder.status);

        // Sync to localbuy_orders
        updateOrderInLocalStorage(orderId, { status: updatedOrder.status });

        if (updatedOrder.status === 'quoted') {
          showQuote(updatedOrder.amount, updatedOrder.shopkeeperNote);
        }
        if (updatedOrder.status === 'ready') {
          showToast('🎉 Your order is ready! Walk in to collect.', 'success');
          clearInterval(statusPollTimer);
          statusPollTimer = null;
        }
        if (updatedOrder.status === 'cancelled') {
          showToast('Order was cancelled.', 'info');
          clearInterval(statusPollTimer);
          statusPollTimer = null;
          setTimeout(() => navigate('browse'), 2000);
        }
      }
    } catch (err) {
      // Silently swallow polling errors (network issues, etc.)
      console.warn('[statusPoll] Error fetching order:', err);
    }
  }, 3000);
}

function stopStatusPolling() {
  clearInterval(statusPollTimer);
  statusPollTimer = null;
}

function updateTrackerUI(status) {
  const stages     = document.querySelectorAll('.timeline-stage');
  const currentIdx = TRACKER_STAGES.indexOf(status);

  stages.forEach((stage) => {
    const stageName = stage.dataset.stage;
    const idx       = TRACKER_STAGES.indexOf(stageName);

    stage.classList.remove('completed');
    stage.removeAttribute('aria-current');

    const dot = stage.querySelector('.stage-dot');
    if (!dot) return;

    if (idx < currentIdx) {
      stage.classList.add('completed');
      dot.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="11" fill="var(--color-sage)"/>
          <path d="M6.5 11l3 3 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else if (idx === currentIdx) {
      stage.setAttribute('aria-current', 'true');
      dot.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="10" stroke="var(--color-sage)" stroke-width="2"/>
          <circle cx="11" cy="11" r="5" fill="var(--color-sage)"/>
        </svg>
      `;
    } else {
      dot.innerHTML = `
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
    orderCodeCard.style.display = (status === 'packing' || status === 'ready') ? 'block' : 'none';
  }

  if (status === 'ready') {
    clearInterval(countdownTimer);
    const countdownEl = document.getElementById('tracker-countdown');
    if (countdownEl) countdownEl.innerHTML = '✅ Ready for pickup!';
    stopStatusPolling();
  }
}

/* ── Countdown timer ────────────────────────────────────────────────── */

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
  updateOrderInLocalStorage(AppState.currentOrder.id, { status: 'packing' });
  updateTrackerUI('packing');
  showToast('Quote accepted! Your order is being packed.', 'success');
}

/* ── Order cancellation ─────────────────────────────────────────────── */

function cancelCurrentOrder() {
  const order = AppState.currentOrder;
  if (!order) return;
  DB.cancelOrder(order.id, 'customer_cancelled');
  updateOrderInLocalStorage(order.id, { status: 'cancelled' });
  clearInterval(countdownTimer);
  clearInterval(demoTimer);
  demoTimer = null;
  stopStatusPolling();
  showToast('Order cancelled. The shopkeeper has been notified.', 'info');
  setTimeout(() => navigate('browse'), 1500);
}

/* ── Order listener — FIX H3 ────────────────────────────────────────── */

/**
 * FIX H3: Uses DB.listenOrder (single-order listener keyed by orderId).
 */
function startOrderListener(orderId) {
  if (AppState.unsubscribeOrders) {
    AppState.unsubscribeOrders();
    AppState.unsubscribeOrders = null;
  }

  AppState.unsubscribeOrders = DB.listenOrder(orderId, (updatedOrder) => {
    if (!updatedOrder) return;
    AppState.orderStatus = updatedOrder.status;
    updateTrackerUI(updatedOrder.status);
    updateOrderInLocalStorage(orderId, { status: updatedOrder.status });

    if (updatedOrder.status === 'quoted') {
      showQuote(updatedOrder.amount, updatedOrder.shopkeeperNote);
    }
  });
}

/* ── Demo simulation — FIX L2 ──────────────────────────────────────── */

function simulateOrderProgression() {
  const sequence = ['pending', 'quoted', 'packing', 'ready'];
  let step = 0;

  clearInterval(demoTimer); // FIX L2: always clear before re-running

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
    updateOrderInLocalStorage(
      AppState.currentOrder ? AppState.currentOrder.id : '',
      { status: newStatus }
    );

    if (newStatus === 'quoted') {
      showQuote(347, 'No Tata Salt — added Captain Cook 1kg ✓\nMaggi available ✓');
    }
    if (newStatus === 'ready') {
      showToast('🎉 Your order is ready! Walk in to collect.', 'success');
    }
  }, 8000);
}

/* ─── CONFIRM DIALOG ─────────────────────────────────────────────── */

function showConfirmDialog(title, body, onConfirm, onCancel) {
  const dialog    = document.getElementById('confirm-dialog');
  const titleEl   = document.getElementById('confirm-title');
  const bodyEl    = document.getElementById('confirm-body');
  const okBtn     = document.getElementById('confirm-ok-btn');
  const cancelBtn = document.getElementById('confirm-cancel-btn');

  if (!dialog) return;

  if (titleEl) titleEl.textContent = title;
  if (bodyEl)  bodyEl.textContent  = body;

  dialog.style.display = 'flex';
  dialog.removeAttribute('aria-hidden');

  setTimeout(() => okBtn && okBtn.focus(), 50);

  const cleanup = () => {
    dialog.style.display = 'none';
    dialog.setAttribute('aria-hidden', 'true');
    okBtn     && okBtn.removeEventListener('click', handleOk);
    cancelBtn && cancelBtn.removeEventListener('click', handleCancel);
  };

  const handleOk     = () => { cleanup(); onConfirm && onConfirm(); };
  const handleCancel = () => { cleanup(); onCancel  && onCancel();  };

  okBtn     && okBtn.addEventListener('click', handleOk);
  cancelBtn && cancelBtn.addEventListener('click', handleCancel);

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cleanup();
      onCancel && onCancel();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/* ─── TOAST NOTIFICATIONS ────────────────────────────────────────── */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode === container) container.removeChild(toast);
    }, 300);
  }, 3500);
}

/* ─── UTILITY FUNCTIONS ──────────────────────────────────────────── */

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

  let hours  = parseInt(match[1]);
  const mins = parseInt(match[2]);
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
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 0
    }).format(amount);
  } catch (_) {
    return `₹${Number(amount).toFixed(0)}`;
  }
}

/* ─── INIT ──────────────────────────────────────────────────────── */

function init() {
  initModalListeners();

  const hash          = window.location.hash.replace('#', '');
  const validSections = ['browse', 'order', 'checkout', 'tracker'];
  const startSection  = validSections.includes(hash) ? hash : 'browse';

  navigate(startSection);

  // Restore saved order for tracker deep-link
  if (startSection === 'tracker') {
    const savedOrder = localStorage.getItem('lb_currentOrder');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (parsed && parsed.id) {
          AppState.currentOrder = parsed;
          AppState.currentShop  = (window.MOCK_SHOPS || []).find(s => s.id === parsed.shopId) || null;
        }
      } catch (e) {
        console.warn('[Init] Could not restore saved order');
      }
    }
  }

  // Handle prefill from past-order re-use
  if (AppState._prefillOrderText && startSection === 'order') {
    const textarea = document.getElementById('order-text');
    if (textarea) {
      textarea.value = AppState._prefillOrderText;
      textarea.dispatchEvent(new Event('input'));
    }
    AppState._prefillOrderText = null;
  }

  // Clean up polling and timers on page unload
  window.addEventListener('beforeunload', () => {
    stopStatusPolling();
    clearInterval(countdownTimer);
    clearInterval(demoTimer);
    if (AppState.unsubscribeOrders) AppState.unsubscribeOrders();
  });

  DB.logEvent('customer_app_init', { section: startSection });
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}