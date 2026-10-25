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

  // Campus modal prompt state
  const [campusPromptOpen, setCampusPromptOpen] = useState(false);
  const [campusStep, setCampusStep] = useState<1 | 2>(1);
  const [chosenCampus, setChosenCampus] = useState<"sagamu" | "ibogun">("sagamu");
  const [campusAddress, setCampusAddress] = useState("");
  const [campusError, setCampusError] = useState("");
  const [detectingGps, setDetectingGps] = useState(false);
  const [detectedGps, setDetectedGps] = useState<{ lat: number; lng: number; street: string; fullAddress: string } | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<Array<{ text: string; sub: string; placeId?: string; lat?: number; lng?: number; isCampus?: boolean }>>([]);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [isSearchingAutocomplete, setIsSearchingAutocomplete] = useState(false);
  const autocompleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const CAMPUS_LANDMARKS: Record<"sagamu" | "ibogun", Array<{ name: string; sub: string; lat: number; lng: number }>> = {
    sagamu: [
      { name: "Clinical Hostel", sub: "OOU Medical Campus, Sagamu", lat: 6.8420, lng: 3.6480 },
      { name: "OSUTH Main Gate", sub: "OOU Teaching Hospital, Hospital Rd", lat: 6.8400, lng: 3.6500 },
      { name: "Hospital Road", sub: "Sagamu, Ogun State", lat: 6.8390, lng: 3.6520 },
      { name: "OOU Medical Campus", sub: "Faculty of Clinical Sciences", lat: 6.8410, lng: 3.6510 },
      { name: "Ewusi Street", sub: "Makun, Sagamu", lat: 6.8450, lng: 3.6470 },
      { name: "Sabo Market", sub: "Sabo, Sagamu", lat: 6.8350, lng: 3.6550 },
      { name: "GRA Sagamu", sub: "Government Reserved Area, Sagamu", lat: 6.8480, lng: 3.6420 },
    ],
    ibogun: [
      { name: "OGITECH Main Gate", sub: "Ogun State Institute of Technology, Ibogun", lat: 6.7210, lng: 3.3910 },
      { name: "Student Village", sub: "Student Village Hostels, Ibogun", lat: 6.7230, lng: 3.3890 },
      { name: "OOU Ibogun Campus Gate", sub: "College of Engineering & Tech, Ibogun", lat: 6.7220, lng: 3.3900 },
      { name: "Campus Hostels", sub: "Ibogun Campus Residential Lodges", lat: 6.7200, lng: 3.3920 },
      { name: "Ibogun Market Road", sub: "Ibogun Town, Ogun State", lat: 6.7190, lng: 3.3940 },
    ],
  };

  // Check if visitor has selected a campus; if not, open campus popup immediately
  useEffect(() => {
    const savedCampus = localStorage.getItem("chow45_selected_campus");
    if (!savedCampus) {
      setCampusPromptOpen(true);
    }
  }, []);

  // If a vendor visits chow45.app, automatically redirect directly to the vendor dashboard
  useEffect(() => {
    try {
      const raw = localStorage.getItem("chow45_auth_session_v1") || localStorage.getItem("chow45_user");
      if (raw) {
        const sess = JSON.parse(raw);
        const role = String(sess?.user?.role || sess?.role || "").toLowerCase();
        if (role === "vendor") {
          window.location.replace("/vendor");
          return;
        }
      }
    } catch {}

    fetch("/api/auth/get-session", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.user) {
          const role = String(data.role || data.user.role || "").toLowerCase();
          if (role === "vendor") {
            window.location.replace("/vendor");
          }
        }
      })
      .catch(() => {});
  }, []);

  const openModal = (role: "customer" | "vendor" | "rider" = "customer") => {
    setModalRole(role);
    setSubmitted(false);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSelectCampus = (campus: "sagamu" | "ibogun") => {
    setChosenCampus(campus);
    setCampusError("");
    setDetectedGps(null);
    setAutocompleteOpen(false);
    setCampusStep(2);
  };

  const handleDetectGps = () => {
    setCampusError("");
    if (!navigator.geolocation) {
      setCampusError("Geolocation is not supported by your browser. Please type your hostel address below.");
      return;
    }

    setDetectingGps(true);

    const onCoordsSuccess = async (lat: number, lng: number) => {
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          const campusName = chosenCampus === "ibogun" ? "Ibogun" : "Sagamu";
          const street = data.street || (data.address ? data.address.split(",")[0] : `Detected Location (${campusName})`);
          const fullAddress = data.address || `${street}, ${campusName}, Ogun State`;
          setDetectedGps({ lat, lng, street, fullAddress });
          setSelectedCoords({ lat, lng });
        } else {
          throw new Error("Reverse geocoding failed");
        }
      } catch {
        const campusName = chosenCampus === "ibogun" ? "Ibogun" : "Sagamu";
        const fallbackStreet = `My Location (${campusName})`;
        setDetectedGps({ lat, lng, street: fallbackStreet, fullAddress: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}` });
        setSelectedCoords({ lat, lng });
      } finally {
        setDetectingGps(false);
      }
    };

    const onGeoError = (err: GeolocationPositionError) => {
      setDetectingGps(false);
      let msg = "Could not access location. Please type your hostel or address below.";
      if (err.code === 1) {
        msg = "🔒 Location access was denied by your browser. Please allow location in your address bar, or type your hostel below.";
      } else if (err.code === 2) {
        msg = "📡 GPS signal unavailable on your device. Please type your hostel or street name below.";
      } else if (err.code === 3) {
        msg = "⏱️ Location request timed out. Please enter your hostel or street name below.";
      }
      setCampusError(msg);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => onCoordsSuccess(pos.coords.latitude, pos.coords.longitude),
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => onCoordsSuccess(pos.coords.latitude, pos.coords.longitude),
          onGeoError,
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  const handleConfirmDetectedGps = () => {
    if (!detectedGps) return;
    const finalStreet = detectedGps.street;
    setCampusAddress(finalStreet);
    handleFinalCampusSubmit(finalStreet, detectedGps.lat, detectedGps.lng);
  };

  const handleRejectDetectedGps = () => {
    if (detectedGps) {
      setCampusAddress(detectedGps.street);
    }
    setDetectedGps(null);
  };

  const handleAddressInputChange = (val: string) => {
    setCampusAddress(val);
    setCampusError("");
    if (val.trim().length < 2) {
      setAutocompleteSuggestions([]);
      setAutocompleteOpen(false);
      return;
    }

    if (autocompleteTimerRef.current) clearTimeout(autocompleteTimerRef.current);
    setIsSearchingAutocomplete(true);

    autocompleteTimerRef.current = setTimeout(async () => {
      const q = val.trim().toLowerCase();
      const campus = chosenCampus;
      const localMatches = (CAMPUS_LANDMARKS[campus] || [])
        .filter((l) => l.name.toLowerCase().includes(q) || l.sub.toLowerCase().includes(q))
        .map((l) => ({ text: l.name, sub: l.sub, lat: l.lat, lng: l.lng, isCampus: true }));

      let googleMatches: Array<{ text: string; sub: string; placeId?: string; isCampus: boolean }> = [];
      try {
        const campusContext = campus === "ibogun" ? "Ibogun" : "Sagamu";
        const res = await fetch(`/api/geocode/autocomplete?q=${encodeURIComponent(val + " " + campusContext)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            googleMatches = data.results.map((r: any) => ({
              text: r.text || r.placeName.split(",")[0],
              sub: r.placeName,
              placeId: r.placeId,
              isCampus: false,
            }));
          }
        }
      } catch {}

      setIsSearchingAutocomplete(false);
      const seen = new Set<string>();
      const combined: Array<{ text: string; sub: string; placeId?: string; lat?: number; lng?: number; isCampus?: boolean }> = [];
      [...localMatches, ...googleMatches].forEach((item) => {
        const k = item.text.toLowerCase().trim();
        if (!seen.has(k)) {
          seen.add(k);
          combined.push(item);
        }
      });

      setAutocompleteSuggestions(combined.slice(0, 6));
      setAutocompleteOpen(combined.length > 0);
    }, 220);
  };

  const handleSelectAutocompleteSuggestion = async (s: { text: string; sub: string; placeId?: string; lat?: number; lng?: number }) => {
    setCampusAddress(s.text);
    setAutocompleteOpen(false);

    if (s.lat && s.lng) {
      setSelectedCoords({ lat: s.lat, lng: s.lng });
    } else if (s.placeId) {
      try {
        const res = await fetch(`/api/geocode/details?placeId=${encodeURIComponent(s.placeId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lat && data.lng) {
            setSelectedCoords({ lat: data.lat, lng: data.lng });
          }
        }
      } catch {}
    }
  };

  const handleFinalCampusSubmit = (addr: string, latOverride?: number, lngOverride?: number) => {
    const campus = chosenCampus;
    const campusName = campus === "ibogun" ? "Ibogun" : "Sagamu";
    const lat = latOverride ?? (selectedCoords?.lat || (campus === "ibogun" ? 6.7200 : 6.8400));
    const lng = lngOverride ?? (selectedCoords?.lng || (campus === "ibogun" ? 3.3900 : 3.6500));

    localStorage.setItem("chow45_selected_campus", campus);

    const locObj = {
      latitude: lat,
      longitude: lng,
      accuracy: null,
      timestamp: Date.now(),
      address: addr.trim(),
      locality: campusName,
      lga: campus === "ibogun" ? "Ewekoro/Ifo" : "Sagamu",
      state: "Ogun",
      country: "Nigeria",
      placeId: null,
      formattedAddress: `${addr.trim()}, ${campusName}, Ogun State`,
      label: "Campus",
      deliveryInstructions: "",
    };

    try {
      const raw = localStorage.getItem("chow45_marketplace_state_v2");
      const st = raw ? JSON.parse(raw) : {};
      st.selectedCampus = campus;
      st.selectedLocation = locObj;
      localStorage.setItem("chow45_marketplace_state_v2", JSON.stringify(st));
    } catch {}

    setCampusPromptOpen(false);
    window.location.href = "/app";
  };

  const handleCampusConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!campusAddress.trim()) {
      setCampusError("Please enter your hostel name or delivery address.");
      return;
    }
    handleFinalCampusSubmit(campusAddress);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const savedCampus = localStorage.getItem("chow45_selected_campus");
    if (!savedCampus) {
      if (addressInput.trim()) setCampusAddress(addressInput.trim());
      setCampusPromptOpen(true);
      return;
    }
    if (addressInput.trim()) {
      window.location.href = `/app?search=${encodeURIComponent(addressInput.trim())}`;
    } else {
      window.location.href = "/app";
    }
  };

  const handleModalSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const savedCampus = localStorage.getItem("chow45_selected_campus");
    if (!savedCampus) {
      if (addressInput.trim()) setCampusAddress(addressInput.trim());
      setCampusPromptOpen(true);
      return;
    }
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
                  <span className="text-[#00a205]">⚡</span>
                  <span>15–25 min campus delivery</span>
                </div>
                {/* Floating pill badge 2: Popularity */}
                <div className="absolute bottom-4 right-4 inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-xs font-medium">
                  <span className="text-[#00a205]">🛵</span>
                  <span>Fast campus delivery</span>
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
                  icon: "📍",
                },
                {
                  step: "02",
                  title: "Choose your chow",
                  desc: "Browse authentic dishes, snacks, and drinks from top vendors with real student prices.",
                  icon: "🍲",
                },
                {
                  step: "03",
                  title: "Rider delivers fast",
                  desc: "Track your food order in real-time as a dedicated rider brings it hot to your doorstep.",
                  icon: "🛵",
                },
              ].map((item, idx) => (
                <Reveal key={item.step} delay={idx > 0}>
                  <div className="h-full bg-[#fafafa] border border-[#e5e7eb] rounded-lg p-6 sm:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-3xl">{item.icon}</span>
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
                      href="/vendor"
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
                <Link
                  href="/vendor"
                  className="bg-white text-black px-8 py-3.5 rounded-full text-base font-semibold hover:bg-neutral-100 transition min-h-[48px] inline-flex items-center justify-center border border-[#e5e7eb]"
                >
                  Become a Vendor
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* =====================================================================
          FOOTER (Bright, clean, minimal 1px border)
          ===================================================================== */}
      <footer className="bg-white border-t border-[#e5e7eb] px-4 sm:px-8 py-14 text-sm text-[#4b5563]">
        {/* Partner Routing Cards */}
        <div className="max-w-7xl mx-auto mb-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#fcfaf7] border border-[#ede7e0] rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-[#00a205] transition-all">
            <div>
              <span className="text-3xl mb-2 block">🍳</span>
              <h3 className="font-extrabold text-lg text-black mb-1">Become a Vendor</h3>
              <p className="text-xs text-[#6b7280] mb-4 leading-relaxed">
                Run a cafeteria, restaurant, bakery, or snack stall around campus? Partner with Chow45 to reach students across Sagamu &amp; Ibogun campuses with digital orders.
              </p>
            </div>
            <div>
              <Link
                href="/vendor"
                className="inline-flex items-center gap-2 bg-[#00a205] hover:bg-[#008751] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm"
              >
                <span>Become a Vendor</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div className="bg-[#fcfaf7] border border-[#ede7e0] rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-[#00a205] transition-all">
            <div>
              <span className="text-3xl mb-2 block">🛵</span>
              <h3 className="font-extrabold text-lg text-black mb-1">Become a Rider</h3>
              <p className="text-xs text-[#6b7280] mb-4 leading-relaxed">
                Have a motorcycle, scooter, bicycle, or delivery vehicle? Join the verified Chow45 campus delivery fleet for flexible hours and direct ₦200/km payouts.
              </p>
            </div>
            <div>
              <Link
                href="/rider/register"
                className="inline-flex items-center gap-2 bg-[#00a205] hover:bg-[#008751] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm"
              >
                <span>Become a Rider</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
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
              <li><Link href="/vendor" className="font-bold text-[#00a205] hover:underline transition">Become a Vendor</Link></li>
              <li><Link href="/rider" className="hover:text-black transition">Rider Portal</Link></li>
              <li><Link href="/rider/register" className="font-bold text-[#00a205] hover:underline transition">Become a Rider</Link></li>
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
      {/* =====================================================================
          CAMPUS & LOCATION PROMPT POPUP (Immediate on arrival if not set)
          ===================================================================== */}
      {campusPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#e5e7eb] shadow-2xl relative">
            {campusStep === 1 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F8EE] border border-[#C7EDD4] text-xs font-bold text-[#008704]">
                    <span className="w-2 h-2 rounded-full bg-[#00a205] animate-pulse" />
                    Select Your Campus
                  </div>
                </div>

                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mb-2 tracking-tight">
                  Which campus are you in?
                </h3>
                <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
                  We show verified vendors and instant delivery directly for your campus.
                </p>

                <div className="flex flex-col gap-3">
                  {/* Sagamu Campus Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectCampus("sagamu")}
                    className="flex items-start gap-4 text-left p-4 rounded-2xl border-2 border-[#e2e8f0] hover:border-[#00a205] bg-[#fafafa] hover:bg-white hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#E8F8EE] text-[#00a205] text-2xl flex items-center justify-center flex-shrink-0">
                      🏥
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-base text-[#0F172A]">Sagamu Campus</span>
                        <span className="text-[11px] font-bold text-[#008704] bg-[#E8F8EE] px-2.5 py-0.5 rounded-full">
                          Verified Kitchens
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#334155] mb-0.5">
                        OOU Medical Campus &amp; OSUTH
                      </div>
                      <div className="text-xs text-[#64748B]">
                        Hospital Road, Ewusi, Sabo, GRA &amp; Sagamu Town
                      </div>
                    </div>
                    <span className="text-[#94a3b8] group-hover:text-[#00a205] text-xl self-center transition-colors">
                      →
                    </span>
                  </button>

                  {/* Ibogun Campus Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectCampus("ibogun")}
                    className="flex items-start gap-4 text-left p-4 rounded-2xl border-2 border-[#e2e8f0] hover:border-[#2563EB] bg-[#fafafa] hover:bg-white hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] text-2xl flex items-center justify-center flex-shrink-0">
                      🏫
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-base text-[#0F172A]">Ibogun Campus</span>
                        <span className="text-[11px] font-bold text-[#1E40AF] bg-[#DBEAFE] px-2.5 py-0.5 rounded-full">
                          OGITECH / Ibogun
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#334155] mb-0.5">
                        OGITECH &amp; OOU Ibogun Campus
                      </div>
                      <div className="text-xs text-[#64748B]">
                        Student Village, Campus Hostels &amp; Ibogun Market
                      </div>
                    </div>
                    <span className="text-[#94a3b8] group-hover:text-[#2563EB] text-xl self-center transition-colors">
                      →
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCampusStep(1)}
                    className="text-xs font-bold text-[#64748B] hover:text-black flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Campus Choice
                  </button>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      chosenCampus === "ibogun"
                        ? "bg-[#DBEAFE] text-[#1E40AF]"
                        : "bg-[#E8F8EE] text-[#008704]"
                    }`}
                  >
                    {chosenCampus === "ibogun" ? "Ibogun Campus" : "Sagamu Campus"}
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mb-1 tracking-tight">
                  Where should we deliver?
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] mb-5 leading-relaxed">
                  Enter your hostel, lodge, department or room address in {chosenCampus === "ibogun" ? "Ibogun" : "Sagamu"}.
                </p>

                {/* GPS Detect Button */}
                <div className="mb-3.5">
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    disabled={detectingGps}
                    className="w-full h-11 bg-[#F8FAFC] border-2 border-dashed border-[#00a205] hover:bg-[#E8F8EE] text-[#008704] rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {detectingGps ? (
                      <span>⏳ Detecting &amp; checking Google Maps...</span>
                    ) : (
                      <span>📍 Detect My Street via Google Maps</span>
                    )}
                  </button>
                </div>

                {/* Detected Location Confirmation Card */}
                {detectedGps && (
                  <div className="mb-4 p-4 bg-[#F0FDF4] border-2 border-[#86EFAC] rounded-2xl shadow-sm">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#166534] mb-1 flex items-center gap-1.5">
                      <span>📍</span> Street detected on Google Maps
                    </div>
                    <div className="text-base sm:text-lg font-extrabold text-[#0F172A] mb-0.5">
                      {detectedGps.street}
                    </div>
                    <div className="text-xs text-[#475569] mb-3 leading-snug">
                      {detectedGps.fullAddress}
                    </div>
                    <div className="text-xs font-bold text-[#1E293B] mb-2.5">
                      Is this your correct delivery location?
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmDetectedGps}
                        className="flex-1 py-2.5 bg-[#00a205] text-white text-xs font-bold rounded-lg hover:bg-[#008704] transition cursor-pointer"
                      >
                        Yes, Deliver Here ✓
                      </button>
                      <button
                        type="button"
                        onClick={handleRejectDetectedGps}
                        className="px-4 py-2.5 bg-white border border-[#CBD5E1] text-[#475569] text-xs font-bold rounded-lg hover:bg-[#f8fafc] transition cursor-pointer"
                      >
                        No, Change ✎
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleCampusConfirm}>
                  {/* Address Input with Live Suggestions Dropdown */}
                  <div className="mb-4 relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#475569]">
                        Hostel / Room / Street Address
                      </label>
                      {isSearchingAutocomplete && (
                        <span className="text-[11px] font-bold text-[#008704] animate-pulse">
                          Searching Google Maps...
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={campusAddress}
                      onChange={(e) => handleAddressInputChange(e.target.value)}
                      onFocus={() => {
                        if (campusAddress.trim().length >= 2 && autocompleteSuggestions.length > 0) {
                          setAutocompleteOpen(true);
                        }
                      }}
                      placeholder={
                        chosenCampus === "ibogun"
                          ? "e.g. OGITECH Main Gate, Student Village, Room 3"
                          : "e.g. Clinical Hostel, OSUTH Gate, Room 14"
                      }
                      className="w-full bg-[#f8fafc] border-2 border-[#cbd5e1] rounded-xl px-4 py-3 text-sm font-medium text-black outline-none focus:border-[#00a205] transition-colors"
                      autoFocus
                      autoComplete="off"
                    />

                    {/* Autocomplete Dropdown */}
                    {autocompleteOpen && autocompleteSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-[#cbd5e1] rounded-xl shadow-xl max-h-56 overflow-y-auto z-50">
                        {autocompleteSuggestions.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectAutocompleteSuggestion(item)}
                            className="p-3 border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer flex items-center gap-2.5 transition"
                          >
                            <span className="text-base flex-shrink-0">
                              {item.isCampus ? (chosenCampus === "ibogun" ? "🏫" : "🏥") : "📍"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                                {item.text}
                              </div>
                              <div className="text-[11px] text-[#64748B] truncate">
                                {item.sub}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preset chips */}
                  <div className="mb-4">
                    <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">
                      Popular Campus Spots:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(chosenCampus === "ibogun"
                        ? ["OGITECH Main Gate", "Student Village", "Campus Hostels", "Ibogun Market Road"]
                        : ["OSUTH Gate", "Clinical Hostel", "Hospital Road", "OOU Med Campus", "Ewusi Street"]
                      ).map((spot) => (
                        <button
                          key={spot}
                          type="button"
                          onClick={() => {
                            setCampusAddress(spot);
                            setCampusError("");
                            setAutocompleteOpen(false);
                            const landmark = (CAMPUS_LANDMARKS[chosenCampus] || []).find((l) => l.name === spot);
                            if (landmark) setSelectedCoords({ lat: landmark.lat, lng: landmark.lng });
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                            campusAddress === spot
                              ? "bg-[#E8F8EE] border-[#00a205] text-[#008704] font-bold"
                              : "bg-[#F8FAFC] border-[#cbd5e1] text-[#334155] font-semibold hover:border-black"
                          }`}
                        >
                          {spot}
                        </button>
                      ))}
                    </div>
                  </div>

                  {campusError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                      {campusError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-[#00a205] text-white font-extrabold text-sm sm:text-base hover:bg-[#008704] transition-all shadow-lg shadow-[#00a205]/20 cursor-pointer min-h-[48px]"
                  >
                    Confirm &amp; Explore Food 🚀
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

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
                      : "Order on Chow45"}
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
                  ✓
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