import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = (searchParams.get('placeId') || '').trim();

  if (!placeId) {
    return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo';

  if (googleKey) {
    try {
      // Places API (New) Place Details
      const url = "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId) + "?fields=id,displayName,formattedAddress,location,addressComponents&key=" + encodeURIComponent(googleKey);
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        if (data.location && typeof data.location.latitude === 'number') {
          return NextResponse.json({
            placeId: data.id || placeId,
            name: data.displayName?.text || data.formattedAddress?.split(',')[0],
            formattedAddress: data.formattedAddress,
            lat: data.location.latitude,
            lng: data.location.longitude,
            source: 'google_places_new'
          });
        }
      }
    } catch (e) {
      console.warn('[geocode/details] Google Places Details error:', e);
    }

    // Fallback: Geocoding API by place_id
    try {
      const geoUrl = "https://maps.googleapis.com/maps/api/geocode/json?place_id=" + encodeURIComponent(placeId) + "&key=" + encodeURIComponent(googleKey);
      const res = await fetch(geoUrl, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results[0]) {
          const r = data.results[0];
          return NextResponse.json({
            placeId,
            name: r.formatted_address.split(',')[0],
            formattedAddress: r.formatted_address,
            lat: r.geometry.location.lat,
            lng: r.geometry.location.lng,
            source: 'google_geocoding'
          });
        }
      }
    } catch (geoErr) {
      console.warn('[geocode/details] Google Geocoding fallback error:', geoErr);
    }
  }

  return NextResponse.json({ error: 'Could not resolve place details' }, { status: 404 });
}
