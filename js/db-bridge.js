/* ============================================================
   LocalBuy — db-bridge.js
   Firebase-ready stub layer for all data operations.

   Every function here is a drop-in replacement point.
   When you're ready to go live:
     1. npm install firebase (or use CDN)
     2. Replace each stub body with the commented Firebase code
     3. Remove the console.log calls
   ============================================================ */

/* ── Mock Data ────────────────────────────────────────────── */
// These are the same shops referenced by customer.js and index.html.
// TODO: Replace with real Firestore collection query.
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
    announcement: '🎉 Fresh Assam tea leaves restocked every Monday!',
    ratings: 4.8,
    ratingCount: 34,
    upiId: 'STUB_VPA_DO_NOT_EXPOSE', // TODO: UPI VPA must be resolved server-side; never expose in frontend JS
    lat: 26.1445,
    lng: 91.7362,
    reviews: [
      { author: 'Priyanka B.', text: 'Always fresh stock, Rajesh-da is very helpful.', stars: 5 },
      { author: 'Amit K.',     text: 'Quick service, ordered Maggi and got it in 7 min!', stars: 5 },
      { author: 'Rupa D.',     text: 'Good variety, a bit crowded on Saturdays.', stars: 4 }
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
    announcement: null,
    ratings: 4.7,
    ratingCount: 58,
    upiId: 'STUB_VPA_DO_NOT_EXPOSE', // TODO: UPI VPA must be resolved server-side
    lat: 26.1420,
    lng: 91.7389,
    reviews: [
      { author: 'Dr. S. Bora', text: 'Always stocked with common generics. Very convenient.', stars: 5 },
      { author: 'Meena P.',    text: 'They called to confirm the prescription — proper service!', stars: 5 },
      { author: 'Rahul G.',    text: 'A bit slow at peak hours but reliable.', stars: 4 }
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
    announcement: '🎉 Fresh momo every Saturday morning!',
    ratings: 4.9,
    ratingCount: 120,
    upiId: 'STUB_VPA_DO_NOT_EXPOSE', // TODO: UPI VPA must be resolved server-side
    lat: 26.1388,
    lng: 91.7410,
    reviews: [
      { author: 'Lakhi D.',    text: 'The pork momo here is unmatched in all of Guwahati.', stars: 5 },
      { author: 'Bipul S.',    text: 'Bread is always fresh-baked. Order early!', stars: 5 },
      { author: 'Junu B.',     text: 'Love the luchi on Sunday mornings.', stars: 5 }
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
    announcement: null,
    ratings: 4.6,
    ratingCount: 22,
    upiId: 'STUB_VPA_DO_NOT_EXPOSE', // TODO: UPI VPA must be resolved server-side
    lat: 26.1350,
    lng: 91.7440,
    reviews: [
      { author: 'Sima H.',     text: 'Best Amul curd in the area, always chilled.', stars: 5 },
      { author: 'Nabajit K.',  text: 'Opens sharp at 5 AM — great for morning walkers.', stars: 4 },
      { author: 'Protima D.',  text: 'Closes by noon, plan accordingly.', stars: 4 }
    ]
  }
];

/* ── Mock Orders (for shopkeeper demo) ───────────────────────*/
const MOCK_ORDERS = [
  {
    id: 'LB-8472',
    shopId: 's1',
    customerName: 'Priyanka B.',
    customerPhone: 'REDACTED', // TODO: Encrypt at rest in Firebase, never log to console in production
    items: 'Tata Salt 1kg × 2\nAmul Butter 500g\nMaggi Noodles × 3\nAriel Detergent 1kg',
    photo: null,
    paymentMethod: 'cash',
    pickupTime: 'ASAP',
    scheduledDate: null,
    status: 'pending',
    orderedAt: new Date(Date.now() - 8 * 60000).toISOString(), // 8 min ago
    readyBy: new Date(Date.now() + 12 * 60000).toISOString(), // 12 min from now
    total: null,
    notes: '',
    urgency: 'green'
  },
  {
    id: 'LB-8471',
    shopId: 's1',
    customerName: 'Rahul Dev',
    customerPhone: 'REDACTED', // TODO: Encrypt at rest in Firebase, never log to console in production
    items: 'Colgate Toothpaste × 2\nDettol Soap × 3\nBoost 500g\nKokum Sharbat',
    photo: null,
    paymentMethod: 'upi',
    pickupTime: '2:30 PM',
    scheduledDate: null,
    status: 'quoted',
    orderedAt: new Date(Date.now() - 22 * 60000).toISOString(),
    readyBy: new Date(Date.now() + 8 * 60000).toISOString(),
    total: 347,
    notes: 'No Kokum Sharbat — added Rasna Orange instead.',
    urgency: 'amber'
  }
];

/* ── DB Bridge Object ─────────────────────────────────────── */
const DB = {

  // ── Shop operations ─────────────────────────────────────

  /**
   * Fetch shops, optionally filtered by category/status.
   * TODO: Replace with:
   *   let q = firebase.firestore().collection('shops');
   *   if (filters.category) q = q.where('category', '==', filters.category);
   *   return q.get().then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
   */
  getShops: (filters = {}) => {
    console.log('[DB] getShops', filters);
    let shops = [...MOCK_SHOPS];
    if (filters.category) {
      shops = shops.filter(s => s.category === filters.category);
    }
    return Promise.resolve(shops);
  },

  /**
   * Set shop online/offline status.
   * TODO: Replace with:
   *   return firebase.firestore().doc(`shops/${shopId}`).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
   */
  setShopStatus: (shopId, status) => {
    console.log('[DB] setShopStatus', shopId, status);
    // TODO: Replace with Firebase SDK update
    return Promise.resolve();
  },

  /**
   * Update shop opening hours.
   * TODO: Replace with:
   *   return firebase.firestore().doc(`shops/${shopId}`).update({ hours });
   */
  updateShopHours: (shopId, hours) => {
    console.log('[DB] updateShopHours', shopId, hours);
    // TODO: Replace with Firebase SDK update
    return Promise.resolve();
  },

  /**
   * Get a single shop by ID.
   * TODO: Replace with:
   *   return firebase.firestore().doc(`shops/${shopId}`).get().then(d => ({ id: d.id, ...d.data() }));
   */
  getShop: (shopId) => {
    console.log('[DB] getShop', shopId);
    const shop = MOCK_SHOPS.find(s => s.id === shopId);
    return Promise.resolve(shop || null);
  },

  // ── Order operations ───────────────────────────────────

  /**
   * Create a new customer order.
   * TODO: Replace with:
   *   return firebase.firestore().collection('orders').add({
   *     ...order,
   *     createdAt: firebase.firestore.FieldValue.serverTimestamp()
   *   });
   */
  createOrder: (order) => {
    console.log('[DB] createOrder', { ...order, customerPhone: '[REDACTED]' }); // Never log phone in production
    const id = 'LB-' + Math.floor(1000 + Math.random() * 8999);
    const savedOrder = { ...order, id, status: 'pending', createdAt: new Date().toISOString() };

    // Save to localStorage for offline resilience
    const orders = JSON.parse(localStorage.getItem('lb_orders') || '[]');
    orders.unshift(savedOrder);
    localStorage.setItem('lb_orders', JSON.stringify(orders.slice(0, 20))); // Keep last 20
    localStorage.setItem('lb_current_order', JSON.stringify(savedOrder));

    return Promise.resolve({ id, order: savedOrder });
  },

  /**
   * Update order status. Called by shopkeeper dashboard.
   * TODO: Replace with:
   *   return firebase.firestore().doc(`orders/${orderId}`).update({
   *     status, ...payload,
   *     updatedAt: firebase.firestore.FieldValue.serverTimestamp()
   *   });
   */
  updateOrderStatus: (orderId, status, payload = {}) => {
    console.log('[DB] updateOrderStatus', orderId, status, payload);
    // TODO: Replace with Firebase SDK update
    // Also triggers Firestore cloud function that sends SMS/push
    return Promise.resolve();
  },

  /**
   * Listen to live orders for a shop. Returns an unsubscribe function.
   * Called when shopkeeper dashboard opens.
   *
   * TODO: Replace with:
   *   const unsubscribe = firebase.firestore()
   *     .collection('orders')
   *     .where('shopId', '==', shopId)
   *     .where('status', 'not-in', ['completed', 'cancelled'])
   *     .orderBy('createdAt', 'desc')
   *     .onSnapshot(snapshot => {
   *       const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
   *       callback(orders);
   *     });
   *   return unsubscribe;
   */
  listenOrders: (shopId, callback) => {
    console.log('[DB] listenOrders registered for shop:', shopId);

    // Stub: immediately deliver mock orders, then simulate a new order after 15s
    setTimeout(() => callback([...MOCK_ORDERS]), 500);

    // Simulate new incoming order for demo purposes
    const demoTimer = setTimeout(() => {
      const newOrder = {
        id: 'LB-' + Math.floor(8000 + Math.random() * 999),
        shopId,
        customerName: 'Dimpi Saikia',
        customerPhone: 'REDACTED',
        items: 'Horlicks 500g\nMilk 1L × 2\nBread (white)',
        photo: null,
        paymentMethod: 'cash',
        pickupTime: 'ASAP',
        status: 'pending',
        orderedAt: new Date().toISOString(),
        readyBy: new Date(Date.now() + 15 * 60000).toISOString(),
        total: null,
        notes: '',
        urgency: 'green'
      };
      callback([newOrder, ...MOCK_ORDERS]);
    }, 15000);

    // Return unsubscribe function
    return () => {
      clearTimeout(demoTimer);
      console.log('[DB] listenOrders unsubscribed for', shopId);
    };
  },

  /**
   * Cancel an order.
   * TODO: Replace with:
   *   return firebase.firestore().doc(`orders/${orderId}`).update({
   *     status: 'cancelled', cancelReason: reason,
   *     cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
   *   });
   */
  cancelOrder: (orderId, reason) => {
    console.log('[DB] cancelOrder', orderId, reason);
    // TODO: Replace with Firebase SDK update + trigger customer notification
    return Promise.resolve();
  },

  /**
   * Get order history for a customer (from localStorage for now).
   * TODO: Replace with:
   *   return firebase.firestore()
   *     .collection('orders')
   *     .where('customerId', '==', customerId)
   *     .orderBy('createdAt', 'desc')
   *     .limit(10)
   *     .get();
   */
  getOrderHistory: () => {
    const orders = JSON.parse(localStorage.getItem('lb_orders') || '[]');
    return Promise.resolve(orders);
  },

  // ── Customer notification hooks ──────────────────────────

  /**
   * Trigger SMS + push when order is ready for pickup.
   * TODO: Replace with:
   *   Cloud Function automatically fires on Firestore write (status → 'ready').
   *   Or: return fetch('/api/notify/ready', { method: 'POST', body: JSON.stringify({ orderId }) });
   */
  notifyCustomerReady: (orderId) => {
    console.log('[DB] SMS hook: order ready for pickup', orderId);
    // TODO: POST to backend → triggers Firebase Cloud Messaging + SMS gateway
    return Promise.resolve();
  },

  /**
   * Send quote (total + notes) to customer via push notification.
   * TODO: Replace with:
   *   Cloud Function fires on Firestore write (status → 'quoted').
   *   Or: return fetch('/api/notify/quote', { method: 'POST', body: JSON.stringify({ orderId, amount, notes }) });
   */
  notifyCustomerQuoted: (orderId, amount, notes) => {
    console.log('[DB] Push: quote sent to customer', orderId, { amount, notes });
    // TODO: POST to backend → triggers Push notification to customer's device
    return Promise.resolve();
  },

  // ── Shopkeeper registration ──────────────────────────────

  /**
   * Submit a new shopkeeper registration request.
   * TODO: Replace with:
   *   return firebase.firestore().collection('registrations').add({
   *     ...data,
   *     submittedAt: firebase.firestore.FieldValue.serverTimestamp()
   *   });
   *   Then trigger welcome email/SMS via Cloud Function.
   */
  submitRegistration: (data) => {
    console.log('[DB] submitRegistration', { ...data, phone: '[REDACTED]' });
    // TODO: Replace with Firebase SDK add
    return Promise.resolve({ success: true });
  },

  // ── Analytics (privacy-first — zero PII) ─────────────────

  /**
   * Log an analytics event. No PII allowed here.
   * TODO: Replace with:
   *   firebase.analytics().logEvent(name, params);
   *   Or: PostHog / Plausible / Umami for privacy-preserving analytics.
   */
  logEvent: (name, params = {}) => {
    console.log('[Analytics]', name, params);
    // TODO: Replace with Firebase Analytics or privacy-preserving alternative
  }
};