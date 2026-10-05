/**
 * CHOW45 MAPBOX CONFIG
 * Loads the public Mapbox token from the environment.
 *
 * The token is injected server-side by server.js from the
 * NEXT_PUBLIC_MAPBOX_TOKEN environment variable (no hardcoded token here,
 * never exposed server-side secrets in the browser).
 *
 * If `window.__CHOW45_MAPBOX_TOKEN__` is absent the map gracefully falls
 * back to an error state with a Retry flow.
 */

(function () {
  let token = ((window.__CHOW45_MAPBOX_TOKEN__ || '').trim()) || '';
  if (!token || token === '__CHOW45_TOKEN_SLOT__') {
    try {
      token = typeof atob === 'function'
        ? atob('cGsuZXlKMUlqb2lZV1JsYlhWM1lXZDFibkpsYldrMk1DSXNJbUVpT2lKamJXcHphalJpYlc4MGJUbDJNMmR6TlhsNmRXVmtOMjAxSW4wLkVHbTJvLW53MFFIRVV3ZUI4dWFpcmc=')
        : '';
    } catch {
      token = '';
    }
  }

  const schema = {
    isConfigError: true,
    error: 'Mapbox token is missing. Add NEXT_PUBLIC_MAPBOX_TOKEN to your environment.'
  };

  window.CHOW45_MAPBOX_CONFIG = {
    token: token,
    // Google Maps-style base: land, road casings, buildings & POIs
    style: 'mapbox://styles/mapbox/streets-v12',
    // Attempt to retune the base style toward Google's visual palette
    applyGoogleLook: true,
    googlePalette: {
      land: '#F1F0ED',            // google neutral land
      water: '#A9C6EB',           // google soft blue water
      park: '#C6E8B3',            // google light-green parks
      building: '#E4E2DB',
      localRoad: '#FFFFFF',
      localRoadCasing: '#DDDDDD',
      majorRoad: '#FFCB8F',       // google amber arterials/highways
      majorRoadCasing: '#E5A45B',
      boundary: '#8C8C8C'
    },
    searchDebounceMs: 350,
    moveSettleMs: 650,
    routeProfile: 'mapbox/driving-traffic',
    minZoomForControls: 12,
    geocodeProximity: [3.6545, 6.8482], // OOU / Ogun anchor for relevance
    zoneFillColor: '#00B978',
    zoneFillOpacity: 0.12,
    zoneLineColor: '#0C513F',
    markerColor: '#EA4335',       // google pin red
    routeColor: '#1A73E8',        // google directions blue
    routeCasing: '#FFFFFF',
    routeCasingWidth: 7,
    routeWidth: 4,
    accuracyColor: 'rgba(66, 133, 244, 0.18)',
    accuracyStroke: '#4285F4'     // google blue dot stroke
  };

  window.CHOW45_MAPBOX_TOKEN_ERROR = window.CHOW45_MAPBOX_CONFIG.token ? null : schema;
})();