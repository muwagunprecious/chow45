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

  // 1. Try Google Maps Geocoding API (Primary)
  const PLUS_CODE_REGEX = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(\b|$)/i;
  const LEADING_PLUS_CODE_REGEX = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,4}(?:,\s*|\s+)?/i;
  const POSTAL_CODE_REGEX = /^\d{5,6}(?:,\s*|\s+)?/;

  const isPlusCode = (s?: string | null) => Boolean(s && PLUS_CODE_REGEX.test(s.trim()));
  const cleanFormattedAddress = (addr?: string | null) => {
    if (!addr) return '';
    let cleaned = addr.replace(LEADING_PLUS_CODE_REGEX, '').trim();
    cleaned = cleaned.replace(POSTAL_CODE_REGEX, '').trim();
    return cleaned;
  };

  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo';
  if (googleKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(googleKey)}&language=en&region=ng`;
      const res = await fetch(gUrl, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          // 1. Prioritize real street/premise/poi results that are NOT plus codes
          let best = data.results.find((r: any) =>
            r.types && !r.types.includes('plus_code') && (
              r.types.includes('street_address') ||
              r.types.includes('premise') ||
              r.types.includes('subpremise') ||
              r.types.includes('establishment') ||
              r.types.includes('point_of_interest') ||
              r.types.includes('neighborhood')
            )
          );

          // 2. If none, find ANY non-plus_code result (e.g. route, locality, admin area)
          if (!best) {
            best = data.results.find((r: any) =>
              r.types && !r.types.includes('plus_code') && !isPlusCode(r.formatted_address)
            );
          }

          // 3. Fallback to first result
          if (!best) {
            best = data.results[0];
          }

          const rawFormatted = best.formatted_address || '';
          const formatted = cleanFormattedAddress(rawFormatted) || rawFormatted;

          const getComp = (types: string[]) => {
            const comp = (best.address_components || []).find((c: any) =>
              types.some((t) => c.types.includes(t))
            );
            return comp ? comp.long_name : '';
          };
          const streetNumber = getComp(['street_number']);
          let route = getComp(['route']);
          if (/^unnamed\s+road$/i.test((route || '').trim())) {
            route = '';
          }

          const sublocality = getComp(['sublocality_level_1', 'sublocality', 'neighborhood', 'point_of_interest', 'administrative_area_level_3']);
          const locality = getComp(['locality', 'sublocality_level_1', 'sublocality']) || getComp(['administrative_area_level_2']);
          const lga = getComp(['administrative_area_level_2']);
          let state = getComp(['administrative_area_level_1']);
          if (state) state = state.replace(/\s*State$/i, '');
          const country = getComp(['country']) || 'Nigeria';

          let streetName = [streetNumber, route].filter(Boolean).join(' ') || sublocality || locality;
          if (!streetName || isPlusCode(streetName) || /^unnamed\s+road$/i.test(streetName.trim())) {
            const firstToken = formatted.split(',')[0].trim();
            if (firstToken && !isPlusCode(firstToken) && !/^\d{5,6}$/.test(firstToken) && !/^unnamed\s+road$/i.test(firstToken)) {
              streetName = firstToken;
            } else {
              streetName = sublocality || locality || 'Current Location';
            }
          }

          // Campus fallbacks for rural campus locations without tagged roads
          if (!streetName || streetName === 'Current Location' || isPlusCode(streetName)) {
            if (lat >= 6.84 && lat <= 6.92 && lng >= 3.24 && lng <= 3.32) {
              streetName = 'Ibogun Campus Area';
            } else if (lat >= 6.81 && lat <= 6.87 && lng >= 3.58 && lng <= 3.66) {
              streetName = 'Sagamu Campus (OSUTH)';
            }
          }

          return NextResponse.json({
            address: formatted,
            street: streetName,
            locality,
            lga,
            state: state || 'Ogun',
            country,
            source: 'google',
          });
        }
      }
    } catch (e) {
      console.warn('[geocode/reverse] Google Geocoding error:', e);
    }
  }

  // 2. Try Mapbox Geocoding (if token configured in environment)
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
