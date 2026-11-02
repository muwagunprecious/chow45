import type { Metadata } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";



export const metadata: Metadata = {
  title: "Chow45 | Food Delivery in Sagamu & OOU Sagamu Campus",
  description:
    "Fast, reliable food delivery in Sagamu and OOU Sagamu campus. Order delicious meals from top student spots, canteens, and local restaurants straight to your hostel or desk with Chow45.",
  keywords: [
    "food delivery in sagamu",
    "food delivery in oou",
    "food delivery in oou sagamu campus",
    "oou food delivery",
    "sagamu food delivery",
    "order food in sagamu",
    "online food ordering sagamu",
    "olabisi onabanjo university food",
    "osuth food delivery",
    "sagamu restaurants",
    "chow45",
  ],
  authors: [{ name: "Chow45" }],
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: APP_URL,
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.png",
    apple: "/logo.png",
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    title: "Chow45 | Food Delivery in Sagamu & OOU Sagamu Campus",
    description:
      "Fast, reliable food delivery in Sagamu and OOU Sagamu campus. Order meals from your favourite campus spots and local restaurants.",
    images: [
      {
        url: `${APP_URL}/logo.png`,
        alt: "Chow45 Food Delivery Logo",
      },
    ],
    siteName: "Chow45",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chow45 | Food Delivery in Sagamu & OOU Sagamu Campus",
    description:
      "Fast food delivery in Sagamu and OOU Sagamu campus. Discover campus canteens and get meals delivered straight to you.",
    images: [`${APP_URL}/logo.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-brand-paper text-brand-ink flex flex-col">
        {children}
      </body>
    </html>
  );
}