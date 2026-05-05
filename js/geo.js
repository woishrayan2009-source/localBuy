/**
 * geo.js — LocalBuy
 * ─────────────────────────────────────────────────────────────────────────────
 * GPS detection, Guwahati bounding-box validation, distance calculation,
 * and location-based shop sorting.
 *
 * All geolocation is opt-in. No coordinates are sent to any server in the stub.
 * TODO: When Firebase is live, store anonymised location (city-level only)
 *       for analytics — never store precise coords without explicit consent.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/* ─── Guwahati bounding box ───────────────────────────────────────────────── */

const GUWAHATI_BOUNDS = {
  lat: { min: 25.95, max: 26.25 },
  lng: { min: 91.45, max: 91.95 }
};

/* Rough centre of Guwahati (used as fallback for distance sort) */
const GUWAHATI_CENTRE = { lat: 26.1445, lng: 91.7362 };

/* ─── Core functions ──────────────────────────────────────────────────────── */

/**
 * Check whether a coordinate is inside the Guwahati metro area.
 * @param {{ lat: number, lng: number }} coords
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
 * Request the user's current position via the Geolocation API.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation not supported by this browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }),
      error => {
        let msg = 'Location access denied.';
        if (error.code === error.TIMEOUT)         msg = 'Location request timed out.';
        if (error.code === error.POSITION_UNAVAILABLE) msg = 'Position unavailable.';
        reject(new Error(msg));
      },
      {
        timeout: 8000,
        maximumAge: 300000,   // 5 min cache — avoids repeated prompts
        enableHighAccuracy: false  // city-level accuracy is enough; saves battery
      }
    );
  });
}

/**
 * Haversine formula — great-circle distance between two lat/lng points.
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number} distance in kilometres
 */
function haversineKm(a, b) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const chord =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

/**
 * Format a distance in km to a human-readable string.
 * @param {number} km
 * @returns {string} e.g., "0.3 km" or "1.2 km"
 */
function formatDistance(km) {
  if (km < 1) return (km * 1000).toFixed(0) + ' m';
  return km.toFixed(1) + ' km';
}

/**
 * Sort an array of shop objects by distance from a given coordinate.
 * Shops without real lat/lng data keep their mock distance strings unchanged.
 * @param {Array} shops — shop objects (may have .lat .lng or just .distance string)
 * @param {{ lat: number, lng: number }} userCoords
 * @returns {Array} new sorted array
 */
function sortShopsByDistance(shops, userCoords) {
  return [...shops].sort((a, b) => {
    // If shops have real coordinates, use them
    const distA = a.lat ? haversineKm(userCoords, { lat: a.lat, lng: a.lng }) : parseFloat(a.distance);
    const distB = b.lat ? haversineKm(userCoords, { lat: b.lat, lng: b.lng }) : parseFloat(b.distance);
    return distA - distB;
  });
}

/* ─── UI integration ──────────────────────────────────────────────────────── */

/**
 * Initialise the live badge on the landing page.
 * - Confirms user is in Guwahati → adds .confirmed class
 * - Outside Guwahati → updates tagline text
 *
 * Called from app.js on DOMContentLoaded.
 */
async function initLocationBadge() {
  try {
    const loc = await getUserLocation();

    if (isInGuwahati(loc)) {
      const badge = document.querySelector('.live-badge');
      if (badge) badge.classList.add('confirmed');

      // Store for this session — no server call
      sessionStorage.setItem('lb_user_lat', loc.lat);
      sessionStorage.setItem('lb_user_lng', loc.lng);

      // TODO: Sort shops by real distance from loc
      console.log('[Geo] User confirmed in Guwahati', loc);
    } else {
      const tagline = document.querySelector('.hero-tagline');
      if (tagline) tagline.textContent = 'Coming to your city soon 🚀';
      console.log('[Geo] User outside Guwahati bounds', loc);
    }
  } catch (err) {
    // Silent fail — default state already shown
    console.log('[Geo] Location not available:', err.message);
  }
}

/**
 * Get the cached user location from sessionStorage (set during initLocationBadge).
 * Returns null if not available.
 * @returns {{ lat: number, lng: number } | null}
 */
function getCachedLocation() {
  const lat = parseFloat(sessionStorage.getItem('lb_user_lat'));
  const lng = parseFloat(sessionStorage.getItem('lb_user_lng'));
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Attempt GPS sort on the customer browse section.
 * Shows appropriate UI feedback.
 * @param {Function} onSuccess — called with sorted shops array
 * @param {Function} onFail   — called when location unavailable
 */
async function triggerGPSSort(onSuccess, onFail) {
  try {
    const loc = await getUserLocation();

    if (!isInGuwahati(loc)) {
      onFail('outside-bounds');
      return;
    }

    sessionStorage.setItem('lb_user_lat', loc.lat);
    sessionStorage.setItem('lb_user_lng', loc.lng);

    const shops = await window.DB.getShops();
    const sorted = sortShopsByDistance(shops, loc);

    // Update distance strings on sorted shops for display
    const enriched = sorted.map(shop => {
      if (shop.lat) {
        const km = haversineKm(loc, { lat: shop.lat, lng: shop.lng });
        return { ...shop, distance: formatDistance(km) };
      }
      return shop;
    });

    onSuccess(enriched, loc);
  } catch (err) {
    onFail('denied');
  }
}

/* ─── Export to window ────────────────────────────────────────────────────── */
window.Geo = {
  isInGuwahati,
  getUserLocation,
  haversineKm,
  formatDistance,
  sortShopsByDistance,
  initLocationBadge,
  getCachedLocation,
  triggerGPSSort,
  GUWAHATI_BOUNDS,
  GUWAHATI_CENTRE
};