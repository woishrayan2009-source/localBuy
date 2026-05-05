/**
 * db-bridge.js — LocalBuy
 * ─────────────────────────────────────────────────────────────────────────────
 * All data operations are stubbed here. Every function is annotated with a
 * // TODO: Replace with Firebase SDK comment so integration is drop-in ready.
 *
 * Pattern:
 *   - Reads  → return Promise.resolve(mockData)
 *   - Writes → console.log the payload, return Promise.resolve({ success: true })
 *   - Listeners → return an unsubscribe function (no-op for now)
 *
 * Firebase SDK swap guide:
 *   1. npm install firebase  (or load from CDN)
 *   2. Replace each stub body with the Firestore / RTDB call shown in the TODO
 *   3. Remove the MOCK_* constants once real data flows
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ─── Mock data (remove when Firebase is live) ──────────────────────────── */

// FIX C1: MOCK_SHOPS is declared ONLY here. customer.js no longer declares
// its own MOCK_SHOPS, eliminating the "Cannot redeclare block-scoped variable"
// ReferenceError. customer.js accesses shops via the window.MOCK_SHOPS global
// exported at the bottom of this file.
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
    address: 'Fancy Bazar, Guwahati',
    rating: 4.8,
    ratingCount: 23,
    upiId: 'sharma.store@upi',      // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    requiresPrePayment: false,
    announcement: null,
    tags: ['groceries', 'daily essentials', 'pulses', 'spices']
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
    address: 'Pan Bazar, Guwahati',
    rating: 4.9,
    ratingCount: 41,
    upiId: 'citymedical@upi',       // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    requiresPrePayment: false,
    announcement: '🎉 Free blood pressure check every Saturday morning!',
    tags: ['medicines', 'health', 'vitamins', 'first aid']
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
    address: 'Paltan Bazar, Guwahati',
    rating: 4.7,
    ratingCount: 18,
    upiId: 'kamakhyabakery@upi',    // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    requiresPrePayment: false,
    announcement: '🎉 Fresh momo every Saturday morning!',
    tags: ['bread', 'cake', 'pastry', 'momo', 'snacks']
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
    address: 'Ulubari, Guwahati',
    rating: 4.6,
    ratingCount: 12,
    upiId: 'krishnadairy@upi',      // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    requiresPrePayment: false,
    announcement: null,
    tags: ['milk', 'curd', 'paneer', 'butter', 'ghee']
  },
  {
    id: 's5',
    name: 'Bora Stationery House',
    category: 'stationery',
    emoji: '✏️',
    distance: '0.6 km',
    ready: '7 min',
    status: 'open',
    hours: '9:00 AM – 7:00 PM',
    lastOrder: '6:45 PM',
    address: 'Silpukhuri, Guwahati',
    rating: 4.5,
    ratingCount: 9,
    upiId: 'borastationery@upi',    // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    requiresPrePayment: false,
    announcement: null,
    tags: ['pens', 'notebooks', 'art supplies', 'school']
  },
  {
    id: 's6',
    name: 'Nandini Fish Market',
    category: 'fish',
    emoji: '🐟',
    distance: '1.4 km',
    ready: '10 min',
    status: 'busy',
    hours: '5:00 AM – 11:00 AM',
    lastOrder: '10:30 AM',
    address: 'Pan Bazar, Guwahati',
    rating: 4.7,
    ratingCount: 31,
    upiId: 'nandinifish@upi',       // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    requiresPrePayment: false,
    announcement: '🎉 Fresh Rohu and Catla daily from Brahmaputra!',
    tags: ['rohu', 'catla', 'prawns', 'hilsa', 'fresh fish']
  }
];

/* Mock reviews per shop
 * FIX: Added `initials` field to every review object.
 * customer.js renderReviews() uses r.initials to populate the avatar element.
 * Without this field the avatar rendered as blank/undefined text.
 */
const MOCK_REVIEWS = {
  s1: [
    { initials: 'PB', name: 'Priyanka B.', role: 'Regular customer', rating: 5, text: 'Quick and easy. Ordered from office, walked in on the way home. Rajesh bhaiya always keeps things ready!', date: '2 days ago' },
    { initials: 'AD', name: 'Amit D.',     role: 'Verified buyer',   rating: 5, text: 'Best kirana in Fancy Bazar. Never out of stock for essentials.', date: '1 week ago' },
    { initials: 'MK', name: 'Meena K.',    role: 'Local resident',   rating: 4, text: 'Good service. Slight wait time but staff is helpful.', date: '2 weeks ago' }
  ],
  s2: [
    { initials: 'SH', name: 'Dr. S. Hazarika', role: 'Physician',         rating: 5, text: 'Always have the medicines I need. No waiting. Perfect.', date: '3 days ago' },
    { initials: 'RB', name: 'Rupa B.',          role: 'Regular customer',  rating: 5, text: 'Ordered rare BP medicines — ready in 4 minutes. Impressive.', date: '5 days ago' },
    { initials: 'TG', name: 'Tarun G.',          role: 'Verified buyer',    rating: 5, text: 'Very professional. Staff double-checks prescriptions.', date: '1 week ago' }
  ],
  s3: [
    { initials: 'SP', name: 'Sunita P.',  role: 'Regular customer', rating: 5, text: 'Ordered birthday cake from office. It was ready when I walked in. Delicious!', date: '1 day ago' },
    { initials: 'KN', name: 'Kamal N.',   role: 'Local resident',   rating: 4, text: 'Great momos every Saturday. Worth the walk from Paltan Bazar.', date: '4 days ago' },
    { initials: 'LB', name: 'Lily B.',    role: 'Verified buyer',   rating: 5, text: 'Freshest bread in the neighbourhood. Always warm.', date: '1 week ago' }
  ],
  s4: [
    { initials: 'BC', name: 'Bhaswati C.', role: 'Daily customer',  rating: 5, text: 'Pure milk, no dilution. Best paneer in Ulubari!', date: '2 days ago' },
    { initials: 'HS', name: 'Hemen S.',    role: 'Regular buyer',   rating: 4, text: 'Early morning pickup works perfectly for daily milk.', date: '3 days ago' },
    { initials: 'AD', name: 'Ankita D.',   role: 'Local resident',  rating: 5, text: 'Ghee quality is excellent. Worth the early wake-up.', date: '1 week ago' }
  ],
  s5: [],
  s6: [
    { initials: 'DB', name: 'Dilip B.',    role: 'Regular customer', rating: 5, text: 'Always fresh catch. Rohu was packed and ready to cook!', date: '1 day ago' },
    { initials: 'MR', name: 'Maya R.',     role: 'Local resident',   rating: 4, text: 'Good fish, very fresh. Bit busy in mornings.', date: '3 days ago' },
    { initials: 'PS', name: 'Pankaj S.',   role: 'Verified buyer',   rating: 5, text: 'Best hilsa in Guwahati. They know their fish!', date: '5 days ago' }
  ]
};

/* ─── DB Namespace (exported to window for other modules) ─────────────────── */

const DB = {

  /* ── Shop operations ──────────────────────────────────────────────────── */

  /**
   * Fetch all shops, optionally filtered by category / search term.
   * @param {Object} filters — { category: string, search: string }
   * @returns {Promise<Array>}
   *
   * TODO: Replace with:
   *   let ref = firebase.firestore().collection('shops').where('active', '==', true);
   *   if (filters.category) ref = ref.where('category', '==', filters.category);
   *   const snap = await ref.get();
   *   return snap.docs.map(d => ({ id: d.id, ...d.data() }));
   */
  getShops(filters = {}) {
    let shops = [...MOCK_SHOPS];

    if (filters.category && filters.category !== 'all') {
      shops = shops.filter(s => s.category === filters.category);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      shops = shops.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.includes(q))
      );
    }

    return Promise.resolve(shops);
  },

  /**
   * Fetch a single shop by ID.
   * @param {string} shopId
   * @returns {Promise<Object|null>}
   *
   * TODO: Replace with:
   *   const doc = await firebase.firestore().collection('shops').doc(shopId).get();
   *   return doc.exists ? { id: doc.id, ...doc.data() } : null;
   */
  getShop(shopId) {
    const shop = MOCK_SHOPS.find(s => s.id === shopId) || null;
    return Promise.resolve(shop);
  },

  /**
   * Set shop open/closed status.
   * @param {string} shopId
   * @param {'open'|'busy'|'closed'|'offline'} status
   *
   * TODO: Replace with:
   *   await firebase.firestore().collection('shops').doc(shopId).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
   */
  setShopStatus(shopId, status) {
    console.log('[DB] setShopStatus', shopId, status);
    return Promise.resolve({ success: true });
  },

  /**
   * Update shop hours.
   * @param {string} shopId
   * @param {{ open: string, close: string, lastOrder: string }} hours
   *
   * TODO: Replace with:
   *   await firebase.firestore().collection('shops').doc(shopId).update({ hours });
   */
  updateShopHours(shopId, hours) {
    console.log('[DB] updateShopHours', shopId, hours);
    return Promise.resolve({ success: true });
  },

  /**
   * Fetch reviews for a shop.
   * @param {string} shopId
   * @returns {Promise<Array>}
   *
   * TODO: Replace with:
   *   const snap = await firebase.firestore().collection('shops').doc(shopId).collection('reviews').orderBy('createdAt', 'desc').limit(3).get();
   *   return snap.docs.map(d => d.data());
   */
  getReviews(shopId) {
    return Promise.resolve(MOCK_REVIEWS[shopId] || []);
  },

  /* ── Order operations ─────────────────────────────────────────────────── */

  /**
   * Create a new customer order.
   * @param {Object} order — full order payload
   * @returns {Promise<{ id: string }>}
   *
   * TODO: Replace with:
   *   const ref = await firebase.firestore().collection('orders').add({
   *     ...order,
   *     createdAt: firebase.firestore.FieldValue.serverTimestamp(),
   *     status: 'pending'
   *   });
   *   return { id: ref.id };
   *
   * NOTE: Customer phone numbers in order payload
   * TODO: Encrypt at rest in Firebase, never log to console in production
   */
  createOrder(order) {
    const id = 'LB-' + Math.floor(1000 + Math.random() * 9000);
    console.log('[DB] createOrder — payload omitted in production', { id, shopId: order.shopId });
    return Promise.resolve({ id });
  },

  /**
   * Update the status of an existing order.
   * @param {string} orderId
   * @param {'pending'|'quoted'|'packing'|'ready'|'collected'|'cancelled'} status
   * @param {Object} payload — e.g., { amount: 347, notes: '...' } for quoted status
   *
   * TODO: Replace with:
   *   await firebase.firestore().collection('orders').doc(orderId).update({
   *     status,
   *     ...payload,
   *     updatedAt: firebase.firestore.FieldValue.serverTimestamp()
   *   });
   */
  updateOrderStatus(orderId, status, payload = {}) {
    console.log('[DB] updateOrderStatus', orderId, status, payload);
    return Promise.resolve({ success: true });
  },

  /**
   * Real-time listener for orders belonging to a shop.
   * @param {string} shopId
   * @param {Function} callback — called with array of order objects on change
   * @returns {Function} unsubscribe
   *
   * TODO: Replace with:
   *   return firebase.firestore()
   *     .collection('orders')
   *     .where('shopId', '==', shopId)
   *     .where('status', 'in', ['pending', 'quoted', 'packing', 'ready'])
   *     .orderBy('createdAt', 'desc')
   *     .onSnapshot(snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
   */
  listenOrders(shopId, callback) {
    console.log('[DB] listenOrders registered for', shopId);
    // Stub: return no-op unsubscribe function
    return () => {};
  },

  /**
   * Real-time listener for a single order (customer tracker).
   * @param {string} orderId
   * @param {Function} callback — called with order object on every update
   * @returns {Function} unsubscribe
   *
   * TODO: Replace with:
   *   return firebase.firestore()
   *     .collection('orders')
   *     .doc(orderId)
   *     .onSnapshot(doc => callback({ id: doc.id, ...doc.data() }));
   */
  listenOrder(orderId, callback) {
    console.log('[DB] listenOrder registered for', orderId);

    // Stub: simulate a status progression for demo purposes
    // Remove this entire setTimeout chain when Firebase is live
    let stage = 0;
    const stages = ['pending', 'quoted', 'packing', 'ready'];
    const mockOrderBase = JSON.parse(localStorage.getItem('lb_current_order') || '{}');

    const advance = () => {
      if (stage >= stages.length) return;
      const mockOrder = {
        ...mockOrderBase,
        id: orderId,
        status: stages[stage],
        amount: stage >= 1 ? 347 : null,
        shopkeeperNote: stage >= 1 ? 'No Tata Salt — added Captain Cook 1kg ✓' : null
      };
      callback(mockOrder);
      stage++;
      if (stage < stages.length) setTimeout(advance, 15000); // advance every 15s in demo
    };

    setTimeout(advance, 500); // initial callback after short delay

    return () => { stage = stages.length; }; // unsubscribe stops progression
  },

  /**
   * Cancel an order.
   * @param {string} orderId
   * @param {string} reason
   *
   * TODO: Replace with:
   *   await firebase.firestore().collection('orders').doc(orderId).update({
   *     status: 'cancelled',
   *     cancelReason: reason,
   *     cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
   *   });
   */
  cancelOrder(orderId, reason) {
    console.log('[DB] cancelOrder', orderId, reason);
    return Promise.resolve({ success: true });
  },

  /**
   * Fetch past orders for a customer (from localStorage in stub).
   * @param {string} customerPhone — hashed/anonymised in production
   * @returns {Promise<Array>}
   *
   * TODO: Replace with:
   *   const snap = await firebase.firestore()
   *     .collection('orders')
   *     .where('customerPhoneHash', '==', hash(customerPhone))
   *     .orderBy('createdAt', 'desc')
   *     .limit(5)
   *     .get();
   *   return snap.docs.map(d => ({ id: d.id, ...d.data() }));
   */
  getPastOrders() {
    try {
      return Promise.resolve(
        JSON.parse(localStorage.getItem('lb_past_orders') || '[]')
      );
    } catch {
      return Promise.resolve([]);
    }
  },

  /* ── Customer notification hooks ──────────────────────────────────────── */

  /**
   * Trigger SMS to customer when order is ready for pickup.
   * @param {string} orderId
   *
   * TODO: Replace with a Cloud Function trigger:
   *   This should be called from a Firestore trigger (not frontend) for security.
   *   Cloud Function: onOrderReady → send SMS via Twilio/MSG91 with pickup code.
   */
  notifyCustomerReady(orderId) {
    console.log('[DB] SMS hook: order ready', orderId);
    return Promise.resolve({ success: true });
  },

  /**
   * Push notification to customer when shopkeeper sends quote.
   * @param {string} orderId
   * @param {number} amount
   * @param {string} notes
   *
   * TODO: Replace with a Cloud Function trigger that sends Web Push
   *   via the stored push subscription for this order's customer.
   */
  notifyCustomerQuoted(orderId, amount, notes) {
    console.log('[DB] Push: quote sent', orderId, { amount });
    return Promise.resolve({ success: true });
  },

  /* ── Analytics (privacy-first, no PII) ───────────────────────────────── */

  /**
   * Log an analytics event. No personally identifiable information.
   * @param {string} name — event name, e.g., 'order_placed', 'shop_viewed'
   * @param {Object} params — non-PII params only
   *
   * TODO: Replace with:
   *   firebase.analytics().logEvent(name, params);
   *   OR a privacy-first alternative like Plausible / Umami.
   *   NEVER log phone numbers, names, or order content here.
   */
  logEvent(name, params = {}) {
    // TODO: Replace with real analytics (Firebase Analytics / Plausible)
    console.log('[Analytics]', name, params);
  }
};

/* ─── Export to window ────────────────────────────────────────────────────── */
window.DB = DB;
window.MOCK_SHOPS = MOCK_SHOPS; // Remove when Firebase is live