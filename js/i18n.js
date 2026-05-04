/* ============================================================
   LocalBuy — i18n.js
   Internationalisation: English / Hindi / Bengali / Assamese
   
   Usage:
     i18n.setLang('en')
     i18n.t('shift.startBtn')
     i18n.t('order.total', { amount: '₹347' })
   ============================================================ */

const STRINGS = {

  // ── English ──────────────────────────────────────────────
  en: {
    // Shift management
    'shift.greeting':        'Good morning',
    'shift.statusOffline':   '🔴 Offline — Shop is hidden from customers',
    'shift.statusOnline':    '🟢 Online — Customers can find you',
    'shift.startBtn':        'Start Shift',
    'shift.endBtn':          'End Shift',
    'shift.endConfirmTitle': 'End shift?',
    'shift.endConfirmBody':  'Your shop will go offline. Pending orders will remain.',
    'shift.endConfirmYes':   'Yes, end shift',
    'shift.endConfirmNo':    'Keep going',
    'shift.closingSoon':     '⏰ Shop closes at {time}. Last orders soon.',
    'shift.autoClosing':     'Shift ended automatically at closing time.',
    'shift.summaryTitle':    'Shift complete 🎉',
    'shift.ordersCompleted': 'Orders completed',
    'shift.totalEarnings':   'Total earnings',
    'shift.avgTime':         'Avg. ready time',
    'shift.pendingWarning':  '{n} orders still pending. Contact customers directly.',
    'shift.exportWA':        'Export via WhatsApp',
    'shift.startNew':        'Start new shift',
    'shift.alreadyStarted':  'Resume shift',

    // Dashboard
    'dashboard.title':       'Orders',
    'dashboard.ordersToday': 'Orders today',
    'dashboard.earningsToday': 'Earnings',
    'dashboard.avgReadyTime': 'Avg. ready time',
    'dashboard.noOrders':    'No active orders.',
    'dashboard.noOrdersSub': 'Your next order will appear here.',
    'dashboard.pullRefresh': '↑ Pull to refresh',

    // Order card & panel
    'order.payAtPickup':     'Pay at pickup',
    'order.paidOnline':      'Paid online (UPI)',
    'order.readyBy':         'Ready by',
    'order.tapManage':       'Tap to manage →',
    'order.customerOrder':   'Customer\'s list',
    'order.billLabel':       'Total bill amount',
    'order.billPlaceholder': '0.00',
    'order.notesLabel':      'Notes for customer (optional)',
    'order.notesPlaceholder':'e.g., No Tata Salt — added Captain Cook 1kg ✓\nMaggi not available today.',
    'order.oosLabel':        'Mark items out of stock',
    'order.sendQuote':       'Send Quote',
    'order.markPacking':     'Mark as Packing',
    'order.markReady':       '🎉 Ready for Pickup!',
    'order.cancelOrder':     'Cancel order',
    'order.cancelConfirm':   'Are you sure? The customer will be notified.',
    'order.cancelYes':       'Yes, cancel',
    'order.cancelNo':        'Keep order',
    'order.total':           'Total: {amount}',
    'order.quoteNote':       'Substitution note',
    'order.photosAttached':  'Photo list attached',
    'order.newAlert':        '🚨 New Order!',
    'order.statusPending':   'Pending Review',
    'order.statusQuoted':    'Quoted',
    'order.statusPacking':   'Packing',
    'order.statusReady':     'Ready for Pickup',
    'order.statusCancelled': 'Cancelled',

    // Register
    'register.title':        'List your shop',
    'register.subtitle':     'Join 120+ local shops on LocalBuy. Free for 3 months.',
    'register.shopName':     'Shop name',
    'register.shopNamePh':   'e.g., Sharma General Store',
    'register.ownerName':    'Your name',
    'register.ownerNamePh':  'e.g., Rajesh Kalita',
    'register.phone':        'Mobile number',
    'register.phonePh':      '10-digit number',
    'register.category':     'Shop type',
    'register.area':         'Area in Guwahati',
    'register.areaPh':       'e.g., Ulubari, Fancy Bazar...',
    'register.upiId':        'UPI ID (optional)',
    'register.upiIdPh':      'yourname@upi',
    'register.submit':       'Request listing — it\'s free',
    'register.success':      'Request sent! We\'ll call you within 24 hours.',

    // Notifications
    'notif.newOrder.title':  '🚨 New Order!',
    'notif.newOrder.body':   'A customer just placed an order.',
    'notif.ready.title':     '✅ Order Ready!',
    'notif.ready.body':      'Walk in and collect your items.',

    // Status labels
    'status.open':    'Open',
    'status.busy':    'Busy',
    'status.closed':  'Closed',
    'status.online':  '🟢 Online',
    'status.offline': '🔴 Offline',

    // Language names (for toggle)
    'lang.en': 'EN',
    'lang.hi': 'हि',
    'lang.bn': 'বা',
    'lang.as': 'অ',

    // Common
    'common.min':     'min',
    'common.km':      'km',
    'common.cancel':  'Cancel',
    'common.confirm': 'Confirm',
    'common.close':   'Close',
    'common.save':    'Save',
    'common.back':    'Back',
    'common.mins':    'mins',
  },

  // ── Hindi ─────────────────────────────────────────────────
  hi: {
    'shift.greeting':        'सुप्रभात',
    'shift.statusOffline':   '🔴 ऑफ़लाइन — दुकान छुपी हुई है',
    'shift.statusOnline':    '🟢 ऑनलाइन — ग्राहक आपको देख सकते हैं',
    'shift.startBtn':        'दुकान खोलें',
    'shift.endBtn':          'शिफ्ट समाप्त करें',
    'shift.endConfirmTitle': 'शिफ्ट समाप्त करें?',
    'shift.endConfirmBody':  'आपकी दुकान ऑफलाइन हो जाएगी। लंबित ऑर्डर बने रहेंगे।',
    'shift.endConfirmYes':   'हाँ, समाप्त करें',
    'shift.endConfirmNo':    'जारी रखें',
    'shift.closingSoon':     '⏰ दुकान {time} बजे बंद होगी।',
    'shift.autoClosing':     'शिफ्ट बंद समय पर स्वतः समाप्त हुई।',
    'shift.summaryTitle':    'शिफ्ट पूरी हुई 🎉',
    'shift.ordersCompleted': 'पूरे ऑर्डर',
    'shift.totalEarnings':   'कुल कमाई',
    'shift.avgTime':         'औसत तैयारी समय',
    'shift.pendingWarning':  '{n} ऑर्डर अभी बाकी हैं। ग्राहकों से सीधे संपर्क करें।',
    'shift.exportWA':        'WhatsApp पर भेजें',
    'shift.startNew':        'नई शिफ्ट शुरू करें',
    'shift.alreadyStarted':  'शिफ्ट जारी रखें',

    'dashboard.title':       'ऑर्डर',
    'dashboard.ordersToday': 'आज के ऑर्डर',
    'dashboard.earningsToday': 'कमाई',
    'dashboard.avgReadyTime': 'औसत समय',
    'dashboard.noOrders':    'अभी कोई ऑर्डर नहीं।',
    'dashboard.noOrdersSub': 'अगला ऑर्डर यहाँ दिखेगा।',
    'dashboard.pullRefresh': '↑ ऊपर खींचकर रिफ्रेश करें',

    'order.payAtPickup':     'दुकान पर भुगतान',
    'order.paidOnline':      'UPI से भुगतान हुआ',
    'order.readyBy':         'तैयार समय',
    'order.tapManage':       'प्रबंधित करें →',
    'order.customerOrder':   'ग्राहक की सूची',
    'order.billLabel':       'कुल बिल राशि',
    'order.billPlaceholder': '0.00',
    'order.notesLabel':      'ग्राहक के लिए नोट (वैकल्पिक)',
    'order.notesPlaceholder':'जैसे: टाटा नमक नहीं — कैप्टन कुक 1kg जोड़ा ✓',
    'order.oosLabel':        'स्टॉक में नहीं',
    'order.sendQuote':       'कोटेशन भेजें',
    'order.markPacking':     'पैक हो रहा है',
    'order.markReady':       '🎉 पिकअप के लिए तैयार!',
    'order.cancelOrder':     'ऑर्डर रद्द करें',
    'order.cancelConfirm':   'क्या आप सुनिश्चित हैं? ग्राहक को सूचित किया जाएगा।',
    'order.cancelYes':       'हाँ, रद्द करें',
    'order.cancelNo':        'ऑर्डर रखें',
    'order.total':           'कुल: {amount}',
    'order.newAlert':        '🚨 नया ऑर्डर!',
    'order.statusPending':   'समीक्षा में',
    'order.statusQuoted':    'कोटेशन भेजा',
    'order.statusPacking':   'पैक हो रहा है',
    'order.statusReady':     'पिकअप के लिए तैयार',
    'order.statusCancelled': 'रद्द',

    'register.title':        'दुकान सूचीबद्ध करें',
    'register.subtitle':     'LocalBuy पर 120+ स्थानीय दुकानों से जुड़ें। 3 महीने मुफ्त।',
    'register.shopName':     'दुकान का नाम',
    'register.shopNamePh':   'जैसे: शर्मा जनरल स्टोर',
    'register.ownerName':    'आपका नाम',
    'register.phone':        'मोबाइल नंबर',
    'register.category':     'दुकान का प्रकार',
    'register.area':         'क्षेत्र',
    'register.submit':       'निःशुल्क पंजीकरण करें',
    'register.success':      'अनुरोध भेजा! हम 24 घंटे में कॉल करेंगे।',

    'notif.newOrder.title':  '🚨 नया ऑर्डर!',
    'notif.newOrder.body':   'एक ग्राहक ने अभी ऑर्डर दिया।',
    'notif.ready.title':     '✅ ऑर्डर तैयार है!',
    'notif.ready.body':      'दुकान पर आएं और सामान लें।',

    'status.open':    'खुला',
    'status.busy':    'व्यस्त',
    'status.closed':  'बंद',
    'status.online':  '🟢 ऑनलाइन',
    'status.offline': '🔴 ऑफ़लाइन',

    'lang.en': 'EN', 'lang.hi': 'हि', 'lang.bn': 'বা', 'lang.as': 'অ',

    'common.min':     'मिनट',
    'common.km':      'किमी',
    'common.cancel':  'रद्द',
    'common.confirm': 'पुष्टि करें',
    'common.close':   'बंद',
    'common.save':    'सहेजें',
    'common.back':    'वापस',
    'common.mins':    'मिनट',
  },

  // ── Bengali ───────────────────────────────────────────────
  bn: {
    'shift.greeting':        'শুভ সকাল',
    'shift.statusOffline':   '🔴 অফলাইন — দোকান গ্রাহকদের কাছে লুকানো',
    'shift.statusOnline':    '🟢 অনলাইন — গ্রাহকরা আপনাকে দেখতে পাবেন',
    'shift.startBtn':        'দোকান খুলুন',
    'shift.endBtn':          'শিফট শেষ করুন',
    'shift.endConfirmTitle': 'শিফট শেষ করবেন?',
    'shift.endConfirmBody':  'আপনার দোকান অফলাইন হয়ে যাবে। মুলতুবি অর্ডার থাকবে।',
    'shift.endConfirmYes':   'হ্যাঁ, শেষ করুন',
    'shift.endConfirmNo':    'চালিয়ে যান',
    'shift.closingSoon':     '⏰ দোকান {time} এ বন্ধ হবে।',
    'shift.autoClosing':     'শিফট স্বয়ংক্রিয়ভাবে বন্ধ সময়ে শেষ হয়েছে।',
    'shift.summaryTitle':    'শিফট সম্পন্ন 🎉',
    'shift.ordersCompleted': 'সম্পন্ন অর্ডার',
    'shift.totalEarnings':   'মোট আয়',
    'shift.avgTime':         'গড় প্রস্তুতি সময়',
    'shift.pendingWarning':  '{n}টি অর্ডার এখনও বাকি। গ্রাহকদের সরাসরি যোগাযোগ করুন।',
    'shift.exportWA':        'WhatsApp এ পাঠান',
    'shift.startNew':        'নতুন শিফট শুরু',
    'shift.alreadyStarted':  'শিফট চালিয়ে যান',

    'dashboard.title':       'অর্ডার',
    'dashboard.ordersToday': 'আজকের অর্ডার',
    'dashboard.earningsToday': 'আয়',
    'dashboard.avgReadyTime': 'গড় সময়',
    'dashboard.noOrders':    'কোনো সক্রিয় অর্ডার নেই।',
    'dashboard.noOrdersSub': 'পরের অর্ডার এখানে দেখাবে।',
    'dashboard.pullRefresh': '↑ টেনে রিফ্রেশ করুন',

    'order.payAtPickup':     'দোকানে পেমেন্ট',
    'order.paidOnline':      'UPI তে পেমেন্ট হয়েছে',
    'order.readyBy':         'প্রস্তুত সময়',
    'order.tapManage':       'পরিচালনা করুন →',
    'order.customerOrder':   'গ্রাহকের তালিকা',
    'order.billLabel':       'মোট বিল পরিমাণ',
    'order.billPlaceholder': '0.00',
    'order.notesLabel':      'গ্রাহকের জন্য নোট (ঐচ্ছিক)',
    'order.notesPlaceholder':'যেমন: টাটা লবণ নেই — ক্যাপ্টেন কুক 1kg যোগ করা হয়েছে ✓',
    'order.oosLabel':        'স্টকে নেই হিসেবে চিহ্নিত করুন',
    'order.sendQuote':       'কোটেশন পাঠান',
    'order.markPacking':     'প্যাকিং শুরু',
    'order.markReady':       '🎉 পিকআপের জন্য প্রস্তুত!',
    'order.cancelOrder':     'অর্ডার বাতিল করুন',
    'order.cancelConfirm':   'নিশ্চিত? গ্রাহককে জানানো হবে।',
    'order.cancelYes':       'হ্যাঁ, বাতিল করুন',
    'order.cancelNo':        'অর্ডার রাখুন',
    'order.total':           'মোট: {amount}',
    'order.newAlert':        '🚨 নতুন অর্ডার!',
    'order.statusPending':   'পর্যালোচনা করা হচ্ছে',
    'order.statusQuoted':    'কোটেশন পাঠানো হয়েছে',
    'order.statusPacking':   'প্যাক করা হচ্ছে',
    'order.statusReady':     'পিকআপের জন্য প্রস্তুত',
    'order.statusCancelled': 'বাতিল',

    'register.title':        'দোকান তালিকাভুক্ত করুন',
    'register.subtitle':     'LocalBuy এ ১২০+ স্থানীয় দোকানে যোগ দিন। ৩ মাস বিনামূল্যে।',
    'register.shopName':     'দোকানের নাম',
    'register.ownerName':    'আপনার নাম',
    'register.phone':        'মোবাইল নম্বর',
    'register.category':     'দোকানের ধরন',
    'register.area':         'গুয়াহাটির এলাকা',
    'register.submit':       'বিনামূল্যে নিবন্ধন করুন',
    'register.success':      'অনুরোধ পাঠানো হয়েছে! আমরা ২৪ ঘন্টার মধ্যে কল করব।',

    'notif.newOrder.title':  '🚨 নতুন অর্ডার!',
    'notif.newOrder.body':   'একজন কাস্টমার অর্ডার দিয়েছেন।',
    'notif.ready.title':     '✅ অর্ডার রেডি!',
    'notif.ready.body':      'দোকানে এসে মাল নিয়ে যান।',

    'status.open':    'খোলা',
    'status.busy':    'ব্যস্ত',
    'status.closed':  'বন্ধ',
    'status.online':  '🟢 অনলাইন',
    'status.offline': '🔴 অফলাইন',

    'lang.en': 'EN', 'lang.hi': 'हि', 'lang.bn': 'বা', 'lang.as': 'অ',

    'common.min':     'মিনিট',
    'common.km':      'কিমি',
    'common.cancel':  'বাতিল',
    'common.confirm': 'নিশ্চিত',
    'common.close':   'বন্ধ',
    'common.save':    'সংরক্ষণ',
    'common.back':    'ফিরে যান',
    'common.mins':    'মিনিট',
  },

  // ── Assamese ──────────────────────────────────────────────
  as: {
    'shift.greeting':        'শুভ পুৱা',
    'shift.statusOffline':   '🔴 অফলাইন — দোকান গ্ৰাহকৰ পৰা লুকুৱা',
    'shift.statusOnline':    '🟢 অনলাইন — গ্ৰাহকে আপোনাক দেখিব পাৰে',
    'shift.startBtn':        'দোকান খোলক',
    'shift.endBtn':          'শ্বিফট শেষ কৰক',
    'shift.endConfirmTitle': 'শ্বিফট শেষ কৰিবনে?',
    'shift.endConfirmBody':  'আপোনাৰ দোকান অফলাইন হ\'ব। বাকী অৰ্ডাৰ থাকিব।',
    'shift.endConfirmYes':   'হয়, শেষ কৰক',
    'shift.endConfirmNo':    'চলাই যাওক',
    'shift.closingSoon':     '⏰ দোকান {time} ত বন্ধ হ\'ব।',
    'shift.autoClosing':     'শ্বিফট স্বয়ংক্ৰিয়ভাৱে বন্ধ সময়ত শেষ হৈছে।',
    'shift.summaryTitle':    'শ্বিফট সম্পূৰ্ণ 🎉',
    'shift.ordersCompleted': 'সম্পূৰ্ণ অৰ্ডাৰ',
    'shift.totalEarnings':   'মুঠ আয়',
    'shift.avgTime':         'গড় প্ৰস্তুতি সময়',
    'shift.pendingWarning':  '{n}টা অৰ্ডাৰ এতিয়াও বাকী। গ্ৰাহকক পোনপটীয়াকৈ যোগাযোগ কৰক।',
    'shift.exportWA':        'WhatsApp ত পঠাওক',
    'shift.startNew':        'নতুন শ্বিফট আৰম্ভ কৰক',
    'shift.alreadyStarted':  'শ্বিফট চলাওক',

    'dashboard.title':       'অৰ্ডাৰ',
    'dashboard.ordersToday': 'আজিৰ অৰ্ডাৰ',
    'dashboard.earningsToday': 'আয়',
    'dashboard.avgReadyTime': 'গড় সময়',
    'dashboard.noOrders':    'কোনো সক্ৰিয় অৰ্ডাৰ নাই।',
    'dashboard.noOrdersSub': 'পৰৱৰ্তী অৰ্ডাৰ ইয়াত দেখা দিব।',
    'dashboard.pullRefresh': '↑ টানি ৰিফ্ৰেছ কৰক',

    'order.payAtPickup':     'দোকানত পেমেণ্ট',
    'order.paidOnline':      'UPI ত পেমেণ্ট হৈছে',
    'order.readyBy':         'প্ৰস্তুত সময়',
    'order.tapManage':       'পৰিচালনা কৰক →',
    'order.customerOrder':   'গ্ৰাহকৰ তালিকা',
    'order.billLabel':       'মুঠ বিল পৰিমাণ',
    'order.billPlaceholder': '0.00',
    'order.notesLabel':      'গ্ৰাহকৰ বাবে টোকা (ঐচ্ছিক)',
    'order.notesPlaceholder':'যেনে: টাটা নিমখ নাই — কেপ্টেন কুক 1kg যোগ কৰা হৈছে ✓',
    'order.oosLabel':        'ষ্টকত নাই বুলি চিহ্নিত কৰক',
    'order.sendQuote':       'কোটেছন পঠাওক',
    'order.markPacking':     'পেকিং আৰম্ভ',
    'order.markReady':       '🎉 পিকআপৰ বাবে প্ৰস্তুত!',
    'order.cancelOrder':     'অৰ্ডাৰ বাতিল কৰক',
    'order.cancelConfirm':   'নিশ্চিত? গ্ৰাহকক জনোৱা হ\'ব।',
    'order.cancelYes':       'হয়, বাতিল কৰক',
    'order.cancelNo':        'অৰ্ডাৰ ৰাখক',
    'order.total':           'মুঠ: {amount}',
    'order.newAlert':        '🚨 নতুন অৰ্ডাৰ!',
    'order.statusPending':   'পৰ্যালোচনা হৈ আছে',
    'order.statusQuoted':    'কোটেছন পঠোৱা হৈছে',
    'order.statusPacking':   'পেক হৈ আছে',
    'order.statusReady':     'পিকআপৰ বাবে প্ৰস্তুত',
    'order.statusCancelled': 'বাতিল',

    'register.title':        'দোকান তালিকাভুক্ত কৰক',
    'register.subtitle':     'LocalBuy ত ১২০+ স্থানীয় দোকানত যোগ দিয়ক। ৩ মাহ বিনামূলীয়া।',
    'register.shopName':     'দোকানৰ নাম',
    'register.ownerName':    'আপোনাৰ নাম',
    'register.phone':        'মোবাইল নম্বৰ',
    'register.category':     'দোকানৰ ধৰণ',
    'register.area':         'গুৱাহাটীৰ এলেকা',
    'register.submit':       'বিনামূলীয়াকৈ নিবন্ধন কৰক',
    'register.success':      'অনুৰোধ পঠোৱা হৈছে! আমি ২৪ ঘণ্টাৰ ভিতৰত ফোন কৰিম।',

    'notif.newOrder.title':  '🚨 নতুন অৰ্ডাৰ!',
    'notif.newOrder.body':   'এগৰাকী গ্ৰাহকে অৰ্ডাৰ দিলে।',
    'notif.ready.title':     '✅ অৰ্ডাৰ প্ৰস্তুত!',
    'notif.ready.body':      'দোকানলৈ আহি সামগ্ৰী লওক।',

    'status.open':    'খোলা আছে',
    'status.busy':    'ব্যস্ত',
    'status.closed':  'বন্ধ',
    'status.online':  '🟢 অনলাইন',
    'status.offline': '🔴 অফলাইন',

    'lang.en': 'EN', 'lang.hi': 'हि', 'lang.bn': 'বা', 'lang.as': 'অ',

    'common.min':     'মিনিট',
    'common.km':      'কিমি',
    'common.cancel':  'বাতিল',
    'common.confirm': 'নিশ্চিত',
    'common.close':   'বন্ধ',
    'common.save':    'সংৰক্ষণ',
    'common.back':    'উভতি যাওক',
    'common.mins':    'মিনিট',
  }
};

/* ── i18n Module ──────────────────────────────────────────── */
const i18n = (() => {
  // Default language — read from localStorage or fall back to 'en'
  let currentLang = localStorage.getItem('lb_lang') || 'en';

  /**
   * Get a translation string by key.
   * Supports simple interpolation: i18n.t('shift.closingSoon', { time: '9 PM' })
   * Returns the key if no translation found (never crashes).
   */
  function t(key, vars = {}) {
    const strings = STRINGS[currentLang] || STRINGS['en'];
    let str = strings[key] || STRINGS['en'][key] || key;

    // Replace {placeholders} with provided values
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });

    return str;
  }

  /**
   * Change language. Persists to localStorage.
   * Re-renders all elements with [data-i18n="key"] attribute.
   */
  function setLang(langCode) {
    if (!STRINGS[langCode]) {
      console.warn('[i18n] Unknown language:', langCode);
      return;
    }
    currentLang = langCode;
    localStorage.setItem('lb_lang', langCode);
    render();
  }

  /**
   * Get current language code
   */
  function getLang() {
    return currentLang;
  }

  /**
   * Render all [data-i18n] elements in the DOM.
   * Also updates [data-i18n-placeholder] and [data-i18n-aria-label].
   */
  function render() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });

    // Placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });

    // Aria-label attributes
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key));
    });

    // Update active state on language toggle buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
  }

  /**
   * Format currency in Indian Rupees using Intl.NumberFormat
   * e.g., formatCurrency(347) → "₹347.00"
   */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format a number with Indian comma grouping
   * e.g., formatNumber(12500) → "12,500"
   */
  function formatNumber(n) {
    return new Intl.NumberFormat('en-IN').format(n);
  }

  // Auto-render on init (DOMContentLoaded safe)
  document.addEventListener('DOMContentLoaded', render);

  return { t, setLang, getLang, render, formatCurrency, formatNumber };
})();