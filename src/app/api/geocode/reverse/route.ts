import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');

  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Valid lat and lng query params are required' }, { status: 400 });
  }

  // 1. Try Mapbox Geocoding (if token configured in environment)
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  if (token) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${encodeURIComponent(token)}&limit=1`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const json = await res.json();
        const feat = json.features && json.features[0];
        if (feat && feat.place_name && !feat.place_name.startsWith('Lat:')) {
          return NextResponse.json({
            address: feat.place_name,
            street: feat.text || feat.place_name.split(',')[0],
            source: 'mapbox',
          });
        }
      }
    } catch (e) {
      console.warn('[geocode/reverse] Mapbox error:', e);
    }
  }

  // 2. Try OpenStreetMap Nominatim
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(nomUrl, {
      headers: {
        'User-Agent': 'Chow45App/1.0 (support@chow45.com)',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const a = data.address || {};
      const parts: string[] = [];
      if (a.road || a.pedestrian) parts.push(a.road || a.pedestrian);
      if (a.suburb && !parts.includes(a.suburb)) parts.push(a.suburb);
      if (a.neighbourhood && !parts.includes(a.neighbourhood)) parts.push(a.neighbourhood);
      if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county);
      if (a.state) parts.push(a.state);
      if (a.country) parts.push(a.country);

      const formatted = parts.length > 0 ? parts.join(', ') : data.display_name;
      if (formatted) {
        return NextResponse.json({
          address: formatted,
          street: a.road || a.suburb || a.city || formatted.split(',')[0],
          source: 'nominatim',
        });
      }
    }
  } catch (e) {
    console.warn('[geocode/reverse] Nominatim error:', e);
  }

  // 3. Try BigDataCloud
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl);
    if (res.ok) {
      const data = await res.json();
      const parts: string[] = [];
      if (data.locality) parts.push(data.locality);
      if (data.city && data.city !== data.locality) parts.push(data.city);
      if (data.principalSubdivision) parts.push(data.principalSubdivision);
      if (data.countryName) parts.push(data.countryName);

      if (parts.length > 0) {
        const formatted = parts.join(', ');
        return NextResponse.json({
          address: formatted,
          street: data.locality || data.city || formatted,
          source: 'bigdatacloud',
        });
      }
    }
  } catch (e) {
    console.warn('[geocode/reverse] BigDataCloud error:', e);
  }

  return NextResponse.json({
    address: `Location near (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    street: 'Current Location',
    source: 'fallback',
  });
}
