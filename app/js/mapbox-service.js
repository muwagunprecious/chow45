/**
 * CHOW45 MAPBOX GL JS SERVICE
 * Live delivery map, route polyline, and animated rider markers
 */

const MAPBOX_TOKEN = (typeof window !== 'undefined' && window.atob)
  ? window.atob('cGsuZXlKMUlqb2lZV1JsYlhWM1lXZDFibkpsYldrMk1DSXNJbUVpT2lKamJXcHphalJpYlc4MGJUbDJNMmR6TlhsNmRXVmtOMjAxSW4wLkVHbTJvLW53MFFIRVV3ZUI4dWFpcmc=')
  : '';

class MapboxService {
  constructor() {
    this.map = null;
    this.markers = {};
    this.isLoaded = false;
    this.routeAnimationTimer = null;
  }

  initMap(containerId = 'mapbox-canvas', initialCenter = [3.6540, 6.8480]) {
    if (this.map) return;

    if (typeof mapboxgl === 'undefined') {
      console.warn('Mapbox GL JS not yet loaded.');
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      this.map = new mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/light-v11', // Clean minimalist light map style
        center: initialCenter,
        zoom: 14.5,
        attributionControl: false
      });

      this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      this.map.on('load', () => {
        this.isLoaded = true;
        this._setupRouteLayer();
      });
    } catch (e) {
      console.error('Error initializing Mapbox:', e);
    }
  }

  _setupRouteLayer() {
    if (!this.map || !this.map.getSource) return;

    if (!this.map.getSource('delivery-route')) {
      this.map.addSource('delivery-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      this.map.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'delivery-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#072B1F',
          'line-width': 7,
          'line-opacity': 0.2
        }
      });

      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'delivery-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0B4633',
          'line-width': 4,
          'line-dasharray': [1, 1.5]
        }
      });
    }
  }

  renderDeliveryMission(order, store, customerLocation) {
    if (!this.map) {
      this.initMap('mapbox-canvas', [customerLocation.lng, customerLocation.lat]);
    }

    const storeCoord = [store.lng || 3.6530, store.lat || 6.8475];
    const custCoord = [customerLocation.lng || 3.6545, customerLocation.lat || 6.8482];

    // Rider initial coordinate
    const rider = window.chowStore.state.riders[0];
    let riderCoord = [rider.currentLng || 3.6510, rider.currentLat || 6.8440];

    // Clear existing markers
    this.clearMarkers();

    // 1. Store Marker
    const storeEl = document.createElement('div');
    storeEl.className = 'marker-pin marker-store';
    storeEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
    this.markers.store = new mapboxgl.Marker(storeEl)
      .setLngLat(storeCoord)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${store.name}</strong><br><small>Pickup Spot</small>`))
      .addTo(this.map);

    // 2. Customer Marker
    const custEl = document.createElement('div');
    custEl.className = 'marker-pin marker-customer';
    custEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    this.markers.customer = new mapboxgl.Marker(custEl)
      .setLngLat(custCoord)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>Delivery Point</strong><br><small>${order.deliveryAddress}</small>`))
      .addTo(this.map);

    // 3. Rider Marker
    const riderEl = document.createElement('div');
    riderEl.className = 'marker-pin marker-rider';
    riderEl.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><path d="M15 6h-5l-3 6.5h6l3-6.5z"/><path d="M19 17.5l-4-7.5h-5"/></svg>`;
    this.markers.rider = new mapboxgl.Marker(riderEl)
      .setLngLat(riderCoord)
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${order.riderName || rider.name}</strong><br><small>Chow45 Express Dispatch</small>`))
      .addTo(this.map);

    // Generate route interpolation
    const routePoints = [
      riderCoord,
      storeCoord,
      [(storeCoord[0] + custCoord[0]) / 2 + 0.001, (storeCoord[1] + custCoord[1]) / 2],
      custCoord
    ];

    if (this.isLoaded) {
      this._updateRouteData(routePoints);
    } else {
      this.map.on('load', () => this._updateRouteData(routePoints));
    }

    // Fit camera
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend(storeCoord);
    bounds.extend(custCoord);
    bounds.extend(riderCoord);
    this.map.fitBounds(bounds, { padding: 80, duration: 1000 });

    // Animate rider along route
    this.startRiderSimulation(order.status, riderCoord, storeCoord, custCoord);
  }

  _updateRouteData(coordinates) {
    const source = this.map.getSource('delivery-route');
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
        }
      });
    }
  }

  startRiderSimulation(status, riderCoord, storeCoord, custCoord) {
    if (this.routeAnimationTimer) {
      clearInterval(this.routeAnimationTimer);
    }

    let progress = 0;
    const isHeadingToCustomer = ['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(status);
    const startPoint = isHeadingToCustomer ? storeCoord : riderCoord;
    const endPoint = isHeadingToCustomer ? custCoord : storeCoord;

    if (status === 'DELIVERED') {
      if (this.markers.rider) {
        this.markers.rider.setLngLat(custCoord);
      }
      return;
    }

    this.routeAnimationTimer = setInterval(() => {
      progress += 0.025;
      if (progress > 1) progress = 0;

      const currentLng = startPoint[0] + (endPoint[0] - startPoint[0]) * progress;
      const currentLat = startPoint[1] + (endPoint[1] - startPoint[1]) * progress;

      if (this.markers.rider) {
        this.markers.rider.setLngLat([currentLng, currentLat]);
      }
    }, 400);
  }

  clearMarkers() {
    if (this.markers.store) this.markers.store.remove();
    if (this.markers.customer) this.markers.customer.remove();
    if (this.markers.rider) this.markers.rider.remove();
    this.markers = {};
    if (this.routeAnimationTimer) clearInterval(this.routeAnimationTimer);
  }

  resize() {
    if (this.map) {
      setTimeout(() => this.map.resize(), 100);
    }
  }
}

window.chowMap = new MapboxService();
