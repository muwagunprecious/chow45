import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} antialiased`}
    >
      <body suppressHydrationWarning className="min-h-screen bg-brand-paper text-brand-ink flex flex-col">
        {children}
      </body>
    </html>
  );
}