'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  location: string;
  rating: number;
  tripsCount: number;
  avatar: string;
  online: boolean;
  currentLat: number | null;
  currentLng: number | null;
}

interface ActiveMission {
  id: string;
  storeName: string;
  storeAddress: string;
  deliveryAddress: string;
  status: string;
  total: number;
  deliveryFee: number;
  deliveryPin?: string;
  riderName?: string;
  riderId?: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
}

const CAMPUSES = [
  { id: 'all', label: 'All Campus Hubs' },
  { id: 'sagamu', label: 'OOU Sagamu Campus' },
  { id: 'ibogun', label: 'Ibogun Campus' },
  { id: 'alimosho', label: 'Alimosho / Lagos' },
  { id: 'ago-iwoye', label: 'Ago-Iwoye Main' },
];

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [orders, setOrders] = useState<ActiveMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [activeTab, setActiveTab] = useState<'fleet' | 'missions' | 'apply'>('fleet');

  // Application form state
  const [appName, setAppName] = useState('');
  const [appPhone, setAppPhone] = useState('');
  const [appVehicle, setAppVehicle] = useState('Bajaj Boxer 150');
  const [appPlate, setAppPlate] = useState('');
  const [appLocation, setAppLocation] = useState('sagamu');
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appSuccess, setAppSuccess] = useState(false);

  // Status toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Load riders and active missions
  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Fetch all riders
      const ridersRes = await fetch('/api/riders?all=true');
      if (ridersRes.ok) {
        const ridersData = await ridersRes.json();
        if (Array.isArray(ridersData.riders)) {
          setRiders(ridersData.riders);
        }
      }

      // 2. Fetch active missions from bootstrap
      const bootRes = await fetch('/api/bootstrap');
      if (bootRes.ok) {
        const bootData = await bootRes.json();
        if (Array.isArray(bootData.orders)) {
          const activeOrders = bootData.orders.filter((o: any) =>
            ['PAID', 'RESTAURANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_HEADING_TO_STORE', 'RIDER_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'RIDER_NEARBY'].includes(o.status)
          );
          setOrders(activeOrders.map((o: any) => ({
            id: o.id,
            storeName: o.storeName || 'Campus Food Spot',
            storeAddress: o.storeAddress || 'Main Food Hub',
            deliveryAddress: o.deliveryAddress || o.address || 'Campus Hostel / Delivery Point',
            status: o.status,
            total: o.total || 0,
            deliveryFee: o.deliveryFee || 600,
            deliveryPin: o.deliveryPin || '4521',
            riderName: o.riderName || (o.riderId ? 'Assigned Rider' : undefined),
            riderId: o.riderId,
            items: Array.isArray(o.items) ? o.items : [],
            createdAt: o.createdAt || new Date().toISOString(),
          })));
        }
      }
    } catch (err) {
      console.error('[riders] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered riders
  const filteredRiders = useMemo(() => {
    return riders.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        (r.location && r.location.toLowerCase().includes(q));

      const matchesLocation =
        selectedLocation === 'all' ||
        (r.location && r.location.toLowerCase().includes(selectedLocation.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'online' && r.online) ||
        (statusFilter === 'offline' && !r.online);

      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [riders, searchQuery, selectedLocation, statusFilter]);

  // Toggle rider online status
  const handleToggleOnline = async (rider: Rider) => {
    try {
      setTogglingId(rider.id);
      const newStatus = !rider.online;

      setRiders((prev) =>
        prev.map((r) => (r.id === rider.id ? { ...r, online: newStatus } : r))
      );

      const res = await fetch(`/api/riders/${rider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: newStatus, isAvailable: newStatus }),
      });

      if (!res.ok) {
        setRiders((prev) =>
          prev.map((r) => (r.id === rider.id ? { ...r, online: !newStatus } : r))
        );
      }
    } catch (err) {
      console.error('Failed to toggle rider status:', err);
      setRiders((prev) =>
        prev.map((r) => (r.id === rider.id ? { ...r, online: !rider.online } : r))
      );
    } finally {
      setTogglingId(null);
    }
  };

  // Submit new rider registration
  const handleRiderApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName || !appPhone) return;

    try {
      setAppSubmitting(true);
      const vehicleDesc = `${appVehicle} (${appPlate || 'Plate pending'})`;
      const newRider: Rider = {
        id: `rider-${Date.now().toString(36)}`,
        name: appName,
        phone: appPhone,
        vehicle: vehicleDesc,
        location: appLocation,
        rating: 5.0,
        tripsCount: 0,
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        online: true,
        currentLat: null,
        currentLng: null,
      };

      setRiders((prev) => [newRider, ...prev]);
      setAppSuccess(true);
      setAppName('');
      setAppPhone('');
      setAppPlate('');
      setTimeout(() => {
        setAppSuccess(false);
        setActiveTab('fleet');
      }, 2000);
    } catch (err) {
      console.error('Application failed:', err);
    } finally {
      setAppSubmitting(false);
    }
  };

  const onlineCount = riders.filter((r) => r.online).length;
  const totalTrips = riders.reduce((sum, r) => sum + (r.tripsCount || 0), 0);

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink selection:bg-brand-green-light selection:text-brand-green font-display">
      {/* 1. FLOATING BRANDED CAPSULE HEADER (Matching Landing Page) */}
      <header className="fixed inset-x-0 top-[18px] z-50 pointer-events-none">
        <nav
          aria-label="Riders fleet navigation"
          className="mx-auto flex w-[min(1200px,calc(100%-32px))] items-center justify-between gap-3"
        >
          {/* Logo & Campus Pill */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            <Link
              href="/"
              aria-label="Chow45 home"
              className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 shadow-[0_4px_16px_rgba(12,81,63,0.12)] border border-brand-green/20 transition hover:-translate-y-0.5"
            >
              <img src="/logo.png" alt="Chow45 Logo" className="h-8 w-auto object-contain" />
            </Link>

            <div className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-brand-green/[0.14] bg-white px-3.5 py-2 text-[13px] font-bold text-brand-ink shadow-[0_4px_14px_rgba(0,0,0,0.05)]">
              <span className="text-sm leading-none">🇳🇬</span>
              <span className="font-extrabold">NG</span>
              <span className="ml-0.5 rounded-full bg-brand-green-light px-1.5 py-0.5 text-[10px] font-extrabold text-brand-green">
                OOU Sagamu
              </span>
            </div>

            <div className="hidden min-[640px]:inline-flex items-center gap-1.5 rounded-full bg-brand-green/[0.08] border border-brand-green/[0.14] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-brand-green">
              <span className="h-2 w-2 rounded-full bg-brand-orange animate-pulse" />
              Live Fleet Active
            </div>
          </div>

          {/* Desktop Center Links */}
          <div className="pointer-events-auto hidden items-center gap-6 rounded-full border-[1.5px] border-brand-green/[0.14] bg-white px-7 py-2.5 shadow-[0_8px_25px_rgba(0,0,0,0.06)] min-[1025px]:flex">
            <Link href="/app" className="text-sm font-semibold text-brand-ink transition hover:text-brand-green">
              Marketplace App
            </Link>
            <Link href="/rider" className="text-sm font-semibold text-brand-ink transition hover:text-brand-green">
              Rider Console
            </Link>
            <Link href="/vendor" className="text-sm font-semibold text-brand-ink transition hover:text-brand-green">
              Vendor Hub
            </Link>
            <Link href="/" className="text-sm font-extrabold text-brand-green">
              About Chow45 ↗
            </Link>
          </div>

          {/* Action Button */}
          <div className="pointer-events-auto flex items-center gap-2.5">
            <Link
              href="/rider"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-ink px-5 py-2.5 text-xs min-[481px]:text-sm font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:bg-[#252522]"
            >
              <span>📲</span> Open Driver View <span>↗</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* 2. HERO SECTION (Cream + Landing Page Design) */}
      <section className="relative overflow-hidden rounded-b-[28px] border-b-2 border-brand-green bg-brand-cream pt-[105px] min-[769px]:pt-[130px] min-[769px]:rounded-b-[34px] pb-10">
        <div className="mx-auto w-[min(1200px,calc(100%-32px))]">
          <div className="flex flex-col min-[860px]:flex-row min-[860px]:items-end min-[860px]:justify-between gap-6 pb-4">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-green/[0.08] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-green">
                <span className="h-[7px] w-[7px] rounded-full bg-brand-orange animate-pulse" />
                03 / Campus Dispatch Fleet
              </p>
              <h1 className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.035em] text-brand-ink min-[481px]:text-[46px] min-[1025px]:text-[56px]">
                Your next delivery is{' '}
                <em className="not-italic text-brand-green underline decoration-brand-yellow decoration-[5px] underline-offset-4">
                  faster
                </em>{' '}
                than you think.
              </h1>
              <p className="mt-3 max-w-[620px] text-[15px] leading-[1.5] text-brand-ink-soft min-[769px]:text-[16px]">
                Real-time dispatch coordination across OOU Sagamu campus, Ibogun, Ago-Iwoye, and Lagos. 4-digit drop-off PIN security enabled.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-brand-green/[0.14] bg-white px-5 py-2.5 text-xs font-bold text-brand-ink shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:bg-brand-green-light"
              >
                <span>🔄</span> Refresh Telemetry
              </button>
            </div>
          </div>

          {/* 3. KPI METRIC CARDS (Landing Page Card Style) */}
          <div className="mt-6 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[1024px]:grid-cols-4">
            <div className="rounded-[24px] border-[1.5px] border-brand-green/[0.14] bg-white p-5 shadow-[0_8px_25px_rgba(0,0,0,0.05)] transition hover:-translate-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Total Fleet Riders
              </div>
              <div className="mt-1 font-display text-[32px] font-extrabold tracking-[-0.03em] text-brand-ink">
                {riders.length}
              </div>
              <div className="mt-1 text-xs font-bold text-brand-green">
                ✦ Verified campus fleet
              </div>
            </div>

            <div className="rounded-[24px] border-[1.5px] border-brand-green/[0.14] bg-white p-5 shadow-[0_8px_25px_rgba(0,0,0,0.05)] transition hover:-translate-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Online On Duty
              </div>
              <div className="mt-1 font-display text-[32px] font-extrabold tracking-[-0.03em] text-brand-green">
                {onlineCount}
              </div>
              <div className="mt-1 text-xs font-bold text-brand-green-bright">
                ● Ready for pickup missions
              </div>
            </div>

            <div className="rounded-[24px] border-[1.5px] border-brand-green/[0.14] bg-white p-5 shadow-[0_8px_25px_rgba(0,0,0,0.05)] transition hover:-translate-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Active Deliveries
              </div>
              <div className="mt-1 font-display text-[32px] font-extrabold tracking-[-0.03em] text-brand-orange">
                {orders.length}
              </div>
              <div className="mt-1 text-xs font-semibold text-brand-ink-soft">
                Missions currently in flight
              </div>
            </div>

            <div className="rounded-[24px] border-[1.5px] border-brand-green/[0.14] bg-white p-5 shadow-[0_8px_25px_rgba(0,0,0,0.05)] transition hover:-translate-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-muted">
                Completed Trips
              </div>
              <div className="mt-1 font-display text-[32px] font-extrabold tracking-[-0.03em] text-brand-ink">
                {totalTrips.toLocaleString()}
              </div>
              <div className="mt-1 text-xs font-bold text-brand-yellow">
                ★ 4.9 Average rating
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MAIN INTERACTIVE CONTENT */}
      <main className="mx-auto w-[min(1200px,calc(100%-32px))] py-8">
        {/* Navigation Tabs (Pill geometry) */}
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-full border-[1.5px] border-brand-green/[0.14] bg-white p-1.5 shadow-[0_8px_25px_rgba(0,0,0,0.05)] w-max max-w-full">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs min-[481px]:text-sm font-extrabold transition ${
              activeTab === 'fleet'
                ? 'bg-brand-green text-white shadow-[0_4px_14px_rgba(12,81,63,0.2)]'
                : 'text-brand-ink hover:text-brand-green'
            }`}
          >
            <span>🛵</span> Fleet Roster ({filteredRiders.length})
          </button>

          <button
            onClick={() => setActiveTab('missions')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs min-[481px]:text-sm font-extrabold transition ${
              activeTab === 'missions'
                ? 'bg-brand-green text-white shadow-[0_4px_14px_rgba(12,81,63,0.2)]'
                : 'text-brand-ink hover:text-brand-green'
            }`}
          >
            <span>📡</span> Live Orders Radar ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('apply')}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs min-[481px]:text-sm font-extrabold transition ${
              activeTab === 'apply'
                ? 'bg-brand-green text-white shadow-[0_4px_14px_rgba(12,81,63,0.2)]'
                : 'text-brand-ink hover:text-brand-green'
            }`}
          >
            <span>✍️</span> Onboard New Rider
          </button>
        </div>

        {/* TAB 1: FLEET DIRECTORY */}
        {activeTab === 'fleet' && (
          <div>
            {/* Search & Location Filter Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border-[1.5px] border-brand-green/[0.14] bg-white p-4 shadow-[0_8px_25px_rgba(0,0,0,0.05)]">
              {/* Search input */}
              <div className="relative min-w-[260px] flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted">🔍</span>
                <input
                  type="text"
                  placeholder="Search by rider name, vehicle, phone or campus..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border-[1.5px] border-brand-green/[0.14] bg-brand-paper py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-brand-green focus:bg-white"
                />
              </div>

              {/* Campus Location Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {CAMPUSES.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc.id)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      selectedLocation === loc.id
                        ? 'bg-brand-green text-white shadow-[0_2px_8px_rgba(12,81,63,0.2)]'
                        : 'border-[1.5px] border-brand-green/[0.14] bg-white text-brand-ink hover:bg-brand-green-light'
                    }`}
                  >
                    {loc.label}
                  </button>
                ))}
              </div>

              {/* Online / Offline Filter */}
              <div className="flex items-center gap-1 rounded-full border-[1.5px] border-brand-green/[0.14] bg-brand-cream p-1">
                {(['all', 'online', 'offline'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs font-extrabold capitalize transition ${
                      statusFilter === s
                        ? 'bg-brand-green text-white shadow-sm'
                        : 'text-brand-muted hover:text-brand-ink'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Riders Grid */}
            {loading ? (
              <div className="rounded-[28px] border-[1.5px] border-brand-green/[0.14] bg-white p-12 text-center shadow-[0_8px_25px_rgba(0,0,0,0.05)]">
                <div className="text-3xl animate-spin mb-3">🔄</div>
                <div className="font-extrabold text-brand-green">Connecting to Chow45 fleet telemetry...</div>
              </div>
            ) : filteredRiders.length === 0 ? (
              <div className="rounded-[28px] border-2 border-dashed border-brand-green/30 bg-white p-12 text-center">
                <div className="text-4xl mb-2">🛵</div>
                <h3 className="font-display text-lg font-extrabold text-brand-ink">No riders found</h3>
                <p className="mt-1 text-sm text-brand-muted">
                  No dispatchers matched your search query or campus filter.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedLocation('all');
                    setStatusFilter('all');
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2 text-xs font-bold text-white"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[1080px]:grid-cols-3">
                {filteredRiders.map((rider) => (
                  <div
                    key={rider.id}
                    className="rounded-[28px] border-[1.5px] border-brand-green/[0.14] bg-white p-6 shadow-[0_8px_25px_rgba(0,0,0,0.05)] transition hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(12,81,63,0.1)] flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Row: Avatar & Status Badge */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={rider.avatar || '/logo.png'}
                            alt={rider.name}
                            className="h-14 w-14 rounded-full object-cover border-2 border-brand-green bg-white shadow-sm"
                          />
                          <div>
                            <h3 className="font-display text-base font-extrabold text-brand-ink leading-tight">
                              {rider.name}
                            </h3>
                            <div className="mt-0.5 text-xs text-brand-muted">{rider.phone}</div>
                          </div>
                        </div>

                        {/* Duty Toggle Pill */}
                        <button
                          onClick={() => handleToggleOnline(rider)}
                          disabled={togglingId === rider.id}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold transition ${
                            rider.online
                              ? 'bg-brand-green-light text-brand-green border border-brand-green/20'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              rider.online ? 'bg-brand-green-bright animate-pulse' : 'bg-gray-400'
                            }`}
                          />
                          {togglingId === rider.id ? 'Saving...' : rider.online ? 'Online' : 'Offline'}
                        </button>
                      </div>

                      {/* Vehicle & Campus Tag */}
                      <div className="space-y-2 rounded-[20px] bg-brand-cream p-3.5 border border-brand-green/[0.1]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-brand-muted font-bold">Vehicle:</span>
                          <span className="font-bold text-brand-ink">{rider.vehicle}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-brand-muted font-bold">Campus Hub:</span>
                          <span className="font-extrabold text-brand-green uppercase tracking-wide">
                            {rider.location || 'Sagamu Campus'}
                          </span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-xl border border-brand-green/[0.1] bg-white p-2">
                          <div className="text-[10px] font-extrabold uppercase text-brand-muted">Completed Trips</div>
                          <div className="font-display text-lg font-extrabold text-brand-ink">{rider.tripsCount || 0}</div>
                        </div>
                        <div className="rounded-xl border border-brand-green/[0.1] bg-white p-2">
                          <div className="text-[10px] font-extrabold uppercase text-brand-muted">Driver Rating</div>
                          <div className="font-display text-lg font-extrabold text-brand-yellow">★ {rider.rating || 4.9}</div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-5 pt-3 border-t border-brand-green/[0.1] flex items-center justify-between">
                      <a
                        href={`tel:${rider.phone}`}
                        className="text-xs font-bold text-brand-green hover:underline flex items-center gap-1"
                      >
                        📞 Call Rider
                      </a>
                      <Link
                        href={`/rider`}
                        className="text-xs font-extrabold text-brand-ink hover:text-brand-green flex items-center gap-1"
                      >
                        View in Radar ↗
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE ORDERS RADAR */}
        {activeTab === 'missions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-xl font-extrabold text-brand-ink">
                Active Campus Deliveries in Flight
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green-light px-3.5 py-1 text-xs font-extrabold text-brand-green border border-brand-green/20">
                <span className="h-2 w-2 rounded-full bg-brand-orange animate-pulse" />
                Live Radar Active
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="rounded-[28px] border-2 border-dashed border-brand-green/30 bg-white p-12 text-center">
                <div className="text-4xl mb-2">📡</div>
                <h3 className="font-display text-lg font-extrabold text-brand-ink">No active orders right now</h3>
                <p className="mt-1 text-sm text-brand-muted max-w-md mx-auto">
                  All placed orders have been delivered! When students or staff order meals on campus, they will appear here instantly for rider dispatch.
                </p>
                <Link
                  href="/app"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-green px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-green-dark"
                >
                  Place Test Order on Marketplace ↗
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 min-[800px]:grid-cols-2">
                {orders.map((mission) => (
                  <div
                    key={mission.id}
                    className="rounded-[28px] border-[2px] border-brand-green bg-white p-6 shadow-[6px_8px_0_rgba(12,81,63,0.15)] flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Order ID & Status */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="font-mono text-xs font-extrabold px-3 py-1 rounded-full bg-brand-green-light text-brand-green border border-brand-green/20">
                          #{mission.id}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-yellow-pastel text-brand-ink px-3 py-1 text-xs font-extrabold">
                          ● {mission.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Pickup Stop */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-7 w-7 rounded-full bg-brand-green-light text-brand-green border border-brand-green flex items-center justify-center font-extrabold text-xs shrink-0">
                          P
                        </div>
                        <div>
                          <div className="text-[10px] font-extrabold uppercase tracking-wide text-brand-muted">
                            Restaurant Pickup
                          </div>
                          <div className="text-sm font-extrabold text-brand-ink">{mission.storeName}</div>
                          <div className="text-xs text-brand-muted">{mission.storeAddress}</div>
                        </div>
                      </div>

                      {/* Dropoff Stop */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className="h-7 w-7 rounded-full bg-brand-yellow-pastel text-brand-ink border border-brand-ink flex items-center justify-center font-extrabold text-xs shrink-0">
                          D
                        </div>
                        <div>
                          <div className="text-[10px] font-extrabold uppercase tracking-wide text-brand-muted">
                            Delivery Destination
                          </div>
                          <div className="text-sm font-extrabold text-brand-ink">{mission.deliveryAddress}</div>
                          <div className="text-xs text-brand-muted">
                            Security: <strong className="text-brand-green">4-Digit Drop-off PIN Required</strong>
                          </div>
                        </div>
                      </div>

                      {/* Order Items Pill */}
                      <div className="rounded-xl bg-brand-cream p-3 text-xs border border-brand-green/[0.1] mb-4">
                        <div className="font-bold text-brand-ink mb-1">Order Items:</div>
                        <div className="text-brand-ink-soft">
                          {mission.items.length > 0
                            ? mission.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')
                            : 'Campus food pack'}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-brand-green/[0.1] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-brand-muted">Delivery Payout</div>
                        <div className="font-display text-lg font-black text-brand-green">
                          ₦{mission.deliveryFee.toLocaleString()}
                        </div>
                      </div>
                      <Link
                        href="/rider"
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-green-dark"
                      >
                        Open Mission <span>↗</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REGISTER NEW RIDER */}
        {activeTab === 'apply' && (
          <div className="mx-auto max-w-xl rounded-[28px] border-[2px] border-brand-green bg-white p-8 shadow-[8px_10px_0_rgba(12,81,63,0.15)]">
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-green/[0.08] px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-brand-green mb-2">
                Campus Fleet Onboarding
              </span>
              <h2 className="font-display text-2xl font-extrabold text-brand-ink">
                Onboard a Dispatch Driver
              </h2>
              <p className="mt-1 text-sm text-brand-muted">
                Add a new verified motorbike or scooter rider to the Chow45 dispatch fleet.
              </p>
            </div>

            {appSuccess && (
              <div className="mb-6 rounded-2xl bg-brand-green-light border border-brand-green/30 p-4 text-center">
                <div className="text-xl mb-1">🎉</div>
                <div className="font-extrabold text-brand-green text-sm">
                  Rider successfully onboarded! Switching to fleet view...
                </div>
              </div>
            )}

            <form onSubmit={handleRiderApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-brand-muted mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Babatunde Fashola"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full rounded-2xl border-[1.5px] border-brand-green/[0.16] bg-brand-paper px-4 py-3 text-sm font-medium outline-none focus:border-brand-green focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-brand-muted mb-1">
                  Phone Number (Calls & WhatsApp)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 812 345 6789"
                  value={appPhone}
                  onChange={(e) => setAppPhone(e.target.value)}
                  className="w-full rounded-2xl border-[1.5px] border-brand-green/[0.16] bg-brand-paper px-4 py-3 text-sm font-medium outline-none focus:border-brand-green focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wide text-brand-muted mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={appVehicle}
                    onChange={(e) => setAppVehicle(e.target.value)}
                    className="w-full rounded-2xl border-[1.5px] border-brand-green/[0.16] bg-brand-paper px-4 py-3 text-sm font-medium outline-none focus:border-brand-green focus:bg-white"
                  >
                    <option value="Bajaj Boxer 150">Bajaj Boxer 150</option>
                    <option value="TVS Neo Scooter">TVS Neo Scooter</option>
                    <option value="Haojue 110-2">Haojue 110-2</option>
                    <option value="Honda Ace 125">Honda Ace 125</option>
                    <option value="Bicycle / Courier">Bicycle / Courier</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wide text-brand-muted mb-1">
                    License Plate (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SGM-452-OG"
                    value={appPlate}
                    onChange={(e) => setAppPlate(e.target.value)}
                    className="w-full rounded-2xl border-[1.5px] border-brand-green/[0.16] bg-brand-paper px-4 py-3 text-sm font-medium outline-none focus:border-brand-green focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-brand-muted mb-1">
                  Primary Campus Hub
                </label>
                <select
                  value={appLocation}
                  onChange={(e) => setAppLocation(e.target.value)}
                  className="w-full rounded-2xl border-[1.5px] border-brand-green/[0.16] bg-brand-paper px-4 py-3 text-sm font-medium outline-none focus:border-brand-green focus:bg-white"
                >
                  <option value="sagamu">OOU Sagamu Campus</option>
                  <option value="ibogun">Ibogun Campus</option>
                  <option value="alimosho">Alimosho / Lagos Hub</option>
                  <option value="ago-iwoye">Ago-Iwoye Main Campus</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={appSubmitting}
                className="w-full rounded-full bg-brand-green py-4 text-sm font-bold text-white shadow-[0_6px_18px_rgba(12,81,63,0.25)] transition hover:bg-brand-green-dark hover:-translate-y-0.5 disabled:opacity-50"
              >
                {appSubmitting ? 'Registering...' : 'Register Dispatch Rider ↗'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
