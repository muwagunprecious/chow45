import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo';

  if (googleKey) {
    try {
      // Google Places API (New) Autocomplete
      const url = "https://places.googleapis.com/v1/places:autocomplete";
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey
        },
        body: JSON.stringify({
          input: q,
          includedRegionCodes: ['ng']
        }),
        next: { revalidate: 300 }
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          const results = data.suggestions
            .filter((s: any) => s.placePrediction)
            .map((s: any) => {
              const p = s.placePrediction;
              return {
                text: p.structuredFormat?.mainText?.text || p.text?.text?.split(',')[0] || q,
                placeName: p.text?.text || p.structuredFormat?.mainText?.text,
                placeId: p.placeId || (p.place ? p.place.replace(/^places\//, '') : ''),
                type: p.types?.[0] || 'street'
              };
            });
          return NextResponse.json({ results, source: 'google_places_new' });
        }
      }
    } catch (e) {
      console.warn('[geocode/autocomplete] Google Places (New) error:', e);
    }
  }

  // Fallback to OpenStreetMap Nominatim
  try {
    const nomUrl = "https://nominatim.openstreetmap.org/search?format=jsonv2&q=" + encodeURIComponent(q) + "&countrycodes=ng&limit=6";
    const nomRes = await fetch(nomUrl, { headers: { Accept: 'application/json' } });
    if (nomRes.ok) {
      const data = await nomRes.json();
      const results = (data || []).map((f: any) => ({
        text: f.name || f.display_name.split(',')[0],
        placeName: f.display_name,
        lng: parseFloat(f.lon),
        lat: parseFloat(f.lat),
        placeId: String(f.place_id),
        type: f.type || 'place',
      }));
      return NextResponse.json({ results, source: 'nominatim' });
    }
  } catch (nomErr) {
    console.warn('[geocode/autocomplete] Nominatim error:', nomErr);
  }

  return NextResponse.json({ results: [] });
}
