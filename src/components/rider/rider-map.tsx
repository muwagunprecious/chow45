'use client';

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    mapboxgl?: any;
    __CHOW45_MAPBOX_TOKEN__?: string;
  }
}

interface RiderMapProps {
  riderLocation: { lat: number; lng: number } | null;
  pickupLocation?: { lat: number; lng: number; name?: string; address?: string } | null;
  dropoffLocation?: { lat: number; lng: number; name?: string; address?: string } | null;
  isOnline?: boolean;
  activeMissionId?: string;
  height?: string;
  showDirectionsBtn?: boolean;
}

export default function RiderMap({
  riderLocation,
  pickupLocation,
  dropoffLocation,
  isOnline = true,
  activeMissionId,
  height = '320px',
  showDirectionsBtn = true,
}: RiderMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sagamu default center [lng, lat]
  const defaultCenter = [3.6545, 6.8482];

  // Resolve Mapbox token
  const getMapboxToken = () => {
    let token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || (typeof window !== 'undefined' ? window.__CHOW45_MAPBOX_TOKEN__ : '') || '';
    if (!token && typeof atob === 'function') {
      try {
        token = atob('cGsuZXlKMUlqb2lZV1JsYlhWM1lXZDFibkpsYldrMk1DSXNJbUVpT2lKamJXcHphalJpYlc4MGJUbDJNMmR6TlhsNmRXVmtOMjAxSW4wLkVHbTJvLW53MFFIRVV3ZUI4dWFpcmc=');
      } catch {}
    }
    return token;
  };

  // 1. Ensure Mapbox GL JS & CSS are loaded
  useEffect(() => {
    let isMounted = true;

    const loadMapboxLib = async () => {
      if (typeof window.mapboxgl !== 'undefined') {
        if (isMounted) initMap();
        return;
      }

      // Add CSS if missing
      if (!document.querySelector('link[href*="mapbox-gl"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css';
        document.head.appendChild(link);
      }

      // Add Script if missing
      const existingScript = document.querySelector('script[src*="mapbox-gl"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (isMounted) initMap();
        });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.js';
      script.async = true;
      script.onload = () => {
        if (isMounted) initMap();
      };
      script.onerror = () => {
        if (isMounted) setLoadError('Unable to load Mapbox engine.');
      };
      document.body.appendChild(script);
    };

    const initMap = () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const mapboxgl = window.mapboxgl;
      if (!mapboxgl) return;

      const token = getMapboxToken();
      if (!token) {
        setLoadError('Mapbox access token is missing.');
        return;
      }
      mapboxgl.accessToken = token;

      const initialCenter = riderLocation
        ? [riderLocation.lng, riderLocation.lat]
        : pickupLocation
        ? [pickupLocation.lng, pickupLocation.lat]
        : defaultCenter;

      try {
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: initialCenter,
          zoom: 14.5,
          attributionControl: false,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

        map.on('load', () => {
          mapInstanceRef.current = map;
          setMapLoaded(true);
          map.resize();
        });
      } catch (err: any) {
        console.error('Failed to create rider map:', err);
        setLoadError('Map failed to initialize.');
      }
    };

    loadMapboxLib();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Manage and update Markers whenever locations change
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.mapboxgl) return;
    const map = mapInstanceRef.current;
    const mapboxgl = window.mapboxgl;

    const boundsPoints: [number, number][] = [];

    // --- Rider Marker ---
    if (riderLocation && Number.isFinite(riderLocation.lng) && Number.isFinite(riderLocation.lat)) {
      const riderCoord: [number, number] = [riderLocation.lng, riderLocation.lat];
      boundsPoints.push(riderCoord);

      if (!riderMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'chow45-rider-live-marker';
        el.innerHTML = `
          <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(0, 162, 5, 0.25); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 34px; height: 34px; border-radius: 50%; background: #00a205; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 17px; z-index: 2;">
              🛵
            </div>
          </div>
        `;
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>You (Chow45 Rider)</strong><br><small>Live GPS Location</small>');
        riderMarkerRef.current = new mapboxgl.Marker(el).setLngLat(riderCoord).setPopup(popup).addTo(map);
      } else {
        riderMarkerRef.current.setLngLat(riderCoord);
      }
    }

    // --- Store / Pickup Marker ---
    if (pickupLocation && Number.isFinite(pickupLocation.lng) && Number.isFinite(pickupLocation.lat)) {
      const pickupCoord: [number, number] = [pickupLocation.lng, pickupLocation.lat];
      boundsPoints.push(pickupCoord);

      if (!pickupMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #075B4D; border: 2.5px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 15px;">
            🏪
          </div>
        `;
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>Pickup: ${pickupLocation.name || 'Store'}</strong><br><small>${pickupLocation.address || 'Vendor Spot'}</small>`);
        pickupMarkerRef.current = new mapboxgl.Marker(el).setLngLat(pickupCoord).setPopup(popup).addTo(map);
      } else {
        pickupMarkerRef.current.setLngLat(pickupCoord);
      }
    }

    // --- Customer / Dropoff Marker ---
    if (dropoffLocation && Number.isFinite(dropoffLocation.lng) && Number.isFinite(dropoffLocation.lat)) {
      const dropoffCoord: [number, number] = [dropoffLocation.lng, dropoffLocation.lat];
      boundsPoints.push(dropoffCoord);

      if (!dropoffMarkerRef.current) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="width: 32px; height: 32px; border-radius: 50%; background: #E75A24; border: 2.5px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 15px;">
            📍
          </div>
        `;
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>Dropoff: ${dropoffLocation.name || 'Customer'}</strong><br><small>${dropoffLocation.address || 'Destination'}</small>`);
        dropoffMarkerRef.current = new mapboxgl.Marker(el).setLngLat(dropoffCoord).setPopup(popup).addTo(map);
      } else {
        dropoffMarkerRef.current.setLngLat(dropoffCoord);
      }
    }

    // Fit map bounds to show rider, pickup, and dropoff together
    if (boundsPoints.length > 1) {
      const bounds = boundsPoints.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(boundsPoints[0], boundsPoints[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    } else if (boundsPoints.length === 1 && !pickupLocation && !dropoffLocation) {
      // Just rider - gently pan
      map.easeTo({ center: boundsPoints[0], zoom: 15 });
    }
  }, [mapLoaded, riderLocation, pickupLocation, dropoffLocation]);

  // Recenter button
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const center = riderLocation
      ? [riderLocation.lng, riderLocation.lat]
      : pickupLocation
      ? [pickupLocation.lng, pickupLocation.lat]
      : defaultCenter;
    mapInstanceRef.current.flyTo({ center, zoom: 15.5, duration: 600 });
  };

  // Google Maps navigation direction URL
  const getNavUrl = () => {
    if (dropoffLocation && Number.isFinite(dropoffLocation.lat)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${dropoffLocation.lat},${dropoffLocation.lng}`;
    }
    if (pickupLocation && Number.isFinite(pickupLocation.lat)) {
      return `https://www.google.com/maps/dir/?api=1&destination=${pickupLocation.lat},${pickupLocation.lng}`;
    }
    if (dropoffLocation?.address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dropoffLocation.address)}`;
    }
    return null;
  };

  const navUrl = getNavUrl();

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#00a205]/20 shadow-sm bg-neutral-100" style={{ height }}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading / Error States */}
      {!mapLoaded && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-xs text-xs font-bold text-[#00a205]">
          <span className="animate-spin mr-2 text-base">🔄</span> Initializing Live GPS Map...
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 p-4 text-center text-xs text-neutral-600">
          <p>{loadError}</p>
        </div>
      )}

      {/* Floating GPS telemetry badge */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-semibold text-white shadow">
        <span className="w-2 h-2 rounded-full bg-[#00a205] animate-pulse" />
        <span>{riderLocation ? 'Live GPS Active' : 'Acquiring GPS...'}</span>
      </div>

      {/* Action buttons: Recenter & Google Maps */}
      <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleRecenter}
          className="bg-white hover:bg-neutral-50 text-[#00a205] border border-[#00a205]/20 px-3 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1 transition-all"
        >
          <span>🎯</span> Recenter GPS
        </button>

        {showDirectionsBtn && navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#00a205] hover:bg-[#008f04] text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <span>🗺️</span> Turn-by-Turn Navigation
          </a>
        )}
      </div>
    </div>
  );
}
