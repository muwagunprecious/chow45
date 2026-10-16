/**
 * CHOW45 MAP CONFIG
 * Powered by Google Maps Platform.
 */

(function () {
  let key = (window.__CHOW45_GOOGLE_MAPS_KEY__ || '').trim();
  if (!key) {
    key = 'AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo';
  }
  window.__CHOW45_GOOGLE_MAPS_KEY__ = key;
  window.__CHOW45_MAPBOX_TOKEN__ = key;

  window.CHOW45_MAP_CONFIG = {
    key: key,
    mapId: 'DEMO_MAP_ID',
    libraries: ['places', 'geometry', 'marker'],
    searchDebounceMs: 350,
    moveSettleMs: 500,
    geocodeProximity: { lat: 6.8482, lng: 3.6545 },
    defaultCenter: { lat: 6.8482, lng: 3.6545 },
    zoneFillColor: '#00B978',
    zoneFillOpacity: 0.14,
    zoneLineColor: '#0C513F',
    markerColor: '#EA4335',
    routeColor: '#1A73E8',
    routeCasing: '#FFFFFF',
    routeCasingWidth: 7,
    routeWidth: 4,
    accuracyColor: 'rgba(66, 133, 244, 0.18)',
    accuracyStroke: '#4285F4',
    internalUsageAttributionIds: ['gmp_git_agentskills_v1']
  };

  // Compatibility alias for controllers checking CHOW45_MAPBOX_CONFIG
  window.CHOW45_MAPBOX_CONFIG = {
    ...window.CHOW45_MAP_CONFIG,
    token: key
  };

  window.CHOW45_MAPBOX_TOKEN_ERROR = null;
})();