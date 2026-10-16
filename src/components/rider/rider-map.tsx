'use client';

import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: any;
    __CHOW45_GOOGLE_MAPS_KEY__?: string;
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

  // Sagamu default center { lat, lng }
  const defaultCenter = { lat: 6.8482, lng: 3.6545 };

  // Resolve Google Maps API Key
  const getGoogleMapsKey = () => {
    return (
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      (typeof window !== 'undefined' ? window.__CHOW45_GOOGLE_MAPS_KEY__ : '') ||
      'AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo'
    );
  };

  // 1. Ensure Google Maps JS API is loaded
  useEffect(() => {
    let isMounted = true;

    const loadGoogleMaps = async () => {
      if (typeof window.google !== 'undefined' && window.google.maps) {
        if (isMounted) initMap();
        return;
      }

      const key = getGoogleMapsKey();
      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (isMounted) initMap();
        });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry,marker&loading=async&v=weekly`;
      script.async = true;
      script.onload = () => {
        if (isMounted) initMap();
      };
      script.onerror = () => {
        if (isMounted) setLoadError('Unable to load Google Maps engine.');
      };
      document.body.appendChild(script);
    };

    const initMap = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      if (!window.google || !window.google.maps) return;

      if (typeof window.google.maps.importLibrary === 'function') {
        try {
          const [mapsLib, markerLib] = await Promise.all([
            window.google.maps.importLibrary('maps'),
            window.google.maps.importLibrary('marker').catch(() => null),
          ]);
          if (mapsLib) Object.assign(window.google.maps, mapsLib);
          if (markerLib) {
            Object.assign(window.google.maps, markerLib);
            window.google.maps.marker = window.google.maps.marker || {};
            if (markerLib.AdvancedMarkerElement) {
              window.google.maps.marker.AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
              window.google.maps.marker.PinElement = markerLib.PinElement;
            }
          }
        } catch (e) {
          console.warn('[rider-map] importLibrary warning:', e);
        }
      }

      const MapConstructor = window.google.maps && window.google.maps.Map;
      if (typeof MapConstructor !== 'function') return;

      const initialCenter = riderLocation
        ? { lat: riderLocation.lat, lng: riderLocation.lng }
        : pickupLocation
        ? { lat: pickupLocation.lat, lng: pickupLocation.lng }
        : defaultCenter;

      try {
        const map = new MapConstructor(mapContainerRef.current, {
          center: initialCenter,
          zoom: 14.5,
          mapId: 'DEMO_MAP_ID',
          internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        window.google.maps.event.addListenerOnce(map, 'idle', () => {
          mapInstanceRef.current = map;
          setMapLoaded(true);
        });
      } catch (err: any) {
        console.error('Failed to create rider Google Map:', err);
        setLoadError('Google Map failed to initialize.');
      }
    };

    loadGoogleMaps();

    return () => {
      isMounted = false;
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Manage and update Markers whenever locations change
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google || !window.google.maps) return;
    const map = mapInstanceRef.current;
    const google = window.google;

    const boundsPoints: { lat: number; lng: number }[] = [];

    const createOrUpdateMarker = (
      markerRef: React.MutableRefObject<any>,
      coord: { lat: number; lng: number },
      contentEl: HTMLElement,
      popupHtml: string
    ) => {
      boundsPoints.push(coord);
      if (!markerRef.current) {
        if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
          const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: coord,
            content: contentEl,
          });
          const info = new google.maps.InfoWindow({ content: popupHtml });
          if (typeof marker.addEventListener === 'function') {
            marker.addEventListener('gmp-click', () => info.open({ anchor: marker, map }));
          } else {
            marker.addListener('click', () => info.open({ anchor: marker, map }));
          }
          markerRef.current = marker;
        } else {
          const marker = new google.maps.Marker({
            map,
            position: coord,
          });
          const info = new google.maps.InfoWindow({ content: popupHtml });
          marker.addListener('click', () => info.open({ anchor: marker, map }));
          markerRef.current = marker;
        }
      } else {
        if (markerRef.current.position !== undefined) {
          markerRef.current.position = coord;
        } else if (typeof markerRef.current.setPosition === 'function') {
          markerRef.current.setPosition(coord);
        }
      }
    };

    // --- Rider Marker ---
    if (riderLocation && Number.isFinite(riderLocation.lng) && Number.isFinite(riderLocation.lat)) {
      const riderCoord = { lat: riderLocation.lat, lng: riderLocation.lng };
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
      createOrUpdateMarker(
        riderMarkerRef,
        riderCoord,
        el,
        '<strong>You (Chow45 Rider)</strong><br><small>Live GPS Location</small>'
      );
    }

    // --- Store / Pickup Marker ---
    if (pickupLocation && Number.isFinite(pickupLocation.lng) && Number.isFinite(pickupLocation.lat)) {
      const pickupCoord = { lat: pickupLocation.lat, lng: pickupLocation.lng };
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #075B4D; border: 2.5px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 15px;">
          🏪
        </div>
      `;
      createOrUpdateMarker(
        pickupMarkerRef,
        pickupCoord,
        el,
        `<strong>Pickup: ${pickupLocation.name || 'Store'}</strong><br><small>${pickupLocation.address || 'Vendor Spot'}</small>`
      );
    }

    // --- Customer / Dropoff Marker ---
    if (dropoffLocation && Number.isFinite(dropoffLocation.lng) && Number.isFinite(dropoffLocation.lat)) {
      const dropoffCoord = { lat: dropoffLocation.lat, lng: dropoffLocation.lng };
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #E75A24; border: 2.5px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 15px;">
          📍
        </div>
      `;
      createOrUpdateMarker(
        dropoffMarkerRef,
        dropoffCoord,
        el,
        `<strong>Dropoff: ${dropoffLocation.name || 'Customer'}</strong><br><small>${dropoffLocation.address || 'Destination'}</small>`
      );
    }

    // Fit map bounds to show rider, pickup, and dropoff together
    if (boundsPoints.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      boundsPoints.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 60);
    } else if (boundsPoints.length === 1 && !pickupLocation && !dropoffLocation) {
      map.panTo(boundsPoints[0]);
      map.setZoom(15);
    }
  }, [mapLoaded, riderLocation, pickupLocation, dropoffLocation]);

  // Recenter button
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const center = riderLocation
      ? { lat: riderLocation.lat, lng: riderLocation.lng }
      : pickupLocation
      ? { lat: pickupLocation.lat, lng: pickupLocation.lng }
      : defaultCenter;
    mapInstanceRef.current.panTo(center);
    mapInstanceRef.current.setZoom(15.5);
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
