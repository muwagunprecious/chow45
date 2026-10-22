"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./marketing.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

const faqs = [
  {
    q: "What is Chow45?",
    a: "Chow45 is a modern, fast food delivery marketplace built for students, staff, and residents around OOU Sagamu campus and Sagamu town.",
  },
  {
    q: "How fast is delivery?",
    a: "Most orders from nearby campus vendors and cafeterias arrive within 15 to 30 minutes, delivered right to your hostel, hall, or department.",
  },
  {
    q: "How do I order food?",
    a: "Enter your delivery location or hostel above, choose your favourite meals from verified vendors, and check out securely in a few taps.",
  },
  {
    q: "Can I sell food on Chow45 as a vendor?",
    a: "Yes! If you run a cafeteria, kitchen, or food business around campus, you can sign up as a vendor to receive digital orders and grow your sales.",
  },
  {
    q: "Can I earn money as a dispatch rider?",
    a: "Absolutely. Chow45 is onboarding student and local riders for flexible campus deliveries with transparent per-order payouts.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support seamless online payments via debit cards, bank transfers, and student-friendly wallet balance.",
  },
];

function useReveal() {
  const ref = useRef<HTMLDivElement | HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({
  children,
  delay = false,
  className = "",
}: {
  children: React.ReactNode;
  delay?: boolean;
  className?: string;
}) {
  const ref = useReveal();
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal ${delay ? "delay-100" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export default function MarketingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<"customer" | "vendor" | "rider">("customer");
  const [addressInput, setAddressInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const openModal = (role: "customer" | "vendor" | "rider" = "customer") => {
    setModalRole(role);
    setSubmitted(false);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (addressInput.trim()) {
      window.location.href = `/app?search=${encodeURIComponent(addressInput.trim())}`;
    } else {
      window.location.href = "/app";
    }
  };

  const handleModalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-black flex flex-col font-sans selection:bg-[#00a205] selection:text-white">
      {/* =====================================================================
          NAVIGATION BAR (Minimal, compact, conversion-first)
          ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#fafafa]/90 backdrop-blur-md border-b border-[#e5e7eb] px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="Chow45 Logo"
              className="h-9 w-9 object-contain rounded-full border border-[#e5e7eb] p-0.5 bg-white"
            />
            <span className="font-bold text-xl tracking-tight text-black">
              Chow<span className="text-[#00a205]">45</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-[#374151] hover:text-black transition"
            >
              How it works
            </a>
            <a
              href="#vendors"
              className="text-sm font-medium text-[#374151] hover:text-black transition"
            >
              For vendors
            </a>
            <Link
              href="/rider"
              className="text-sm font-medium text-[#374151] hover:text-black transition"
            >
              For riders
            </Link>
            <a
              href="#faq"
              className="text-sm font-medium text-[#374151] hover:text-black transition"
            >
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="text-sm font-medium text-black px-3 py-2 hover:text-[#00a205] transition"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center bg-black text-white text-sm font-medium px-6 py-2.5 rounded-full hover:bg-neutral-800 transition min-h-[44px]"
            >
              Order Food
            </Link>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex items-center justify-center p-2 rounded-full border border-[#e5e7eb] text-black"
              aria-label="Toggle navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-[#e5e7eb] mt-3 pt-4 pb-3 flex flex-col gap-3">
            <a
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-[#374151] py-1"
            >
              How it works
            </a>
            <a
              href="#vendors"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-[#374151] py-1"
            >
              For vendors
            </a>
            <Link
              href="/rider"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-[#374151] py-1"
            >
              For riders
            </Link>
            <a
              href="#faq"
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium text-[#374151] py-1"
            >
              FAQ
            </a>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/app"
                className="w-full text-center bg-black text-white text-sm font-medium py-3 rounded-full"
              >
                Launch Marketplace App
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          HERO SECTION (Spacious, bold headline, green highlight, pill address)
          ===================================================================== */}
      <main className="flex-1">
        <section className="pt-16 pb-20 md:pt-24 md:pb-32 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content (7 Cols) */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              {/* Pill Location Tag */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#e5e7eb] text-xs font-semibold text-black mb-6">
                <span className="w-2 h-2 rounded-full bg-[#00a205] animate-pulse" />
                <span>OOU Sagamu Campus &amp; Sagamu Town</span>
              </div>

              {/* Display Headline */}
              <h1 className="text-[44px] sm:text-[68px] lg:text-[84px] font-bold text-black tracking-[-2px] sm:tracking-[-3px] lg:tracking-[-4px] leading-[1.04] mb-6">
                Your favourite food,{" "}
                <span className="text-[#00a205]">delivered fast.</span>
              </h1>

              {/* Body Text */}
              <p className="text-[17px] sm:text-[18px] text-[#4b5563] leading-[26px] max-w-xl mb-9">
                Hungry on campus? Order delicious Nigerian meals, quick snacks, and drinks from verified vendors in Sagamu straight to your hostel or desk.
              </p>

              {/* Pill Address / Search Input + Primary CTA */}
              <form
                onSubmit={handleSearchSubmit}
                className="w-full max-w-xl bg-white border border-[#e5e7eb] rounded-full p-2 pl-5 flex items-center gap-3 transition focus-within:border-black focus-within:ring-1 focus-within:ring-black"
              >
                <span className="text-[#00a205] flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="Enter your delivery address or hostel..."
                  className="flex-1 bg-transparent border-none outline-none text-black placeholder:text-[#9ca3af] text-sm sm:text-base font-normal min-w-0"
                />
                <button
                  type="submit"
                  className="bg-black text-white px-7 py-3 rounded-full text-sm sm:text-base font-medium min-h-[48px] hover:bg-neutral-800 transition flex items-center gap-2 flex-shrink-0"
                >
                  <span>Find Food</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </form>

              {/* App Store Download Badges */}
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
                  Get the app:
                </span>
                <button
                  type="button"
                  onClick={() => openModal("customer")}
                  className="inline-flex items-center gap-2.5 bg-black text-white px-5 py-2.5 rounded-full text-xs font-medium hover:bg-neutral-800 transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186c-.378-.445-.61-.994-.61-1.614V3.428c0-.62.232-1.169.61-1.614zm11.3 11.3l2.427-2.427-9.52-5.498 7.093 7.925zm0 1.772l-7.093 7.925 9.52-5.498-2.427-2.427zm1.114-1.114l3.528-2.037c.875-.505.875-1.332 0-1.838l-3.528-2.037-2.022 2.022 2.022 2.053z" />
                  </svg>
                  <span>Google Play</span>
                </button>
                <button
                  type="button"
                  onClick={() => openModal("customer")}
                  className="inline-flex items-center gap-2.5 bg-black text-white px-5 py-2.5 rounded-full text-xs font-medium hover:bg-neutral-800 transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.86c.66-.82 1.11-1.96.99-3.1-.96.04-2.12.64-2.8 1.44-.6.69-1.13 1.83-1 2.94 1.07.08 2.16-.46 2.81-1.28z" />
                  </svg>
                  <span>App Store</span>
                </button>
              </div>
            </div>

            {/* Right Graphic / Food Showcase (5 Cols) */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
                <img
                  src="/app/hero-food-bg.jpg"
                  alt="Delicious Meals on Chow45"
                  className="w-full h-[380px] sm:h-[460px] object-cover"
                />
                {/* Floating pill badge 1: Speed */}
                <div className="absolute top-4 left-4 inline-flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full border border-[#e5e7eb] text-xs font-semibold text-black">
                  <span className="text-[#00a205] flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </span>
                  <span>15–25 min campus delivery</span>
                </div>
                {/* Floating pill badge 2: Popularity */}
                <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-xs font-medium">
                  <span className="text-[#00a205]">★</span>
                  <span>4.9 campus rating</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            HOW IT WORKS SECTION (3 Flat Bordered Cards, 8px radius)
            ===================================================================== */}
        <section id="how-it-works" className="py-20 md:py-28 bg-white border-y border-[#e5e7eb] px-4 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <Reveal className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-black mb-4">
                How it <span className="text-[#00a205]">works</span>
              </h2>
              <p className="text-[17px] text-[#4b5563] leading-relaxed">
                Enjoy hassle-free food delivery in three straightforward steps.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  title: "Set your location",
                  desc: "Choose your campus hostel, lecture hall, or address in Sagamu to see active nearby kitchens.",
                  icon: "location",
                },
                {
                  step: "02",
                  title: "Choose your chow",
                  desc: "Browse authentic dishes, snacks, and drinks from top vendors with real student prices.",
                  icon: "food",
                },
                {
                  step: "03",
                  title: "Rider delivers fast",
                  desc: "Track your food order in real-time as a dedicated rider brings it hot to your doorstep.",
                  icon: "scooter",
                },
              ].map((item, idx) => (
                <Reveal key={item.step} delay={idx > 0}>
                  <div className="h-full bg-[#fafafa] border border-[#e5e7eb] rounded-lg p-6 sm:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-[#00a205] flex-shrink-0">
                          {item.icon === "location" && (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                          )}
                          {item.icon === "food" && (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 11h18" />
                              <path d="M5 11a7 7 0 0 1 14 0" />
                              <path d="M3 15h18" />
                              <path d="M4 19h16" />
                            </svg>
                          )}
                          {item.icon === "scooter" && (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="5.5" cy="17.5" r="3.5" />
                              <circle cx="18.5" cy="17.5" r="3.5" />
                              <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs font-bold text-[#6b7280] tracking-widest uppercase">
                          STEP {item.step}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-black mb-3">
                        {item.title}
                      </h3>
                      <p className="text-sm text-[#4b5563] leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================================
            CAMPUS FAVORITES / CATEGORIES
            ===================================================================== */}
        <section className="py-20 md:py-28 px-4 sm:px-8 bg-[#fafafa]">
          <div className="max-w-7xl mx-auto">
            <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-black mb-3">
                  Campus <span className="text-[#00a205]">favorites</span>
                </h2>
                <p className="text-[17px] text-[#4b5563]">
                  What student tastebuds are craving right now.
                </p>
              </div>
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00a205] hover:underline"
              >
                <span>Explore full menu</span>
                <span>→</span>
              </Link>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  name: "Jollof Rice & Turkey",
                  category: "Campus Classics",
                  price: "From ₦1,800",
                  image: "/app/hero-food-bg.jpg",
                  rating: "4.9",
                },
                {
                  name: "Amala, Gbegiri & Ewedu",
                  category: "Local Delicacies",
                  price: "From ₦1,500",
                  image: "/app/chow45_campus_flyer.jpg",
                  rating: "4.8",
                },
                {
                  name: "Double Beef Shawarma",
                  category: "Grills & Quick Bites",
                  price: "From ₦2,200",
                  image: "/app/chow45_focus_on_school_flyer.jpg",
                  rating: "5.0",
                },
                {
                  name: "Fried Rice & Crispy Chicken",
                  category: "After-Class Fuel",
                  price: "From ₦2,000",
                  image: "/app/chow45_school_hard_flyer.jpg",
                  rating: "4.8",
                },
              ].map((dish, i) => (
                <Reveal key={dish.name} delay={i > 0}>
                  <div className="bg-white border border-[#e5e7eb] rounded-lg overflow-hidden flex flex-col h-full hover:border-black/30 transition">
                    <div className="h-44 w-full bg-[#e5e7eb] relative overflow-hidden">
                      <img
                        src={dish.image}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-black text-xs font-bold px-2 py-1 rounded-full border border-[#e5e7eb] inline-flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#00a205" stroke="#00a205" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span>{dish.rating}</span>
                      </span>
                    </div>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
                          {dish.category}
                        </span>
                        <h4 className="font-bold text-base text-black mt-1 mb-2">
                          {dish.name}
                        </h4>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-[#e5e7eb] mt-2">
                        <span className="text-sm font-bold text-black">{dish.price}</span>
                        <Link
                          href="/app"
                          className="bg-black text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-neutral-800 transition"
                        >
                          Order
                        </Link>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================================
            PARTNER SECTIONS: FOR VENDORS & FOR RIDERS (2 Column Cards)
            ===================================================================== */}
        <section id="vendors" className="py-20 md:py-28 bg-white border-t border-[#e5e7eb] px-4 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Card 1: Vendors */}
              <Reveal>
                <div className="bg-[#fafafa] border border-[#e5e7eb] rounded-lg p-8 sm:p-10 flex flex-col justify-between h-full">
                  <div>
                    <div className="inline-block px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-xs font-semibold text-black mb-5">
                      For Restaurant &amp; Food Vendors
                    </div>
                    <h3 className="text-2xl sm:text-4xl font-bold text-black tracking-tight mb-4">
                      Grow your food business on <span className="text-[#00a205]">Chow45</span>
                    </h3>
                    <p className="text-[16px] text-[#4b5563] leading-relaxed mb-8">
                      Reach hundreds of students and campus residents every single day without the stress of manual phone coordination. Manage your menu and get paid fast.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => openModal("vendor")}
                      className="bg-black text-white px-7 py-3 rounded-full text-sm font-medium hover:bg-neutral-800 transition min-h-[48px]"
                    >
                      Register as Vendor
                    </button>
                    <Link
                      href="/app"
                      className="text-sm font-semibold text-[#00a205] hover:underline"
                    >
                      Vendor dashboard →
                    </Link>
                  </div>
                </div>
              </Reveal>

              {/* Card 2: Riders */}
              <Reveal delay>
                <div id="riders" className="bg-[#fafafa] border border-[#e5e7eb] rounded-lg p-8 sm:p-10 flex flex-col justify-between h-full">
                  <div>
                    <div className="inline-block px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-xs font-semibold text-black mb-5">
                      For Delivery Riders
                    </div>
                    <h3 className="text-2xl sm:text-4xl font-bold text-black tracking-tight mb-4">
                      Deliver and earn on your <span className="text-[#00a205]">schedule</span>
                    </h3>
                    <p className="text-[16px] text-[#4b5563] leading-relaxed mb-8">
                      Earn consistent income delivering meals across campus. Keep 100% of your delivery tips, get live mission updates, and withdraw your funds smoothly.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Link
                      href="/rider"
                      className="bg-black text-white px-7 py-3 rounded-full text-sm font-medium hover:bg-neutral-800 transition min-h-[48px] inline-flex items-center justify-center"
                    >
                      Rider Portal
                    </Link>
                    <button
                      type="button"
                      onClick={() => openModal("rider")}
                      className="text-sm font-semibold text-[#00a205] hover:underline"
                    >
                      Apply to ride →
                    </button>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* =====================================================================
            FAQ ACCORDION
            ===================================================================== */}
        <section id="faq" className="py-20 md:py-28 px-4 sm:px-8 bg-[#fafafa] border-t border-[#e5e7eb]">
          <div className="max-w-4xl mx-auto">
            <Reveal className="text-center mb-14">
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-black mb-3">
                Frequently asked <span className="text-[#00a205]">questions</span>
              </h2>
              <p className="text-[17px] text-[#4b5563]">
                Got questions? We have answers.
              </p>
            </Reveal>

            <div className="flex flex-col gap-3">
              {faqs.map((faq, idx) => (
                <Reveal key={faq.q} delay={idx > 2}>
                  <details
                    className="group bg-white border border-[#e5e7eb] rounded-lg p-5 sm:p-6 transition open:border-black/30"
                    open={idx === 0}
                  >
                    <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-base sm:text-lg text-black marker:content-none [&::-webkit-details-marker]:hidden">
                      <span>{faq.q}</span>
                      <span className="text-xl font-bold text-[#00a205] transition-transform duration-200 group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-3.5 text-sm sm:text-base text-[#4b5563] leading-relaxed">
                      {faq.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================================
            BOTTOM CONVERSION CTA BANNER
            ===================================================================== */}
        <section className="py-20 md:py-28 px-4 sm:px-8 bg-black text-white text-center">
          <div className="max-w-3xl mx-auto">
            <Reveal>
              <h2 className="text-3xl sm:text-6xl font-bold tracking-tight mb-6">
                Ready to taste the <span className="text-[#00a205]">difference?</span>
              </h2>
              <p className="text-base sm:text-lg text-neutral-300 max-w-xl mx-auto mb-9">
                Join students and campus residents in Sagamu who get their daily food delivered effortlessly with Chow45.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/app"
                  className="bg-[#00a205] text-white px-8 py-3.5 rounded-full text-base font-semibold hover:bg-[#008704] transition min-h-[48px] inline-flex items-center justify-center"
                >
                  Order Food Now
                </Link>
                <button
                  type="button"
                  onClick={() => openModal("customer")}
                  className="bg-white text-black px-8 py-3.5 rounded-full text-base font-semibold hover:bg-neutral-100 transition min-h-[48px]"
                >
                  Join Waitlist
                </button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* =====================================================================
          FOOTER (Bright, clean, minimal 1px border)
          ===================================================================== */}
      <footer className="bg-white border-t border-[#e5e7eb] px-4 sm:px-8 py-14 text-sm text-[#4b5563]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Col 1 */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img
                src="/logo.png"
                alt="Chow45 Logo"
                className="h-8 w-8 object-contain rounded-full border border-[#e5e7eb] p-0.5"
              />
              <span className="font-bold text-lg text-black">
                Chow<span className="text-[#00a205]">45</span>
              </span>
            </Link>
            <p className="text-xs text-[#6b7280] leading-relaxed">
              Fast, reliable food delivery marketplace built for OOU Sagamu campus and surrounding communities.
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-black mb-3">Explore</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/app" className="hover:text-black transition">Marketplace</Link></li>
              <li><a href="#how-it-works" className="hover:text-black transition">How It Works</a></li>
              <li><a href="#faq" className="hover:text-black transition">FAQs</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-black mb-3">Partners</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#vendors" onClick={() => openModal("vendor")} className="hover:text-black transition">For Vendors</a></li>
              <li><Link href="/rider" className="hover:text-black transition">Rider Portal</Link></li>
              <li><button onClick={() => openModal("rider")} className="hover:text-black transition text-left">Apply as Rider</button></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-black mb-3">Contact</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="mailto:hello@chow45.com" className="hover:text-black transition">hello@chow45.com</a></li>
              <li><span>Sagamu, Ogun State, Nigeria</span></li>
              <li className="pt-2 text-[#00a205] font-semibold">● Operating Daily</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-[#e5e7eb] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6b7280]">
          <p>© {new Date().getFullYear()} Chow45. All rights reserved.</p>
          <p>Built with care for OOU Sagamu campus community.</p>
        </div>
      </footer>

      {/* =====================================================================
          ACTION MODAL (Waitlist / Fast Application)
          ===================================================================== */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={closeModal}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
          />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl border border-[#e5e7eb] p-6 sm:p-8 animate-modal-in shadow-xl">
            <button
              onClick={closeModal}
              aria-label="Close modal"
              className="absolute top-4 right-4 text-[#6b7280] hover:text-black p-2 rounded-full hover:bg-[#fafafa]"
            >
              ✕
            </button>

            {!submitted ? (
              <>
                <div className="mb-6">
                  <div className="inline-block px-3 py-1 rounded-full bg-[#e6f6e6] text-[#00a205] text-xs font-semibold mb-2">
                    {modalRole === "vendor" ? "Vendor Partner" : modalRole === "rider" ? "Rider Network" : "Early Access"}
                  </div>
                  <h3 className="text-2xl font-bold text-black tracking-tight">
                    {modalRole === "vendor"
                      ? "Register your Food Store"
                      : modalRole === "rider"
                        ? "Join the Dispatch Team"
                        : "Join the Chow45 Waitlist"}
                  </h3>
                  <p className="text-sm text-[#4b5563] mt-1">
                    Fill in your details below and we&rsquo;ll get in touch right away.
                  </p>
                </div>

                <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                      Full Name *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Tolani Adeleke"
                      className="w-full bg-[#fafafa] border border-[#e5e7eb] rounded-lg px-4 py-3 text-sm text-black outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                      Phone Number (WhatsApp) *
                    </label>
                    <input
                      required
                      type="tel"
                      placeholder="080 1234 5678"
                      className="w-full bg-[#fafafa] border border-[#e5e7eb] rounded-lg px-4 py-3 text-sm text-black outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                      Email Address *
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="name@example.com"
                      className="w-full bg-[#fafafa] border border-[#e5e7eb] rounded-lg px-4 py-3 text-sm text-black outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                      Hostel / Campus Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sagamu OSUTH Campus / Main Gate"
                      className="w-full bg-[#fafafa] border border-[#e5e7eb] rounded-lg px-4 py-3 text-sm text-black outline-none focus:border-black"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="w-full sm:w-1/3 py-3 rounded-full border border-[#e5e7eb] text-sm font-semibold text-black hover:bg-[#fafafa]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-2/3 py-3 rounded-full bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition min-h-[48px]"
                    > 
                      Submit Details
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-[#e6f6e6] text-[#00a205] text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold text-black mb-2">
                  You&rsquo;re all set!
                </h4>
                <p className="text-sm text-[#4b5563] max-w-sm mx-auto mb-6">
                  Thanks for connecting with Chow45. Our campus operations team will reach out to you via WhatsApp / email.
                </p>
                <button
                  onClick={closeModal}
                  className="bg-black text-white px-7 py-3 rounded-full text-sm font-semibold hover:bg-neutral-800 transition"
                >
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}