/* ============================================================
   LocalBuy — i18n.js
   Internationalisation: English / Hindi / Bengali / Assamese

   Usage:
     i18n.setLang('en')
     i18n.t('shift.startBtn')
     i18n.t('order.total', { amount: '₹347' })

   Fixes applied:
     - localStorage key unified to 'localbuy_lang' (was 'lb_lang')
     - aria-pressed updated correctly on language button switch
     - render() covers [data-i18n], [data-i18n-placeholder],
       [data-i18n-aria], and select <option> elements
     - All 4 language tables are complete and consistent
     - register.* keys present in all 4 languages
   ============================================================ */

const STRINGS = {

  // ── English ──────────────────────────────────────────────
  en: {
    // Register page
    'register.badge':               'For Guwahati shop owners',
    'register.title':               'List your shop',
    'register.subtitle':            'Join 120+ local shops on LocalBuy. Free for 3 months.',
    'register.formHeading':         'Set up your shop',
    'register.shopName':            'Shop name',
    'register.shopNamePh':          'e.g., Sharma General Store',
    'register.ownerName':           'Your name',
    'register.ownerNamePh':         'e.g., Rajesh Kalita',
    'register.phone':               'Mobile number',
    'register.phonePh':             '10-digit number',
    'register.category':            'Shop type',
    'register.area':                'Area in Guwahati',
    'register.areaPh':              'e.g., Ulubari, Fancy Bazar…',
    'register.upiId':               'UPI ID (optional)',
    'register.upiIdPh':             'yourname@upi',
    'register.submit':              'Request listing — it\'s free',
    'register.success':             'Request sent! We\'ll call you within 24 hours.',
    'register.legal':               'By continuing you agree to our Terms. No spam, ever.',

    // Benefits
    'benefit.noCommission.title':   'No commission for 3 months',
    'benefit.noCommission.sub':     'Start earning, not paying',
    'benefit.anyPhone.title':       'Works on any Android phone',
    'benefit.anyPhone.sub':         'No new hardware needed',
    'benefit.waKit.title':          'Free WhatsApp kit on day 1',
    'benefit.waKit.sub':            'Ready-made messages for your regulars',
    'benefit.setup.title':          '5-minute setup',
    'benefit.setup.sub':            'We help you go live today',

    // Form fields
    'form.selectCategory':          'Select a category',
    'form.phoneHint':               'We only use this to send you order alerts.',
    'form.hours':                   'Shop hours',
    'form.opensAt':                 'Opens at',
    'form.closesAt':                'Closes at',
    'form.lastOrder':               'Last order accepted at',
    'form.upiId':                   'UPI ID (optional)',
    'form.upiHint':                 'Lets customers pay online. Safe & optional.',

    // Category options
    'cat.kirana':                   '🛒 Kirana / General Store',
    'cat.chemist':                  '💊 Chemist / Medical',
    'cat.stationery':               '✏️ Stationery',
    'cat.bakery':                   '🎂 Bakery',
    'cat.dairy':                    '🥛 Dairy',
    'cat.beauty':                   '💄 Beauty',
    'cat.fish':                     '🐟 Fish & Meat',

    // Shift management
    'shift.greeting':               'Good morning',
    'shift.statusOffline':          '🔴 Offline — Shop is hidden from customers',
    'shift.statusOnline':           '🟢 Online — Customers can find you',
    'shift.startBtn':               'Start Shift',
    'shift.endBtn':                 'End Shift',
    'shift.endConfirmTitle':        'End shift?',
    'shift.endConfirmBody':         'Your shop will go offline. Pending orders will remain.',
    'shift.endConfirmYes':          'Yes, end shift',
    'shift.endConfirmNo':           'Keep going',
    'shift.closingSoon':            '⏰ Shop closes at {time}. Last orders soon.',
    'shift.autoClosing':            'Shift ended automatically at closing time.',
    'shift.summaryTitle':           'Shift complete 🎉',
    'shift.ordersCompleted':        'Orders completed',
    'shift.totalEarnings':          'Total earnings',
    'shift.avgTime':                'Avg. ready time',
    'shift.pendingWarning':         '{n} orders still pending. Contact customers directly.',
    'shift.exportWA':               'Export via WhatsApp',
    'shift.startNew':               'Start new shift',
    'shift.alreadyStarted':         'Resume shift',
    // Aliases used directly by HTML
    'shift.offline':                '🔴 Offline — Shop is hidden from customers',
    'shift.start':                  'Start Shift — Go Online',
    'shift.end':                    'End Shift',
    'shift.hint':                   'Your shop will become visible to customers in your area.',
    'shift.hoursToday':             'Today: {open} – {close}',
    'shift.yesterday':              'Yesterday',

    // Dashboard
    'dashboard.title':              'Orders',
    'dashboard.ordersToday':        'Orders today',
    'dashboard.earningsToday':      'Earnings',
    'dashboard.avgReadyTime':       'Avg. ready time',
    'dashboard.noOrders':           'No active orders.',
    'dashboard.noOrdersSub':        'Your next order will appear here.',
    'dashboard.pullRefresh':        '↑ Pull to refresh',

    // Stats
    'stats.orders':                 'Orders',
    'stats.earnings':               'Earnings',
    'stats.avgTime':                'Avg. ready',
    'stats.ordersToday':            'Orders today',
    'stats.earningsToday':          'Earnings today',
    'stats.avgReady':               'Avg. ready time',

    // Tabs
    'tab.orders':                   'Orders',
    'tab.inventory':                'Quick OOS',

    // Orders feed
    'orders.emptyTitle':            'No active orders',
    'orders.emptySub':              'New orders will appear here with a sound alert.',
    'pull.refresh':                 'Pull to refresh',

    // Order card & panel
    'order.payAtPickup':            'Pay at pickup',
    'order.paidOnline':             'Paid online (UPI)',
    'order.readyBy':                'Ready by',
    'order.tapManage':              'Tap to manage →',
    'order.customerOrder':          'Customer\'s list',
    'order.billLabel':              'Total bill amount',
    'order.billPlaceholder':        '0.00',
    'order.notesLabel':             'Notes for customer (optional)',
    'order.notesPlaceholder':       'e.g., No Tata Salt — added Captain Cook 1kg ✓\nMaggi not available today.',
    'order.oosLabel':               'Mark items out of stock',
    'order.sendQuote':              'Send Quote',
    'order.markPacking':            'Mark as Packing',
    'order.markReady':              '🎉 Ready for Pickup!',
    'order.cancelOrder':            'Cancel order',
    'order.cancelConfirm':          'Are you sure? The customer will be notified.',
    'order.cancelYes':              'Yes, cancel',
    'order.cancelNo':               'Keep order',
    'order.total':                  'Total: {amount}',
    'order.quoteNote':              'Substitution note',
    'order.photosAttached':         'Photo list attached',
    'order.newAlert':               '🚨 New Order!',
    'order.statusPending':          'Pending Review',
    'order.statusQuoted':           'Quoted',
    'order.statusPacking':          'Packing',
    'order.statusReady':            'Ready for Pickup',
    'order.statusCancelled':        'Cancelled',

    // Order action panel aliases
    'panel.customerOrder':          'Customer\'s order',
    'panel.photoList':              'Photo list',
    'panel.yourResponse':           'Your response',
    'panel.billAmount':             'Total bill amount',
    'panel.subNotes':               'Notes for customer (optional)',
    'panel.subNotesPlaceholder':    'e.g., No Tata Salt — added Captain Cook 1kg ✓\nMaggi not available today.',
    'panel.quickOos':               'Quick OOS this order',
    'panel.sendQuote':              'Send Quote to Customer',
    'panel.markPacking':            'Mark as Packing',
    'panel.markReady':              'Ready for Pickup 🎉',
    'panel.cancelOrder':            'Cancel order',

    // OOS panel
    'oos.intro':                    'Mark items out of stock. This auto-notes your next quotes.',
    'oos.clearAll':                 'Clear all',
    'oos.placeholder':              'Add item…',
    'oos.add':                      '+ Add',

    // Shift end screen
    'shiftEnd.title':               'Shift complete!',
    'shiftEnd.sub':                 'Your shop is now offline. See you tomorrow.',
    'shiftEnd.exportWA':            'Export summary to WhatsApp',
    'shiftEnd.done':                'Done — see you tomorrow',
    'shiftEnd.pendingWarning':      'Some orders are still pending. Contact customers directly.',

    // Summary card
    'summary.ordersCompleted':      'Orders completed',
    'summary.earnings':             'Total earnings',
    'summary.avgTime':              'Avg. fulfillment time',
    'summary.shiftDuration':        'Shift duration',

    // Notifications
    'notif.newOrder.title':         '🚨 New Order!',
    'notif.newOrder.body':          'A customer just placed an order.',
    'notif.ready.title':            '✅ Order Ready!',
    'notif.ready.body':             'Walk in and collect your items.',

    // Status labels
    'status.open':                  'Open',
    'status.busy':                  'Busy',
    'status.closed':                'Closed',
    'status.online':                '🟢 Online',
    'status.offline':               '🔴 Offline',

    // Language toggle labels
    'lang.en': 'EN',
    'lang.hi': 'हि',
    'lang.bn': 'বা',
    'lang.as': 'অ',

    // Common
    'common.min':                   'min',
    'common.km':                    'km',
    'common.cancel':                'Cancel',
    'common.confirm':               'Confirm',
    'common.close':                 'Close',
    'common.save':                  'Save',
    'common.back':                  'Back',
    'common.mins':                  'mins',
  },

  // ── Hindi ─────────────────────────────────────────────────
  hi: {
    // Register page
    'register.badge':               'गुवाहाटी के दुकानदारों के लिए',
    'register.title':               'दुकान सूचीबद्ध करें',
    'register.subtitle':            'LocalBuy पर 120+ स्थानीय दुकानों से जुड़ें। 3 महीने मुफ्त।',
    'register.formHeading':         'अपनी दुकान सेट करें',
    'register.shopName':            'दुकान का नाम',
    'register.shopNamePh':          'जैसे: शर्मा जनरल स्टोर',
    'register.ownerName':           'आपका नाम',
    'register.ownerNamePh':         'जैसे: राजेश कलिता',
    'register.phone':               'मोबाइल नंबर',
    'register.phonePh':             '10-अंकीय नंबर',
    'register.category':            'दुकान का प्रकार',
    'register.area':                'गुवाहाटी का क्षेत्र',
    'register.areaPh':              'जैसे: उलुबारी, फैंसी बाज़ार…',
    'register.upiId':               'UPI ID (वैकल्पिक)',
    'register.upiIdPh':             'yourname@upi',
    'register.submit':              'निःशुल्क पंजीकरण करें',
    'register.success':             'अनुरोध भेजा! हम 24 घंटे में कॉल करेंगे।',
    'register.legal':               'जारी रखने पर आप हमारी शर्तों से सहमत हैं। कोई स्पैम नहीं।',

    // Benefits
    'benefit.noCommission.title':   '3 महीने कोई कमीशन नहीं',
    'benefit.noCommission.sub':     'कमाना शुरू करें, देना नहीं',
    'benefit.anyPhone.title':       'किसी भी Android फ़ोन पर काम करता है',
    'benefit.anyPhone.sub':         'कोई नया हार्डवेयर नहीं चाहिए',
    'benefit.waKit.title':          'पहले दिन मुफ़्त WhatsApp किट',
    'benefit.waKit.sub':            'आपके नियमित ग्राहकों के लिए तैयार संदेश',
    'benefit.setup.title':          '5 मिनट में सेटअप',
    'benefit.setup.sub':            'हम आपको आज ही लाइव करेंगे',

    // Form fields
    'form.selectCategory':          'श्रेणी चुनें',
    'form.phoneHint':               'हम इसका उपयोग केवल ऑर्डर अलर्ट भेजने के लिए करते हैं।',
    'form.hours':                   'दुकान के घंटे',
    'form.opensAt':                 'खुलने का समय',
    'form.closesAt':                'बंद होने का समय',
    'form.lastOrder':               'अंतिम ऑर्डर स्वीकृति समय',
    'form.upiId':                   'UPI ID (वैकल्पिक)',
    'form.upiHint':                 'ग्राहकों को ऑनलाइन भुगतान देता है। सुरक्षित और वैकल्पिक।',

    // Category options
    'cat.kirana':                   '🛒 किराना / जनरल स्टोर',
    'cat.chemist':                  '💊 केमिस्ट / मेडिकल',
    'cat.stationery':               '✏️ स्टेशनरी',
    'cat.bakery':                   '🎂 बेकरी',
    'cat.dairy':                    '🥛 डेयरी',
    'cat.beauty':                   '💄 ब्यूटी',
    'cat.fish':                     '🐟 मछली और मांस',

    // Shift management
    'shift.greeting':               'सुप्रभात',
    'shift.statusOffline':          '🔴 ऑफ़लाइन — दुकान छुपी हुई है',
    'shift.statusOnline':           '🟢 ऑनलाइन — ग्राहक आपको देख सकते हैं',
    'shift.startBtn':               'दुकान खोलें',
    'shift.endBtn':                 'शिफ्ट समाप्त करें',
    'shift.endConfirmTitle':        'शिफ्ट समाप्त करें?',
    'shift.endConfirmBody':         'आपकी दुकान ऑफलाइन हो जाएगी। लंबित ऑर्डर बने रहेंगे।',
    'shift.endConfirmYes':          'हाँ, समाप्त करें',
    'shift.endConfirmNo':           'जारी रखें',
    'shift.closingSoon':            '⏰ दुकान {time} बजे बंद होगी।',
    'shift.autoClosing':            'शिफ्ट बंद समय पर स्वतः समाप्त हुई।',
    'shift.summaryTitle':           'शिफ्ट पूरी हुई 🎉',
    'shift.ordersCompleted':        'पूरे ऑर्डर',
    'shift.totalEarnings':          'कुल कमाई',
    'shift.avgTime':                'औसत तैयारी समय',
    'shift.pendingWarning':         '{n} ऑर्डर अभी बाकी हैं। ग्राहकों से सीधे संपर्क करें।',
    'shift.exportWA':               'WhatsApp पर भेजें',
    'shift.startNew':               'नई शिफ्ट शुरू करें',
    'shift.alreadyStarted':         'शिफ्ट जारी रखें',
    // Aliases
    'shift.offline':                '🔴 ऑफ़लाइन — दुकान ग्राहकों से छिपी हुई है',
    'shift.start':                  'शिफ्ट शुरू करें — ऑनलाइन जाएँ',
    'shift.end':                    'शिफ्ट समाप्त करें',
    'shift.hint':                   'आपकी दुकान आपके क्षेत्र के ग्राहकों को दिखाई देने लगेगी।',
    'shift.hoursToday':             'आज: {open} – {close}',
    'shift.yesterday':              'कल',

    // Dashboard
    'dashboard.title':              'ऑर्डर',
    'dashboard.ordersToday':        'आज के ऑर्डर',
    'dashboard.earningsToday':      'कमाई',
    'dashboard.avgReadyTime':       'औसत समय',
    'dashboard.noOrders':           'अभी कोई ऑर्डर नहीं।',
    'dashboard.noOrdersSub':        'अगला ऑर्डर यहाँ दिखेगा।',
    'dashboard.pullRefresh':        '↑ ऊपर खींचकर रिफ्रेश करें',

    // Stats
    'stats.orders':                 'ऑर्डर',
    'stats.earnings':               'कमाई',
    'stats.avgTime':                'औसत तैयार',
    'stats.ordersToday':            'आज के ऑर्डर',
    'stats.earningsToday':          'आज की कमाई',
    'stats.avgReady':               'औसत तैयारी का समय',

    // Tabs
    'tab.orders':                   'ऑर्डर',
    'tab.inventory':                'क्विक OOS',

    // Orders feed
    'orders.emptyTitle':            'कोई सक्रिय ऑर्डर नहीं',
    'orders.emptySub':              'नए ऑर्डर ध्वनि अलर्ट के साथ यहाँ दिखाई देंगे।',
    'pull.refresh':                 'रिफ्रेश करने के लिए खींचें',

    // Order card & panel
    'order.payAtPickup':            'दुकान पर भुगतान',
    'order.paidOnline':             'UPI से भुगतान हुआ',
    'order.readyBy':                'तैयार समय',
    'order.tapManage':              'प्रबंधित करें →',
    'order.customerOrder':          'ग्राहक की सूची',
    'order.billLabel':              'कुल बिल राशि',
    'order.billPlaceholder':        '0.00',
    'order.notesLabel':             'ग्राहक के लिए नोट (वैकल्पिक)',
    'order.notesPlaceholder':       'जैसे: टाटा नमक नहीं — कैप्टन कुक 1kg जोड़ा ✓\nमैगी आज उपलब्ध नहीं।',
    'order.oosLabel':               'स्टॉक में नहीं',
    'order.sendQuote':              'कोटेशन भेजें',
    'order.markPacking':            'पैक हो रहा है',
    'order.markReady':              '🎉 पिकअप के लिए तैयार!',
    'order.cancelOrder':            'ऑर्डर रद्द करें',
    'order.cancelConfirm':          'क्या आप सुनिश्चित हैं? ग्राहक को सूचित किया जाएगा।',
    'order.cancelYes':              'हाँ, रद्द करें',
    'order.cancelNo':               'ऑर्डर रखें',
    'order.total':                  'कुल: {amount}',
    'order.quoteNote':              'प्रतिस्थापन नोट',
    'order.photosAttached':         'फोटो सूची संलग्न',
    'order.newAlert':               '🚨 नया ऑर्डर!',
    'order.statusPending':          'समीक्षा में',
    'order.statusQuoted':           'कोटेशन भेजा',
    'order.statusPacking':          'पैक हो रहा है',
    'order.statusReady':            'पिकअप के लिए तैयार',
    'order.statusCancelled':        'रद्द',

    // Order action panel aliases
    'panel.customerOrder':          'ग्राहक का ऑर्डर',
    'panel.photoList':              'फोटो सूची',
    'panel.yourResponse':           'आपका जवाब',
    'panel.billAmount':             'कुल बिल राशि',
    'panel.subNotes':               'ग्राहक के लिए नोट (वैकल्पिक)',
    'panel.subNotesPlaceholder':    'उदा. टाटा नमक नहीं है — कैप्टन कुक 1 किलो जोड़ा गया ✓\nमैगी आज उपलब्ध नहीं है।',
    'panel.quickOos':               'इस ऑर्डर में क्विक OOS करें',
    'panel.sendQuote':              'ग्राहक को कोट (Quote) भेजें',
    'panel.markPacking':            'पैकिंग के रूप में मार्क करें',
    'panel.markReady':              'पिकअप के लिए तैयार 🎉',
    'panel.cancelOrder':            'ऑर्डर रद्द करें',

    // OOS panel
    'oos.intro':                    'आइटम्स को आउट ऑफ स्टॉक मार्क करें। यह आपके अगले कोट्स में अपने आप नोट हो जाएगा।',
    'oos.clearAll':                 'सभी साफ़ करें',
    'oos.placeholder':              'आइटम जोड़ें…',
    'oos.add':                      '+ जोड़ें',

    // Shift end screen
    'shiftEnd.title':               'शिफ्ट पूरी हुई!',
    'shiftEnd.sub':                 'आपकी दुकान अब ऑफ़लाइन है। कल मिलते हैं।',
    'shiftEnd.exportWA':            'WhatsApp पर सारांश एक्सपोर्ट करें',
    'shiftEnd.done':                'हो गया — कल मिलते हैं',
    'shiftEnd.pendingWarning':      'कुछ ऑर्डर अभी भी लंबित हैं। ग्राहकों से सीधे संपर्क करें।',

    // Summary card
    'summary.ordersCompleted':      'पूरे किए गए ऑर्डर',
    'summary.earnings':             'कुल कमाई',
    'summary.avgTime':              'औसत पूर्ति समय',
    'summary.shiftDuration':        'शिफ्ट की अवधि',

    // Notifications
    'notif.newOrder.title':         '🚨 नया ऑर्डर!',
    'notif.newOrder.body':          'एक ग्राहक ने अभी ऑर्डर दिया।',
    'notif.ready.title':            '✅ ऑर्डर तैयार है!',
    'notif.ready.body':             'दुकान पर आएं और सामान लें।',

    // Status labels
    'status.open':                  'खुला',
    'status.busy':                  'व्यस्त',
    'status.closed':                'बंद',
    'status.online':                '🟢 ऑनलाइन',
    'status.offline':               '🔴 ऑफ़लाइन',

    // Language toggle labels
    'lang.en': 'EN',
    'lang.hi': 'हि',
    'lang.bn': 'বা',
    'lang.as': 'অ',

    // Common
    'common.min':                   'मिनट',
    'common.km':                    'किमी',
    'common.cancel':                'रद्द',
    'common.confirm':               'पुष्टि करें',
    'common.close':                 'बंद',
    'common.save':                  'सहेजें',
    'common.back':                  'वापस',
    'common.mins':                  'मिनट',
  },

  // ── Bengali ───────────────────────────────────────────────
  bn: {
    // Register page
    'register.badge':               'গুয়াহাটির দোকান মালিকদের জন্য',
    'register.title':               'দোকান তালিকাভুক্ত করুন',
    'register.subtitle':            'LocalBuy এ ১২০+ স্থানীয় দোকানে যোগ দিন। ৩ মাস বিনামূল্যে।',
    'register.formHeading':         'আপনার দোকান সেট করুন',
    'register.shopName':            'দোকানের নাম',
    'register.shopNamePh':          'যেমন: শর্মা জেনারেল স্টোর',
    'register.ownerName':           'আপনার নাম',
    'register.ownerNamePh':         'যেমন: রাজেশ কলিতা',
    'register.phone':               'মোবাইল নম্বর',
    'register.phonePh':             '১০-সংখ্যার নম্বর',
    'register.category':            'দোকানের ধরন',
    'register.area':                'গুয়াহাটির এলাকা',
    'register.areaPh':              'যেমন: উলুবাড়ি, ফ্যান্সি বাজার…',
    'register.upiId':               'UPI ID (ঐচ্ছিক)',
    'register.upiIdPh':             'yourname@upi',
    'register.submit':              'বিনামূল্যে নিবন্ধন করুন',
    'register.success':             'অনুরোধ পাঠানো হয়েছে! আমরা ২৪ ঘন্টার মধ্যে কল করব।',
    'register.legal':               'চালিয়ে যেলে আপনি আমাদের শর্তে সম্মত হচ্ছেন। কোনো স্প্যাম নেই।',

    // Benefits
    'benefit.noCommission.title':   '৩ মাস কোনো কমিশন নেই',
    'benefit.noCommission.sub':     'উপার্জন শুরু করুন, দেওয়া নয়',
    'benefit.anyPhone.title':       'যেকোনো Android ফোনে কাজ করে',
    'benefit.anyPhone.sub':         'নতুন হার্ডওয়্যার লাগবে না',
    'benefit.waKit.title':          'প্রথম দিনেই বিনামূল্যে WhatsApp কিট',
    'benefit.waKit.sub':            'আপনার নিয়মিত গ্রাহকদের জন্য রেডিমেড বার্তা',
    'benefit.setup.title':          '৫ মিনিটে সেটআপ',
    'benefit.setup.sub':            'আমরা আজই আপনাকে লাইভ করতে সাহায্য করব',

    // Form fields
    'form.selectCategory':          'একটি বিভাগ নির্বাচন করুন',
    'form.phoneHint':               'আমরা এটি শুধুমাত্র অর্ডার অ্যালার্ট পাঠাতে ব্যবহার করি।',
    'form.hours':                   'দোকানের সময়',
    'form.opensAt':                 'খোলার সময়',
    'form.closesAt':                'বন্ধের সময়',
    'form.lastOrder':               'শেষ অর্ডার গ্রহণের সময়',
    'form.upiId':                   'UPI ID (ঐচ্ছিক)',
    'form.upiHint':                 'গ্রাহকদের অনলাইন পেমেন্ট করতে দেয়। নিরাপদ ও ঐচ্ছিক।',

    // Category options
    'cat.kirana':                   '🛒 কিরানা / জেনারেল স্টোর',
    'cat.chemist':                  '💊 কেমিস্ট / মেডিকেল',
    'cat.stationery':               '✏️ স্টেশনারি',
    'cat.bakery':                   '🎂 বেকারি',
    'cat.dairy':                    '🥛 ডেয়ারি',
    'cat.beauty':                   '💄 বিউটি',
    'cat.fish':                     '🐟 মাছ ও মাংস',

    // Shift management
    'shift.greeting':               'শুভ সকাল',
    'shift.statusOffline':          '🔴 অফলাইন — দোকান গ্রাহকদের কাছে লুকানো',
    'shift.statusOnline':           '🟢 অনলাইন — গ্রাহকরা আপনাকে দেখতে পাবেন',
    'shift.startBtn':               'দোকান খুলুন',
    'shift.endBtn':                 'শিফট শেষ করুন',
    'shift.endConfirmTitle':        'শিফট শেষ করবেন?',
    'shift.endConfirmBody':         'আপনার দোকান অফলাইন হয়ে যাবে। মুলতুবি অর্ডার থাকবে।',
    'shift.endConfirmYes':          'হ্যাঁ, শেষ করুন',
    'shift.endConfirmNo':           'চালিয়ে যান',
    'shift.closingSoon':            '⏰ দোকান {time} এ বন্ধ হবে।',
    'shift.autoClosing':            'শিফট স্বয়ংক্রিয়ভাবে বন্ধ সময়ে শেষ হয়েছে।',
    'shift.summaryTitle':           'শিফট সম্পন্ন 🎉',
    'shift.ordersCompleted':        'সম্পন্ন অর্ডার',
    'shift.totalEarnings':          'মোট আয়',
    'shift.avgTime':                'গড় প্রস্তুতি সময়',
    'shift.pendingWarning':         '{n}টি অর্ডার এখনও বাকি। গ্রাহকদের সরাসরি যোগাযোগ করুন।',
    'shift.exportWA':               'WhatsApp এ পাঠান',
    'shift.startNew':               'নতুন শিফট শুরু',
    'shift.alreadyStarted':         'শিফট চালিয়ে যান',
    // Aliases
    'shift.offline':                '🔴 অফলাইন — দোকান গ্রাহকদের থেকে লুকানো আছে',
    'shift.start':                  'শিফট শুরু করুন — অনলাইন যান',
    'shift.end':                    'শিফট শেষ করুন',
    'shift.hint':                   'আপনার দোকান আপনার এলাকার গ্রাহকদের কাছে দৃশ্যমান হবে।',
    'shift.hoursToday':             'আজ: {open} – {close}',
    'shift.yesterday':              'গতকাল',

    // Dashboard
    'dashboard.title':              'অর্ডার',
    'dashboard.ordersToday':        'আজকের অর্ডার',
    'dashboard.earningsToday':      'আয়',
    'dashboard.avgReadyTime':       'গড় সময়',
    'dashboard.noOrders':           'কোনো সক্রিয় অর্ডার নেই।',
    'dashboard.noOrdersSub':        'পরের অর্ডার এখানে দেখাবে।',
    'dashboard.pullRefresh':        '↑ টেনে রিফ্রেশ করুন',

    // Stats
    'stats.orders':                 'অর্ডার',
    'stats.earnings':               'উপার্জন',
    'stats.avgTime':                'গড় প্রস্তুত',
    'stats.ordersToday':            'আজকের অর্ডার',
    'stats.earningsToday':          'আজকের উপার্জন',
    'stats.avgReady':               'গড় প্রস্তুতির সময়',

    // Tabs
    'tab.orders':                   'অর্ডার',
    'tab.inventory':                'কুইক OOS',

    // Orders feed
    'orders.emptyTitle':            'কোনো সক্রিয় অর্ডার নেই',
    'orders.emptySub':              'নতুন অর্ডারগুলি একটি সাউন্ড অ্যালার্টের সাথে এখানে প্রদর্শিত হবে।',
    'pull.refresh':                 'রিফ্রেশ করতে টানুন',

    // Order card & panel
    'order.payAtPickup':            'দোকানে পেমেন্ট',
    'order.paidOnline':             'UPI তে পেমেন্ট হয়েছে',
    'order.readyBy':                'প্রস্তুত সময়',
    'order.tapManage':              'পরিচালনা করুন →',
    'order.customerOrder':          'গ্রাহকের তালিকা',
    'order.billLabel':              'মোট বিল পরিমাণ',
    'order.billPlaceholder':        '0.00',
    'order.notesLabel':             'গ্রাহকের জন্য নোট (ঐচ্ছিক)',
    'order.notesPlaceholder':       'যেমন: টাটা লবণ নেই — ক্যাপ্টেন কুক 1kg যোগ করা হয়েছে ✓\nম্যাগি আজ নেই।',
    'order.oosLabel':               'স্টকে নেই হিসেবে চিহ্নিত করুন',
    'order.sendQuote':              'কোটেশন পাঠান',
    'order.markPacking':            'প্যাকিং শুরু',
    'order.markReady':              '🎉 পিকআপের জন্য প্রস্তুত!',
    'order.cancelOrder':            'অর্ডার বাতিল করুন',
    'order.cancelConfirm':          'নিশ্চিত? গ্রাহককে জানানো হবে।',
    'order.cancelYes':              'হ্যাঁ, বাতিল করুন',
    'order.cancelNo':               'অর্ডার রাখুন',
    'order.total':                  'মোট: {amount}',
    'order.quoteNote':              'প্রতিস্থাপন নোট',
    'order.photosAttached':         'ফটো তালিকা সংযুক্ত',
    'order.newAlert':               '🚨 নতুন অর্ডার!',
    'order.statusPending':          'পর্যালোচনা করা হচ্ছে',
    'order.statusQuoted':           'কোটেশন পাঠানো হয়েছে',
    'order.statusPacking':          'প্যাক করা হচ্ছে',
    'order.statusReady':            'পিকআপের জন্য প্রস্তুত',
    'order.statusCancelled':        'বাতিল',

    // Order action panel aliases
    'panel.customerOrder':          'গ্রাহকের অর্ডার',
    'panel.photoList':              'ফটো তালিকা',
    'panel.yourResponse':           'আপনার উত্তর',
    'panel.billAmount':             'মোট বিলের পরিমাণ',
    'panel.subNotes':               'গ্রাহকের জন্য নোট (ঐচ্ছিক)',
    'panel.subNotesPlaceholder':    'উদা. টাটা সল্ট নেই — ক্যাপ্টেন কুক ১ কেজি যোগ করা হয়েছে ✓\nম্যাগি আজ উপলব্ধ নেই।',
    'panel.quickOos':               'এই অর্ডারে কুইক OOS করুন',
    'panel.sendQuote':              'গ্রাহককে কোট (Quote) পাঠান',
    'panel.markPacking':            'প্যাকিং হিসেবে চিহ্নিত করুন',
    'panel.markReady':              'পিকআপের জন্য প্রস্তুত 🎉',
    'panel.cancelOrder':            'অর্ডার বাতিল করুন',

    // OOS panel
    'oos.intro':                    'আইটেমগুলিকে আউট অফ স্টক হিসেবে চিহ্নিত করুন। এটি আপনার পরবর্তী কোটগুলিতে স্বয়ংক্রিয়ভাবে নোট হয়ে যাবে।',
    'oos.clearAll':                 'সব মুছুন',
    'oos.placeholder':              'আইটেম যোগ করুন…',
    'oos.add':                      '+ যোগ করুন',

    // Shift end screen
    'shiftEnd.title':               'শিফট সম্পন্ন হয়েছে!',
    'shiftEnd.sub':                 'আপনার দোকান এখন অফলাইনে আছে। আগামীকাল দেখা হবে।',
    'shiftEnd.exportWA':            'WhatsApp-এ সারাংশ এক্সপোর্ট করুন',
    'shiftEnd.done':                'হয়ে গেছে — আগামীকাল দেখা হবে',
    'shiftEnd.pendingWarning':      'কিছু অর্ডার এখনও পেন্ডিং আছে। গ্রাহকদের সাথে সরাসরি যোগাযোগ করুন।',

    // Summary card
    'summary.ordersCompleted':      'সম্পন্ন হওয়া অর্ডার',
    'summary.earnings':             'মোট উপার্জন',
    'summary.avgTime':              'অর্ডার প্রস্তুত হওয়ার গড় সময়',
    'summary.shiftDuration':        'শিফটের সময়কাল',

    // Notifications
    'notif.newOrder.title':         '🚨 নতুন অর্ডার!',
    'notif.newOrder.body':          'একজন কাস্টমার অর্ডার দিয়েছেন।',
    'notif.ready.title':            '✅ অর্ডার রেডি!',
    'notif.ready.body':             'দোকানে এসে মাল নিয়ে যান।',

    // Status labels
    'status.open':                  'খোলা',
    'status.busy':                  'ব্যস্ত',
    'status.closed':                'বন্ধ',
    'status.online':                '🟢 অনলাইন',
    'status.offline':               '🔴 অফলাইন',

    // Language toggle labels
    'lang.en': 'EN',
    'lang.hi': 'हि',
    'lang.bn': 'বা',
    'lang.as': 'অ',

    // Common
    'common.min':                   'মিনিট',
    'common.km':                    'কিমি',
    'common.cancel':                'বাতিল',
    'common.confirm':               'নিশ্চিত',
    'common.close':                 'বন্ধ',
    'common.save':                  'সংরক্ষণ',
    'common.back':                  'ফিরে যান',
    'common.mins':                  'মিনিট',
  },

  // ── Assamese ──────────────────────────────────────────────
  as: {
    // Register page
    'register.badge':               'গুৱাহাটীৰ দোকানদাৰসকলৰ বাবে',
    'register.title':               'দোকান তালিকাভুক্ত কৰক',
    'register.subtitle':            'LocalBuy ত ১২০+ স্থানীয় দোকানত যোগ দিয়ক। ৩ মাহ বিনামূলীয়া।',
    'register.formHeading':         'আপোনাৰ দোকান ছেট আপ কৰক',
    'register.shopName':            'দোকানৰ নাম',
    'register.shopNamePh':          'যেনে: শৰ্মা জেনেৰেল ষ্টোৰ',
    'register.ownerName':           'আপোনাৰ নাম',
    'register.ownerNamePh':         'যেনে: ৰাজেশ কলিতা',
    'register.phone':               'মোবাইল নম্বৰ',
    'register.phonePh':             '১০-সংখ্যাৰ নম্বৰ',
    'register.category':            'দোকানৰ ধৰণ',
    'register.area':                'গুৱাহাটীৰ এলেকা',
    'register.areaPh':              'যেনে: উলুবাৰী, ফেন্সী বাজাৰ…',
    'register.upiId':               'UPI ID (ঐচ্ছিক)',
    'register.upiIdPh':             'yourname@upi',
    'register.submit':              'বিনামূলীয়াকৈ নিবন্ধন কৰক',
    'register.success':             'অনুৰোধ পঠোৱা হৈছে! আমি ২৪ ঘণ্টাৰ ভিতৰত ফোন কৰিম।',
    'register.legal':               'অব্যাহত ৰাখিলে আপুনি আমাৰ চৰ্তসমূহত সন্মতি দিছে। কোনো স্প্যাম নাই।',

    // Benefits
    'benefit.noCommission.title':   '৩ মাহ কোনো কমিছন নাই',
    'benefit.noCommission.sub':     'উপাৰ্জন আৰম্ভ কৰক, দিয়া নহয়',
    'benefit.anyPhone.title':       'যিকোনো Android ফোনত কাম কৰে',
    'benefit.anyPhone.sub':         'নতুন হাৰ্ডৱেৰৰ প্ৰয়োজন নাই',
    'benefit.waKit.title':          'প্ৰথম দিনাই বিনামূলীয়া WhatsApp কিট',
    'benefit.waKit.sub':            'আপোনাৰ নিয়মীয়া গ্ৰাহকৰ বাবে ৰেডিমেড বাৰ্তা',
    'benefit.setup.title':          '৫ মিনিটত ছেটআপ',
    'benefit.setup.sub':            'আমি আজিয়েই আপোনাক লাইভ কৰিবলৈ সহায় কৰিম',

    // Form fields
    'form.selectCategory':          'এটা শ্ৰেণী নিৰ্বাচন কৰক',
    'form.phoneHint':               'আমি এইটো কেৱল অৰ্ডাৰ এলাৰ্ট পঠাবলৈ ব্যৱহাৰ কৰো।',
    'form.hours':                   'দোকানৰ সময়',
    'form.opensAt':                 'খোলাৰ সময়',
    'form.closesAt':                'বন্ধৰ সময়',
    'form.lastOrder':               'শেষ অৰ্ডাৰ গ্ৰহণৰ সময়',
    'form.upiId':                   'UPI ID (ঐচ্ছিক)',
    'form.upiHint':                 'গ্ৰাহকক অনলাইনত পেমেণ্ট কৰিবলৈ দিয়ে। সুৰক্ষিত আৰু ঐচ্ছিক।',

    // Category options
    'cat.kirana':                   '🛒 কিৰানা / জেনেৰেল ষ্টোৰ',
    'cat.chemist':                  '💊 কেমিষ্ট / মেডিকেল',
    'cat.stationery':               '✏️ ষ্টেচনাৰী',
    'cat.bakery':                   '🎂 বেকাৰী',
    'cat.dairy':                    '🥛 ডেইৰী',
    'cat.beauty':                   '💄 বিউটি',
    'cat.fish':                     '🐟 মাছ আৰু মাংস',

    // Shift management
    'shift.greeting':               'শুভ পুৱা',
    'shift.statusOffline':          '🔴 অফলাইন — দোকান গ্ৰাহকৰ পৰা লুকুৱা',
    'shift.statusOnline':           '🟢 অনলাইন — গ্ৰাহকে আপোনাক দেখিব পাৰে',
    'shift.startBtn':               'দোকান খোলক',
    'shift.endBtn':                 'শ্বিফট শেষ কৰক',
    'shift.endConfirmTitle':        'শ্বিফট শেষ কৰিবনে?',
    'shift.endConfirmBody':         'আপোনাৰ দোকান অফলাইন হ\'ব। বাকী অৰ্ডাৰ থাকিব।',
    'shift.endConfirmYes':          'হয়, শেষ কৰক',
    'shift.endConfirmNo':           'চলাই যাওক',
    'shift.closingSoon':            '⏰ দোকান {time} ত বন্ধ হ\'ব।',
    'shift.autoClosing':            'শ্বিফট স্বয়ংক্ৰিয়ভাৱে বন্ধ সময়ত শেষ হৈছে।',
    'shift.summaryTitle':           'শ্বিফট সম্পূৰ্ণ 🎉',
    'shift.ordersCompleted':        'সম্পূৰ্ণ অৰ্ডাৰ',
    'shift.totalEarnings':          'মুঠ আয়',
    'shift.avgTime':                'গড় প্ৰস্তুতি সময়',
    'shift.pendingWarning':         '{n}টা অৰ্ডাৰ এতিয়াও বাকী। গ্ৰাহকক পোনপটীয়াকৈ যোগাযোগ কৰক।',
    'shift.exportWA':               'WhatsApp ত পঠাওক',
    'shift.startNew':               'নতুন শ্বিফট আৰম্ভ কৰক',
    'shift.alreadyStarted':         'শ্বিফট চলাওক',
    // Aliases
    'shift.offline':                '🔴 অফলাইন — দোকান গ্ৰাহকৰ পৰা লুকুৱাই ৰখা হৈছে',
    'shift.start':                  'শ্বিফ্ট আৰম্ভ কৰক — অনলাইন যাওক',
    'shift.end':                    'শ্বিফ্ট শেষ কৰক',
    'shift.hint':                   'আপোনাৰ দোকান আপোনাৰ অঞ্চলৰ গ্ৰাহকসকলৰ বাবে দৃশ্যমান হ\'ব।',
    'shift.hoursToday':             'আজি: {open} – {close}',
    'shift.yesterday':              'যোৱাকালি',

    // Dashboard
    'dashboard.title':              'অৰ্ডাৰ',
    'dashboard.ordersToday':        'আজিৰ অৰ্ডাৰ',
    'dashboard.earningsToday':      'আয়',
    'dashboard.avgReadyTime':       'গড় সময়',
    'dashboard.noOrders':           'কোনো সক্ৰিয় অৰ্ডাৰ নাই।',
    'dashboard.noOrdersSub':        'পৰৱৰ্তী অৰ্ডাৰ ইয়াত দেখা দিব।',
    'dashboard.pullRefresh':        '↑ টানি ৰিফ্ৰেছ কৰক',

    // Stats
    'stats.orders':                 'অৰ্ডাৰ',
    'stats.earnings':               'উপাৰ্জন',
    'stats.avgTime':                'গড় প্ৰস্তুত',
    'stats.ordersToday':            'আজিৰ অৰ্ডাৰ',
    'stats.earningsToday':          'আজিৰ উপাৰ্জন',
    'stats.avgReady':               'গড় প্ৰস্তুতিৰ সময়',

    // Tabs
    'tab.orders':                   'অৰ্ডাৰ',
    'tab.inventory':                'কুইক OOS',

    // Orders feed
    'orders.emptyTitle':            'কোনো সক্ৰিয় অৰ্ডাৰ নাই',
    'orders.emptySub':              'নতুন অৰ্ডাৰসমূহ এটা শব্দ এলাৰ্টৰ সৈতে ইয়াত দেখা যাব।',
    'pull.refresh':                 'ৰিফ্ৰেছ কৰিবলৈ টানক',

    // Order card & panel
    'order.payAtPickup':            'দোকানত পেমেণ্ট',
    'order.paidOnline':             'UPI ত পেমেণ্ট হৈছে',
    'order.readyBy':                'প্ৰস্তুত সময়',
    'order.tapManage':              'পৰিচালনা কৰক →',
    'order.customerOrder':          'গ্ৰাহকৰ তালিকা',
    'order.billLabel':              'মুঠ বিল পৰিমাণ',
    'order.billPlaceholder':        '0.00',
    'order.notesLabel':             'গ্ৰাহকৰ বাবে টোকা (ঐচ্ছিক)',
    'order.notesPlaceholder':       'যেনে: টাটা নিমখ নাই — কেপ্টেন কুক 1kg যোগ কৰা হৈছে ✓\nমেগী আজি নাই।',
    'order.oosLabel':               'ষ্টকত নাই বুলি চিহ্নিত কৰক',
    'order.sendQuote':              'কোটেছন পঠাওক',
    'order.markPacking':            'পেকিং আৰম্ভ',
    'order.markReady':              '🎉 পিকআপৰ বাবে প্ৰস্তুত!',
    'order.cancelOrder':            'অৰ্ডাৰ বাতিল কৰক',
    'order.cancelConfirm':          'নিশ্চিত? গ্ৰাহকক জনোৱা হ\'ব।',
    'order.cancelYes':              'হয়, বাতিল কৰক',
    'order.cancelNo':               'অৰ্ডাৰ ৰাখক',
    'order.total':                  'মুঠ: {amount}',
    'order.quoteNote':              'প্ৰতিস্থাপন টোকা',
    'order.photosAttached':         'ফটো তালিকা সংলগ্ন',
    'order.newAlert':               '🚨 নতুন অৰ্ডাৰ!',
    'order.statusPending':          'পৰ্যালোচনা হৈ আছে',
    'order.statusQuoted':           'কোটেছন পঠোৱা হৈছে',
    'order.statusPacking':          'পেক হৈ আছে',
    'order.statusReady':            'পিকআপৰ বাবে প্ৰস্তুত',
    'order.statusCancelled':        'বাতিল',

    // Order action panel aliases
    'panel.customerOrder':          'গ্ৰাহকৰ অৰ্ডাৰ',
    'panel.photoList':              'ফটোৰ তালিকা',
    'panel.yourResponse':           'আপোনাৰ উত্তৰ',
    'panel.billAmount':             'মুঠ বিলৰ পৰিমাণ',
    'panel.subNotes':               'গ্ৰাহকৰ বাবে টোকা (ঐচ্ছিক)',
    'panel.subNotesPlaceholder':    'উদাহৰণস্বৰূপে, টাটা নিমখ নাই — কেপ্টেইন কুক ১ কেজি যোগ কৰা হ\'ল ✓\nমেগী আজি উপলব্ধ নাই।',
    'panel.quickOos':               'এই অৰ্ডাৰত কুইক OOS কৰক',
    'panel.sendQuote':              'গ্ৰাহকলৈ কোট (Quote) পঠাওক',
    'panel.markPacking':            'পেকিং হিচাপে চিহ্নিত কৰক',
    'panel.markReady':              'পিকআপৰ বাবে প্ৰস্তুত 🎉',
    'panel.cancelOrder':            'অৰ্ডাৰ বাতিল কৰক',

    // OOS panel
    'oos.intro':                    'সামগ্ৰীসমূহ আউট অৱ ষ্টক বুলি চিহ্নিত কৰক। ই আপোনাৰ পৰৱৰ্তী কোটসমূহত স্বয়ংক্ৰিয়ভাৱে নোট হৈ যাব।',
    'oos.clearAll':                 'সকলো মচি পেলাওক',
    'oos.placeholder':              'সামগ্ৰী যোগ কৰক…',
    'oos.add':                      '+ যোগ কৰক',

    // Shift end screen
    'shiftEnd.title':               'শ্বিফ্ট সম্পূৰ্ণ হ\'ল!',
    'shiftEnd.sub':                 'আপোনাৰ দোকান এতিয়া অফলাইন আছে। কাইলৈ লগ পাম।',
    'shiftEnd.exportWA':            'WhatsApp-লৈ সাৰাংশ এক্সপ\'ৰ্ট কৰক',
    'shiftEnd.done':                'হৈ গ\'ল — কাইলৈ লগ পাম',
    'shiftEnd.pendingWarning':      'কিছুমান অৰ্ডাৰ এতিয়াও পেন্ডিং আছে। গ্ৰাহকৰ সৈতে পোনপটীয়াকৈ যোগাযোগ কৰক।',

    // Summary card
    'summary.ordersCompleted':      'সম্পূৰ্ণ হোৱা অৰ্ডাৰ',
    'summary.earnings':             'মুঠ উপাৰ্জন',
    'summary.avgTime':              'গড় সম্পূৰ্ণ হোৱাৰ সময়',
    'summary.shiftDuration':        'শ্বিফ্টৰ সময়কাল',

    // Notifications
    'notif.newOrder.title':         '🚨 নতুন অৰ্ডাৰ!',
    'notif.newOrder.body':          'এগৰাকী গ্ৰাহকে অৰ্ডাৰ দিলে।',
    'notif.ready.title':            '✅ অৰ্ডাৰ প্ৰস্তুত!',
    'notif.ready.body':             'দোকানলৈ আহি সামগ্ৰী লওক।',

    // Status labels
    'status.open':                  'খোলা আছে',
    'status.busy':                  'ব্যস্ত',
    'status.closed':                'বন্ধ',
    'status.online':                '🟢 অনলাইন',
    'status.offline':               '🔴 অফলাইন',

    // Language toggle labels
    'lang.en': 'EN',
    'lang.hi': 'हि',
    'lang.bn': 'বা',
    'lang.as': 'অ',

    // Common
    'common.min':                   'মিনিট',
    'common.km':                    'কিমি',
    'common.cancel':                'বাতিল',
    'common.confirm':               'নিশ্চিত',
    'common.close':                 'বন্ধ',
    'common.save':                  'সংৰক্ষণ',
    'common.back':                  'উভতি যাওক',
    'common.mins':                  'মিনিট',
  }
};

/* ── i18n Module ──────────────────────────────────────────── */
const i18n = (() => {
  // FIX: unified localStorage key to 'localbuy_lang' (was 'lb_lang')
  const STORAGE_KEY = 'localbuy_lang';

  let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';

  /**
   * Get a translation string by key.
   * Supports simple interpolation: i18n.t('shift.closingSoon', { time: '9 PM' })
   * Returns the key itself if no translation found (never crashes).
   */
  function t(key, vars = {}) {
    const strings = STRINGS[currentLang] || STRINGS['en'];
    let str = strings[key] !== undefined
      ? strings[key]
      : (STRINGS['en'][key] !== undefined ? STRINGS['en'][key] : key);

    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    return str;
  }

  /**
   * Change language. Persists to localStorage under 'localbuy_lang'.
   * Re-renders all [data-i18n] elements and updates aria-pressed on
   * language buttons.
   */
  function setLang(langCode) {
    if (!STRINGS[langCode]) {
      console.warn('[i18n] Unknown language:', langCode);
      return;
    }
    currentLang = langCode;
    localStorage.setItem(STORAGE_KEY, langCode);
    render();
  }

  /** Get current language code */
  function getLang() {
    return currentLang;
  }

  /**
   * Render all i18n-bound elements in the DOM.
   *
   * Handles:
   *  1. [data-i18n]             → element.textContent
   *  2. [data-i18n-placeholder] → element.placeholder
   *  3. [data-i18n-aria]        → element.aria-label
   *  4. select[data-i18n-select] <option data-i18n> → option.textContent
   *  5. .lang-btn               → .active class + aria-pressed (FIX)
   */
  function render() {
    // 1. Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });

    // 2. Placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });

    // 3. Aria-label attributes
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key));
    });

    // 4. Select <option> elements — preserve selected value
    document.querySelectorAll('select[data-i18n-select]').forEach(select => {
      const currentValue = select.value;
      select.querySelectorAll('option[data-i18n]').forEach(option => {
        const key = option.getAttribute('data-i18n');
        option.textContent = t(key);
      });
      select.value = currentValue;
    });

    // 5. Language toggle buttons — active class + aria-pressed (FIX)
    document.querySelectorAll('.lang-btn').forEach(btn => {
      const isActive = btn.dataset.lang === currentLang;
      btn.classList.toggle('active', isActive);
      // FIX: aria-pressed was not updated before; now correctly reflects state
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  /**
   * Format currency in Indian Rupees
   * e.g., formatCurrency(347) → "₹347"
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

  // Auto-render once DOM is ready
  document.addEventListener('DOMContentLoaded', render);

  return { t, setLang, getLang, render, formatCurrency, formatNumber };
})();

window.i18n = i18n; // Exposes i18n globally