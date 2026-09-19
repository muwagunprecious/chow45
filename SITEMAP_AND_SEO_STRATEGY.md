# Chow45 Site Map & SEO Strategy

## 1. Executive Summary & Core Objective
Chow45 is positioned to dominate organic search results for:
- **Primary Keywords**: "Food Delivery in Sagamu", "Food Delivery in OOU", "OOU Food Delivery"
- **Secondary Keywords**: "Food Delivery OOU Sagamu Campus", "Sagamu Food Delivery", "Order Food Online Sagamu", "OSUTH Food Delivery", "Fast Food Sagamu"
- **Long-tail Keywords**: "Deliver food to OOU hostels Sagamu", "Best campus food delivery OOU", "Late night food delivery Sagamu"

---

## 2. Technical Site Map Architecture

### A. Live / Production XML Sitemap (`sitemap.xml`)
The production XML sitemap is deployed at `https://chow45.vercel.app/sitemap.xml` and submitted to Google Search Console and Bing Webmaster Tools.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://chow45.vercel.app/</loc>
    <lastmod>2026-09-19</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://chow45.vercel.app/#how-it-works</loc>
    <lastmod>2026-09-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://chow45.vercel.app/#vendors</loc>
    <lastmod>2026-09-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://chow45.vercel.app/#faq</loc>
    <lastmod>2026-09-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://chow45.vercel.app/#waitlist</loc>
    <lastmod>2026-09-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
```

---

### B. Robots.txt Configuration (`robots.txt`)
Ensures all public pages are crawled while keeping administrative and backend endpoints private:
```text
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin.html
Disallow: /api/

Sitemap: https://chow45.vercel.app/sitemap.xml
```

---

### C. Recommended Multi-Page Growth Architecture (Phase 2 Expansion)
As Chow45 launches full vendor ordering, the site map should expand into dedicated landing pages targeting hyperlocal queries:

```text
https://chow45.vercel.app/
│
├── / (Home & Main Waitlist / Ordering Hub)
│
├── /food-delivery-sagamu (Hyperlocal Sagamu landing page for local town residents)
├── /food-delivery-oou (Targeted student landing page for OOU Sagamu campus)
│
├── /locations/
│   ├── /locations/oou-sagamu-campus
│   ├── /locations/osuth-teaching-hospital
│   ├── /locations/college-of-health-sciences
│   └── /locations/sagamu-central
│
├── /restaurants/ (Campus canteens and restaurant directory)
│   ├── /restaurants/canteens
│   ├── /restaurants/fast-food
│   └── /restaurants/bukas-and-local
│
├── /for-vendors (Dedicated vendor onboarding page)
└── /for-riders (Campus runner & rider signup)
```

---

## 3. On-Page SEO Optimizations Implemented

### 1. Title Tag Strategy
- **Format**: `Chow45 | Food Delivery in Sagamu & OOU Sagamu Campus`
- **Rationale**: Places the exact two highest-intent geographic search queries at the forefront of the `<title>` tag within optimal character count (<60 chars).

### 2. Meta Description
- **Description**: `Fast, reliable food delivery in Sagamu and OOU Sagamu campus. Order delicious meals from top student spots, canteens, and local restaurants straight to your hostel or desk with Chow45.`
- **CTR Factor**: Highlights speed, local spots, and direct delivery to hostels/desks.

### 3. Hyperlocal Geo Meta Tags
Configured for Google's Local Search Knowledge Graph and Google Maps discovery:
- `geo.region`: `NG-OG` (Nigeria, Ogun State)
- `geo.placename`: `Sagamu, Ogun State, Nigeria`
- `geo.position` & `ICBM`: `6.8485;3.6465` (Sagamu Coordinates)

### 4. Rich Structured Data (JSON-LD)
- **`FoodDeliveryService` & `LocalBusiness` Schema**:
  - Outlines exact service area: Sagamu, OOU Sagamu Campus, OSUTH Teaching Hospital, College of Health Sciences.
  - Cuisine types: Nigerian, Fast Food, Campus Meals, Snacks.
  - Price range: `₦₦`.
- **`FAQPage` Schema**:
  - Directly exposes answers to Google Search so prospective users see collapsible rich answer boxes directly on the search engine results page (SERP).
- **`WebSite` Schema**:
  - Enables Google site link search action.

### 5. Open Graph & Social Cards
- Configured with `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card` (summary_large_image) for viral sharing on WhatsApp, X (Twitter), Instagram, and Telegram campus student groups.
