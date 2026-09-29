'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface WaitlistEntry {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  userType: string | null;
  department: string | null;
  createdAt: string;
}

interface WaitlistStats {
  total: number;
  students: number;
  vendors: number;
  staff: number;
  others: number;
  today: number;
}

interface FoodItem {
  id: string;
  vendorId: number | null;
  vendorName: string | null;
  vendorImage: string | null;
  vendorPhone: string | null;
  vendorEmail: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  priceType: string;
  price: number;
  scoopPrice: number | null;
  platePrice: number | null;
  piecePrice: number | null;
  status: string;
  isPublished: boolean;
  preorderEnabled: boolean;
  preorderDate: string | null;
  preorderTime: string | null;
  createdAt: string;
  sizes: Array<{ id: string; name: string; price: number }>;
  extras: Array<{ id: string; name: string; price: number; extraType: string }>;
}

interface FoodStats {
  totalItems: number;
  activeVendorsWithItems: number;
  totalRegisteredVendors: number;
  availableItems: number;
  outOfStockItems: number;
}

export default function AdminDashboardPage() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'waitlist' | 'foods'>('waitlist');

  // DB Health status
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [dbLatency, setDbLatency] = useState<number | null>(null);

  // Waitlist data state
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [waitlistStats, setWaitlistStats] = useState<WaitlistStats>({
    total: 0,
    students: 0,
    vendors: 0,
    staff: 0,
    others: 0,
    today: 0,
  });
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistSearch, setWaitlistSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'vendor' | 'staff' | 'other'>('all');

  // Food items data state
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [allVendors, setAllVendors] = useState<Array<{ id: number; businessName: string; status: string }>>([]);
  const [foodStats, setFoodStats] = useState<FoodStats>({
    totalItems: 0,
    activeVendorsWithItems: 0,
    totalRegisteredVendors: 0,
    availableItems: 0,
    outOfStockItems: 0,
  });
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [foodViewMode, setFoodViewMode] = useState<'grid' | 'table'>('grid');

  // Check existing session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAuth = sessionStorage.getItem('chow45_admin_auth');
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Fetch data on authentication
  useEffect(() => {
    if (isAuthenticated) {
      checkDbStatus();
      loadWaitlist();
      loadFoods();
    }
  }, [isAuthenticated]);

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.database === 'connected') {
        setDbStatus('connected');
        setDbLatency(data.latencyMs || null);
      } else {
        setDbStatus('error');
      }
    } catch {
      setDbStatus('error');
    }
  };

  const loadWaitlist = async () => {
    setWaitlistLoading(true);
    try {
      const res = await fetch('/api/waitlist');
      const data = await res.json();
      if (data.success) {
        setWaitlistEntries(data.entries || []);
        if (data.stats) setWaitlistStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load waitlist:', err);
    } finally {
      setWaitlistLoading(false);
    }
  };

  const loadFoods = async () => {
    setFoodLoading(true);
    try {
      const res = await fetch('/api/admin/foods');
      const data = await res.json();
      if (data.success) {
        setFoodItems(data.items || []);
        setAllVendors(data.vendors || []);
        if (data.stats) setFoodStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load food items:', err);
    } finally {
      setFoodLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === 'admin2026') {
      setIsAuthenticated(true);
      sessionStorage.setItem('chow45_admin_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Incorrect password. Please verify and try again.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('chow45_admin_auth');
    setPasswordInput('');
  };

  const handleDeleteWaitlist = async (id: number) => {
    if (!confirm('Are you sure you want to delete this waitlist entry?')) return;
    try {
      const res = await fetch(`/api/waitlist/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWaitlistEntries((prev) => prev.filter((entry) => entry.id !== id));
        loadWaitlist();
      }
    } catch (err) {
      alert('Failed to delete entry');
    }
  };

  // Filtered waitlist entries
  const filteredWaitlist = useMemo(() => {
    const term = waitlistSearch.toLowerCase().trim();
    return waitlistEntries.filter((entry) => {
      const role = (entry.userType || '').toLowerCase();
      if (roleFilter !== 'all') {
        if (roleFilter === 'other') {
          if (role.includes('student') || role.includes('vendor') || role.includes('staff')) {
            return false;
          }
        } else if (!role.includes(roleFilter)) {
          return false;
        }
      }

      if (term) {
        const matchName = (entry.name || '').toLowerCase().includes(term);
        const matchEmail = (entry.email || '').toLowerCase().includes(term);
        const matchPhone = (entry.phone || '').toLowerCase().includes(term);
        const matchDept = (entry.department || '').toLowerCase().includes(term);
        if (!matchName && !matchEmail && !matchPhone && !matchDept) return false;
      }

      return true;
    });
  }, [waitlistEntries, waitlistSearch, roleFilter]);

  // Filtered food items
  const filteredFoods = useMemo(() => {
    const term = foodSearch.toLowerCase().trim();
    return foodItems.filter((item) => {
      if (selectedVendorFilter !== 'all' && String(item.vendorId) !== selectedVendorFilter) {
        return false;
      }
      if (selectedCategoryFilter !== 'all' && (item.category || '').toLowerCase() !== selectedCategoryFilter.toLowerCase()) {
        return false;
      }
      if (selectedStatusFilter !== 'all') {
        const itemStatus = (item.status || '').toLowerCase();
        if (selectedStatusFilter === 'available' && itemStatus !== 'available') return false;
        if (selectedStatusFilter === 'out_of_stock' && !itemStatus.includes('out_of_stock')) return false;
      }
      if (term) {
        const matchName = (item.name || '').toLowerCase().includes(term);
        const matchDesc = (item.description || '').toLowerCase().includes(term);
        const matchVendor = (item.vendorName || '').toLowerCase().includes(term);
        if (!matchName && !matchDesc && !matchVendor) return false;
      }
      return true;
    });
  }, [foodItems, foodSearch, selectedVendorFilter, selectedCategoryFilter, selectedStatusFilter]);

  // Unique categories from food items
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    foodItems.forEach((i) => {
      if (i.category) set.add(i.category.toLowerCase());
    });
    return Array.from(set);
  }, [foodItems]);

  const formatPrice = (amount: number | null | undefined) => {
    if (!amount) return '0';
    return new Intl.NumberFormat('en-NG').format(amount);
  };

  const formatDate = (iso: string) => {
    if (!iso) return 'Recently';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Password Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0E131F] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#161D2E] border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#00A859] flex items-center justify-center font-bold text-lg text-white">
              C45
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Chow<span className="text-[#00A859]">45</span> Admin
              </h1>
              <p className="text-xs text-gray-400">OOU Sagamu Operations Center</p>
            </div>
          </div>

          <div className="bg-[#1C2438] p-4 rounded-xl border border-gray-700/50 mb-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-1">
              <svg className="w-4 h-4 text-[#00A859]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2" />
              </svg>
              Protected Management Portal
            </div>
            <p className="text-xs text-gray-400">
              Enter the administrator passkey to view the waitlist, track vendor uploaded foods, and manage campus analytics.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Admin Passkey
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  autoFocus
                  required
                  className="w-full px-4 py-2.5 bg-[#0E131F] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#00A859] focus:ring-1 focus:ring-[#00A859] text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#00A859] hover:bg-[#008f4c] text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-[#00A859]/20"
            >
              Unlock Admin Portal →
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-800 text-center">
            <Link href="/" className="text-xs text-gray-400 hover:text-[#00A859] transition-colors">
              ← Back to Chow45 Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-[#121826] border-b border-gray-800/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#00A859] flex items-center justify-center font-bold text-sm text-white shadow-sm">
                C45
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Chow<span className="text-[#00A859]">45</span>
              </span>
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gray-800/60 rounded-full border border-gray-700/50 text-[11px] font-medium text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00A859]"></span>
              Admin Portal • OOU Sagamu
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* DB Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/80 rounded-lg border border-gray-700/60 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  dbStatus === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : dbStatus === 'checking'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-gray-300 hidden md:inline">
                {dbStatus === 'connected'
                  ? `PostgreSQL Connected ${dbLatency ? `(${dbLatency}ms)` : ''}`
                  : dbStatus === 'checking'
                  ? 'Connecting DB...'
                  : 'DB Offline'}
              </span>
            </div>

            <Link
              href="/"
              target="_blank"
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
            >
              Public Site ↗
            </Link>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 rounded-lg border border-red-900/50 transition-colors"
            >
              Lock
            </button>
          </div>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 border-t border-gray-800/50 pt-2 pb-1">
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 border ${
              activeTab === 'waitlist'
                ? 'bg-[#00A859] text-white border-[#00A859] shadow-sm'
                : 'text-gray-400 hover:text-gray-200 bg-transparent border-transparent hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Waitlist Signups
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'waitlist' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-300'
              }`}
            >
              {waitlistStats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('foods')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 border ${
              activeTab === 'foods'
                ? 'bg-[#00A859] text-white border-[#00A859] shadow-sm'
                : 'text-gray-400 hover:text-gray-200 bg-transparent border-transparent hover:bg-gray-800/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Vendor Uploaded Foods
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'foods' ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-300'
              }`}
            >
              {foodStats.totalItems}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* ======================================================== */}
        {/* TAB 1: WAITLIST MANAGEMENT                               */}
        {/* ======================================================== */}
        {activeTab === 'waitlist' && (
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Waitlist Signups</h2>
                <p className="text-sm text-gray-400">
                  Live pre-launch signups across students, vendors, and staff at OOU Sagamu campus.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadWaitlist}
                  disabled={waitlistLoading}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-medium border border-gray-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${waitlistLoading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {waitlistLoading ? 'Refreshing...' : 'Refresh'}
                </button>

                <a
                  href="/api/waitlist/export"
                  download
                  className="px-3.5 py-2 bg-[#00A859] hover:bg-[#008f4c] text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </a>
              </div>
            </div>

            {/* Bento Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
                <span className="text-xs text-gray-400 block font-medium">Total Signups</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {waitlistStats.total}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-gray-800 text-gray-300 rounded-md">
                  All Roles
                </span>
              </div>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
                <span className="text-xs text-blue-400 block font-medium">Students</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {waitlistStats.students}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/40 rounded-md">
                  {waitlistStats.total ? `${Math.round((waitlistStats.students / waitlistStats.total) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 ring-1 ring-[#00A859]/30">
                <span className="text-xs text-[#00A859] block font-medium">Vendors</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {waitlistStats.vendors}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 rounded-md">
                  {waitlistStats.total ? `${Math.round((waitlistStats.vendors / waitlistStats.total) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
                <span className="text-xs text-amber-400 block font-medium">Staff & Others</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {waitlistStats.staff + waitlistStats.others}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/40 rounded-md">
                  {waitlistStats.total ? `${Math.round(((waitlistStats.staff + waitlistStats.others) / waitlistStats.total) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 col-span-2 md:col-span-1">
                <span className="text-xs text-purple-400 block font-medium">Today&apos;s Signups</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {waitlistStats.today}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/40 rounded-md">
                  New Signups
                </span>
              </div>
            </div>

            {/* Search and Role Filter Toolbar */}
            <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-96">
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="m21 21-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={waitlistSearch}
                  onChange={(e) => setWaitlistSearch(e.target.value)}
                  placeholder="Search by name, email, phone, department..."
                  className="w-full pl-10 pr-4 py-2 bg-[#0E131F] border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#00A859]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === 'all'
                      ? 'bg-white text-gray-900 font-bold'
                      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  All ({waitlistEntries.length})
                </button>
                <button
                  onClick={() => setRoleFilter('student')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === 'student'
                      ? 'bg-blue-500 text-white font-bold'
                      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Students ({waitlistStats.students})
                </button>
                <button
                  onClick={() => setRoleFilter('vendor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === 'vendor'
                      ? 'bg-[#00A859] text-white font-bold'
                      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Vendors ({waitlistStats.vendors})
                </button>
                <button
                  onClick={() => setRoleFilter('staff')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === 'staff'
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Staff ({waitlistStats.staff})
                </button>
                <button
                  onClick={() => setRoleFilter('other')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === 'other'
                      ? 'bg-purple-500 text-white font-bold'
                      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Other ({waitlistStats.others})
                </button>
              </div>
            </div>

            {/* Waitlist Data Table */}
            <div className="bg-[#141B2D] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-[#0E131F] text-xs uppercase text-gray-400 font-semibold border-b border-gray-800">
                    <tr>
                      <th className="py-3.5 px-4 w-12">#</th>
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">Contact Email</th>
                      <th className="py-3.5 px-4">Phone Number</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Department / Faculty</th>
                      <th className="py-3.5 px-4">Joined Date</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {waitlistLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-[#00A859] border-t-transparent rounded-full animate-spin"></div>
                            Loading waitlist signups...
                          </div>
                        </td>
                      </tr>
                    ) : filteredWaitlist.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400">
                          <p className="text-base font-semibold text-gray-300">No waitlist entries found</p>
                          <p className="text-xs text-gray-500 mt-1">Try clearing your search or filter.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredWaitlist.map((entry, idx) => {
                        const role = (entry.userType || 'Other').toLowerCase();
                        let badgeColor = 'bg-gray-800 text-gray-300 border-gray-700';
                        if (role.includes('vendor')) {
                          badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
                        } else if (role.includes('student')) {
                          badgeColor = 'bg-blue-950/80 text-blue-300 border-blue-700/60';
                        } else if (role.includes('staff')) {
                          badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-700/60';
                        }

                        const initials = (entry.name || '?')
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        return (
                          <tr key={entry.id} className="hover:bg-gray-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs text-gray-500">
                              {filteredWaitlist.length - idx}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-200">
                                  {initials}
                                </div>
                                <span className="font-medium text-white">{entry.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <a
                                href={`mailto:${entry.email}`}
                                className="text-gray-300 hover:text-[#00A859] transition-colors"
                              >
                                {entry.email}
                              </a>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs">
                              {entry.phone ? (
                                <a
                                  href={`tel:${entry.phone}`}
                                  className="text-gray-300 hover:text-[#00A859] transition-colors"
                                >
                                  {entry.phone}
                                </a>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full border ${badgeColor}`}
                              >
                                {entry.userType || 'Other'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-300">
                              {entry.department?.trim() || <span className="text-gray-600">—</span>}
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">
                              {formatDate(entry.createdAt)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleDeleteWaitlist(entry.id)}
                                title="Remove entry"
                                className="text-gray-500 hover:text-red-400 p-1 rounded-md transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: VENDORS UPLOADED FOOD                             */}
        {/* ======================================================== */}
        {activeTab === 'foods' && (
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Vendor Uploaded Food</h2>
                <p className="text-sm text-gray-400">
                  Inspect all menu dishes, pricing models (plate, scoop, piece), availability, and photos uploaded by vendors.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadFoods}
                  disabled={foodLoading}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-medium border border-gray-700 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${foodLoading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {foodLoading ? 'Refreshing...' : 'Refresh Dishes'}
                </button>

                <Link
                  href="/vendor/food/add"
                  className="px-3.5 py-2 bg-[#00A859] hover:bg-[#008f4c] text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Food As Vendor ↗
                </Link>
              </div>
            </div>

            {/* Bento Statistics Cards for Food */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
                <span className="text-xs text-gray-400 block font-medium">Total Dishes</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {foodStats.totalItems}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-gray-800 text-gray-300 rounded-md">
                  Active Database Items
                </span>
              </div>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
                <span className="text-xs text-[#00A859] block font-medium">Contributing Vendors</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {foodStats.activeVendorsWithItems}{' '}
                  <span className="text-xs font-normal text-gray-400">/ {foodStats.totalRegisteredVendors} stores</span>
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 rounded-md">
                  Stores with Food
                </span>
              </div>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
                <span className="text-xs text-blue-400 block font-medium">Available Dishes</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {foodStats.availableItems}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/40 rounded-md">
                  Ready to Order
                </span>
              </div>

              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4">
                <span className="text-xs text-rose-400 block font-medium">Out of Stock</span>
                <span className="text-2xl font-extrabold text-white mt-1 block">
                  {foodStats.outOfStockItems}
                </span>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/40 rounded-md">
                  Unavailable
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search */}
              <div className="relative w-full md:w-72">
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="m21 21-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Search dish or vendor name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-[#0E131F] border border-gray-700/80 rounded-xl text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#00A859]"
                />
              </div>

              {/* Dropdowns & View toggles */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Vendor Filter */}
                <select
                  value={selectedVendorFilter}
                  onChange={(e) => setSelectedVendorFilter(e.target.value)}
                  className="bg-[#0E131F] border border-gray-700 text-gray-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#00A859]"
                >
                  <option value="all">All Vendors ({allVendors.length})</option>
                  {allVendors.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.businessName || `Vendor #${v.id}`}
                    </option>
                  ))}
                </select>

                {/* Category Filter */}
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="bg-[#0E131F] border border-gray-700 text-gray-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#00A859]"
                >
                  <option value="all">All Categories</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-[#0E131F] border border-gray-700 text-gray-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#00A859]"
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-[#0E131F] border border-gray-700 rounded-xl p-0.5 ml-auto md:ml-0">
                  <button
                    onClick={() => setFoodViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      foodViewMode === 'grid' ? 'bg-[#00A859] text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                    title="Grid View"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" strokeWidth="2" rx="1" />
                      <rect x="14" y="3" width="7" height="7" strokeWidth="2" rx="1" />
                      <rect x="14" y="14" width="7" height="7" strokeWidth="2" rx="1" />
                      <rect x="3" y="14" width="7" height="7" strokeWidth="2" rx="1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setFoodViewMode('table')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      foodViewMode === 'table' ? 'bg-[#00A859] text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                    title="Table View"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Food Content Display */}
            {foodLoading ? (
              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-16 text-center text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#00A859] border-t-transparent rounded-full animate-spin"></div>
                  Loading vendor food uploads...
                </div>
              </div>
            ) : filteredFoods.length === 0 ? (
              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl p-16 text-center text-gray-400">
                <p className="text-base font-semibold text-gray-300">No dishes match your filters</p>
                <p className="text-xs text-gray-500 mt-1">Try resetting the vendor, category, or search filter.</p>
              </div>
            ) : foodViewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFoods.map((item) => {
                  const isAvailable = (item.status || '').toLowerCase() === 'available';

                  // Determine price label
                  let priceLabel = `₦${formatPrice(item.price)}`;
                  if (item.priceType === 'plate' && item.platePrice) {
                    priceLabel = `₦${formatPrice(item.platePrice)} / plate`;
                  } else if (item.priceType === 'scoop' && item.scoopPrice) {
                    priceLabel = `₦${formatPrice(item.scoopPrice)} / scoop`;
                  } else if (item.priceType === 'piece' && item.piecePrice) {
                    priceLabel = `₦${formatPrice(item.piecePrice)} / piece`;
                  } else if (item.priceType === 'both') {
                    priceLabel = `₦${formatPrice(item.platePrice)} plate · ₦${formatPrice(item.scoopPrice)} scoop`;
                  }

                  return (
                    <div
                      key={item.id}
                      className="bg-[#141B2D] border border-gray-800 hover:border-gray-700/80 rounded-2xl overflow-hidden shadow-lg flex flex-col transition-all group"
                    >
                      {/* Food Image */}
                      <div className="h-44 bg-[#0E131F] relative overflow-hidden flex items-center justify-center">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}

                        {/* Status Badge */}
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full backdrop-blur-md border ${
                              isAvailable
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                                : 'bg-rose-950/80 text-rose-300 border-rose-600/50'
                            }`}
                          >
                            {isAvailable ? '● Available' : '○ Out of stock'}
                          </span>
                        </div>

                        {/* Category Pill */}
                        <div className="absolute bottom-3 left-3">
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-black/60 text-gray-200 rounded-md backdrop-blur-sm uppercase tracking-wider">
                            {item.category || 'General'}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Vendor Name */}
                          <div className="flex items-center gap-1.5 text-xs text-[#00A859] font-medium mb-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            <span className="truncate">{item.vendorName || `Store #${item.vendorId}`}</span>
                          </div>

                          {/* Food Name */}
                          <h3 className="text-base font-bold text-white group-hover:text-[#00A859] transition-colors line-clamp-1">
                            {item.name}
                          </h3>

                          {/* Description */}
                          {item.description && (
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Price & Variants Footnote */}
                        <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between">
                          <div>
                            <span className="text-xs text-gray-400 block font-normal">Pricing</span>
                            <span className="text-base font-extrabold text-white">
                              {priceLabel}
                            </span>
                          </div>

                          {/* Sizes / Extras Pill */}
                          {(item.sizes?.length > 0 || item.extras?.length > 0) && (
                            <div className="text-right">
                              <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-1 rounded-md border border-gray-700">
                                {item.sizes?.length > 0 ? `${item.sizes.length} sizes` : ''}
                                {item.sizes?.length > 0 && item.extras?.length > 0 ? ' · ' : ''}
                                {item.extras?.length > 0 ? `${item.extras.length} extras` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="bg-[#141B2D] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-[#0E131F] text-xs uppercase text-gray-400 font-semibold border-b border-gray-800">
                      <tr>
                        <th className="py-3.5 px-4">Dish</th>
                        <th className="py-3.5 px-4">Vendor</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Price</th>
                        <th className="py-3.5 px-4">Price Model</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Variants / Extras</th>
                        <th className="py-3.5 px-4">Date Uploaded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {filteredFoods.map((item) => {
                        const isAvailable = (item.status || '').toLowerCase() === 'available';
                        return (
                          <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-10 h-10 rounded-lg object-cover bg-gray-800 border border-gray-700 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-base flex-shrink-0">
                                    🍲
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold text-white block">{item.name}</span>
                                  {item.description && (
                                    <span className="text-xs text-gray-400 line-clamp-1 max-w-xs">
                                      {item.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-[#00A859]">
                              {item.vendorName || `Store #${item.vendorId}`}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300">
                                {item.category || 'General'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-white text-xs">
                              ₦{formatPrice(item.price || item.platePrice || item.piecePrice || item.scoopPrice)}
                            </td>
                            <td className="py-3 px-4 text-xs uppercase text-gray-400 font-mono">
                              {item.priceType || 'plate'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                                  isAvailable
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                    : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                                }`}
                              >
                                {isAvailable ? 'Available' : 'Out of stock'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-400">
                              {item.sizes?.length > 0 && `${item.sizes.length} sizes`}
                              {item.sizes?.length > 0 && item.extras?.length > 0 && ' · '}
                              {item.extras?.length > 0 && `${item.extras.length} extras`}
                              {!item.sizes?.length && !item.extras?.length && <span className="text-gray-600">—</span>}
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">
                              {formatDate(item.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
