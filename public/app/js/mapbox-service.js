/**
 * CHOW45 MAP SERVICE (Compatibility Layer)
 * Bridges legacy Mapbox / Map calls to GoogleMapsService.
 *
 * Replaces Mapbox with Google Maps Platform while providing 100% backward
 * compatibility for existing Chow45 controllers.
 *
 * Attribution: internalUsageAttributionIds: ['gmp_git_agentskills_v1']
 */

(function () {
  if (typeof window === 'undefined') return;

  // If GoogleMapsService is already loaded and initialized, alias chowMap
  if (window.chowGoogleMap) {
    window.chowMap = window.chowGoogleMap;
    return;
  }

  // If GoogleMapsService class is available on window, instantiate it
  if (typeof window.GoogleMapsService === 'function') {
    try {
      window.chowGoogleMap = new window.GoogleMapsService();
      window.chowMap = window.chowGoogleMap;
    } catch (e) {
      console.warn('[MapboxService] Could not instantiate window.GoogleMapsService:', e);
    }
  }
})();