/* ============================================================
   LocalBuy — geo.js
   GPS detection and Guwahati bounding-box validation.
   Haversine distance calculation for shop sorting.
   ============================================================ */

/**
 * Guwahati metropolitan area bounding box.
 * Covers Fancy Bazar to Jalukbari, Dispur to North Guwahati.
 */
const GUWAHATI_BOUNDS = {
  lat: { min: 25.95, max: 26.25 },
  lng: { min: 91.45, max: 91.95 }
};

/**
 * Check if a coordinate pair is within Guwahati's bounding box.
 * @param {Object} coord - { lat: number, lng: number }
 * @returns {boolean}
 */
function isInGuwahati({ lat, lng }) {
  return (
    lat >= GUWAHATI_BOUNDS.lat.min &&
    lat <= GUWAHATI_BOUNDS.lat.max &&
    lng >= GUWAHATI_BOUNDS.lng.min &&
    lng <= GUWAHATI_BOUNDS.lng.max
  );
}

/**
 * Get user's current GPS location.
 * Returns a Promise resolving to { lat, lng }.
 * Rejects with a descriptive error string on failure.
 *
 * @returns {Promise<{lat: number, lng: number}>}
 */
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('Geolocation not supported on this device.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      (err) => {
        const messages = {
          1: 'Location access denied. Please allow in browser settings.',
          2: 'Location unavailable. Are you indoors?',
          3: 'Location request timed out. Try again.'
        };
        reject(messages[err.code] || 'Could not get location.');
      },
      {
        timeout: 8000,
        maximumAge: 300000,  // Cache for 5 minutes
        enableHighAccuracy: false  // Battery-friendly on Android
      }
    );
  });
}

/**
 * Haversine formula — great-circle distance between two coordinates.
 * Returns distance in kilometres.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in km, rounded to 1 decimal
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Sort an array of shop objects by distance from userLoc.
 * Shops must have .lat and .lng properties.
 * Returns a new sorted array.
 *
 * @param {Array} shops
 * @param {{lat: number, lng: number}} userLoc
 * @returns {Array}
 */
function sortShopsByDistance(shops, userLoc) {
  return [...shops].sort((a, b) => {
    const distA = haversineDistance(userLoc.lat, userLoc.lng, a.lat, a.lng);
    const distB = haversineDistance(userLoc.lat, userLoc.lng, b.lat, b.lng);
    return distA - distB;
  }).map(shop => ({
    ...shop,
    distance: haversineDistance(userLoc.lat, userLoc.lng, shop.lat, shop.lng) + ' km'
  }));
}

/**
 * Initialise the location badge on the landing/browse page.
 * If user is in Guwahati → confirms live badge.
 * If outside → shows "coming to your city soon" message.
 * Always silently fails (never crashes the page).
 */
async function initLocationBadge() {
  try {
    const loc = await getUserLocation();

    if (isInGuwahati(loc)) {
      // Confirm the live badge
      const badge = document.querySelector('.live-badge');
      if (badge) badge.classList.add('confirmed');

      // Store for shop sorting — used by customer.js
      sessionStorage.setItem('lb_user_lat', loc.lat);
      sessionStorage.setItem('lb_user_lng', loc.lng);

      // TODO: Sort MOCK_SHOPS by real distance via sortShopsByDistance()

    } else {
      // User is outside Guwahati — update hero tagline gracefully
      const tagline = document.querySelector('.hero-tagline');
      if (tagline) tagline.textContent = 'Coming to your city soon';
    }
  } catch (err) {
    // Silent fail — default state is fine, don't disrupt UX
    console.log('[Geo] Location unavailable:', err);
  }
}

/**
 * Get stored location from sessionStorage (set by initLocationBadge).
 * @returns {{lat: number, lng: number} | null}
 */
function getStoredLocation() {
  const lat = parseFloat(sessionStorage.getItem('lb_user_lat'));
  const lng = parseFloat(sessionStorage.getItem('lb_user_lng'));
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}