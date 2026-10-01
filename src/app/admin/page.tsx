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
  pendingItems?: number;
  approvedItems?: number;
  rejectedItems?: number;
  outOfStockItems: number;
}

interface VendorEntry {
  id: number;
  businessName: string;
  contactEmail: string | null;
  ownerPhone: string | null;
  ownerName: string | null;
  status: string;
  storeId: string | null;
  userId: number | null;
  image: string | null;
  address: string | null;
  createdAt: string;
  _isUserOnly?: boolean;
}

export default function AdminDashboardPage() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'waitlist' | 'vendors' | 'foods'>('vendors');

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

  // Vendor directory state
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState<'all' | 'with-food' | 'no-food'>('all');

  // Food items data state
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [allVendors, setAllVendors] = useState<VendorEntry[]>([]);
  const [foodStats, setFoodStats] = useState<FoodStats>({
    totalItems: 0,
    activeVendorsWithItems: 0,
    totalRegisteredVendors: 0,
    availableItems: 0,
    pendingItems: 0,
    approvedItems: 0,
    rejectedItems: 0,
    outOfStockItems: 0,
  });
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [foodViewMode, setFoodViewMode] = useState<'grid' | 'table'>('grid');

  // Food Preview Modal & Action States
  const [previewFoodItem, setPreviewFoodItem] = useState<FoodItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const handleFoodAction = async (itemId: string, action: 'approve' | 'reject' | 'pending') => {
    setActionLoadingId(itemId);
    try {
      const res = await fetch('/api/admin/foods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, action })
      });
      const data = await res.json();
      if (data.success) {
        setFoodItems(prev => prev.map(item => {
          if (item.id === itemId) {
            const nextStatus = action === 'approve' ? 'available' : action === 'reject' ? 'rejected' : 'pending_verification';
            const nextPublished = action === 'approve';
            return { ...item, status: nextStatus, isPublished: nextPublished };
          }
          return item;
        }));

        if (previewFoodItem && previewFoodItem.id === itemId) {
          const nextStatus = action === 'approve' ? 'available' : action === 'reject' ? 'rejected' : 'pending_verification';
          const nextPublished = action === 'approve';
          setPreviewFoodItem(prev => prev ? { ...prev, status: nextStatus, isPublished: nextPublished } : null);
        }

        const msg = action === 'approve'
          ? '✓ Food approved and published to the marketplace!'
          : action === 'reject'
          ? '✕ Food rejected and hidden from marketplace'
          : 'Food marked as pending verification';
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 4000);
        loadFoods();
      } else {
        alert(data.error || 'Failed to update food item');
      }
    } catch (err: any) {
      alert('Error updating food item: ' + (err.message || err));
    } finally {
      setActionLoadingId(null);
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
        const isPub = Boolean(item.isPublished);
        if (selectedStatusFilter === 'pending') {
          if (itemStatus !== 'pending_verification' && isPub) return false;
        } else if (selectedStatusFilter === 'approved') {
          if (itemStatus !== 'available' || !isPub) return false;
        } else if (selectedStatusFilter === 'rejected') {
          if (itemStatus !== 'rejected') return false;
        }
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

  // Map of vendorId -> dish count
  const vendorFoodCountMap = useMemo(() => {
    const map = new Map<number, number>();
    foodItems.forEach((item) => {
      if (item.vendorId) {
        map.set(item.vendorId, (map.get(item.vendorId) || 0) + 1);
      }
    });
    return map;
  }, [foodItems]);

  // Comprehensive dish count helper supporting ID and contactEmail matching
  const getVendorDishCount = (v: VendorEntry) => {
    let count = 0;
    if (v.id && vendorFoodCountMap.has(v.id)) {
      count = vendorFoodCountMap.get(v.id) || 0;
    }
    const cleanEmail = (v.contactEmail || '').trim().toLowerCase();
    if (cleanEmail) {
      const emailMatches = foodItems.filter(
        (i) => i.vendorEmail && i.vendorEmail.trim().toLowerCase() === cleanEmail
      ).length;
      if (emailMatches > count) count = emailMatches;
    }
    return count;
  };

  // Filtered vendors list
  const filteredVendors = useMemo(() => {
    const term = vendorSearch.toLowerCase().trim();
    return allVendors.filter((v) => {
      const dishCount = getVendorDishCount(v);
      if (vendorFilter === 'with-food' && dishCount === 0) return false;
      if (vendorFilter === 'no-food' && dishCount > 0) return false;

      if (term) {
        const matchName = (v.businessName || '').toLowerCase().includes(term);
        const matchEmail = (v.contactEmail || '').toLowerCase().includes(term);
        const matchPhone = (v.ownerPhone || '').toLowerCase().includes(term);
        const matchAddr = (v.address || '').toLowerCase().includes(term);
        const matchStore = (v.storeId || '').toLowerCase().includes(term);
        if (!matchName && !matchEmail && !matchPhone && !matchAddr && !matchStore) return false;
      }

      return true;
    });
  }, [allVendors, vendorSearch, vendorFilter, vendorFoodCountMap, foodItems]);

  const vendorsWithFoodCount = useMemo(() => {
    return allVendors.filter((v) => getVendorDishCount(v) > 0).length;
  }, [allVendors, vendorFoodCountMap, foodItems]);

  const exportVendorsCsv = () => {
    const headers = ['ID', 'Business Name', 'Contact Email', 'Phone', 'Address', 'Dishes Count', 'Status', 'Registered Date'];
    const rows = allVendors.map((v) => [
      v.id,
      `"${(v.businessName || '').replace(/"/g, '""')}"`,
      `"${(v.contactEmail || '').replace(/"/g, '""')}"`,
      `"${(v.ownerPhone || '').replace(/"/g, '""')}"`,
      `"${(v.address || '').replace(/"/g, '""')}"`,
      getVendorDishCount(v),
      v.status || 'approved',
      v.createdAt ? new Date(v.createdAt).toISOString() : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chow45_vendors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  // Password Lock Screen (Designed in Chow45 Brand Style)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FFFDF6] text-[#111111] flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-white border border-[#0C513F]/15 rounded-3xl p-8 shadow-[0_12px_40px_rgba(12,81,63,0.08)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#0C513F] flex items-center justify-center font-extrabold text-xl text-[#FFC928] shadow-md shadow-[#0C513F]/20">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-[#111111] tracking-tight">
                Chow<span className="text-[#0C513F]">45</span>
              </h1>
              <p className="text-xs font-semibold text-[#6E6D66]">Operations Admin Portal</p>
            </div>
          </div>

          <div className="bg-[#FAF6EB] p-4 rounded-2xl border border-[#0C513F]/10 mb-6">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#0C513F] uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-[#00B978]"></span>
              Protected Portal Access
            </div>
            <p className="text-xs text-[#383834] leading-relaxed">
              Enter the administrator passkey to view waitlist signups, inspect vendor uploaded food, and export records.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#111111] mb-1.5">
                Passkey
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-[#FAF6EB]/60 border border-gray-200 rounded-xl text-[#111111] placeholder-gray-400 focus:outline-none focus:border-[#0C513F] focus:ring-2 focus:ring-[#0C513F]/20 text-sm font-medium transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6E6D66] hover:text-[#111111] text-xs font-semibold"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-[#0C513F] hover:bg-[#073B2E] text-white font-extrabold rounded-full text-sm transition-all shadow-[0_6px_20px_rgba(12,81,63,0.22)] hover:-translate-y-0.5 active:translate-y-0"
            >
              Unlock Dashboard →
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link href="/" className="text-xs font-semibold text-[#6E6D66] hover:text-[#0C513F] transition-colors">
              ← Return to Chow45 Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF6] text-[#111111] flex flex-col font-sans">
      {/* Brand Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#0C513F]/10 sticky top-0 z-30 shadow-[0_2px_15px_rgba(12,81,63,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-[#0C513F] flex items-center justify-center font-extrabold text-lg text-[#FFC928] shadow-[0_4px_12px_rgba(12,81,63,0.2)]">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <div>
                <span className="text-xl font-extrabold text-[#111111] tracking-tight block leading-tight">
                  Chow<span className="text-[#0C513F]">45</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6D66]">
                  Admin Portal
                </span>
              </div>
            </Link>

            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[#0C513F]/15 bg-[#FAF6EB] px-3 py-1 text-xs font-bold text-[#111111] ml-2">
              <span className="text-xs leading-none">🇳🇬</span>
              <span>OOU Sagamu</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* DB Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF6EB] rounded-full border border-[#0C513F]/15 text-xs font-bold">
              <span
                className={`w-2 h-2 rounded-full ${
                  dbStatus === 'connected'
                    ? 'bg-[#00B978] animate-pulse'
                    : dbStatus === 'checking'
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-[#383834] hidden sm:inline">
                {dbStatus === 'connected'
                  ? `PostgreSQL Connected ${dbLatency ? `(${dbLatency}ms)` : ''}`
                  : dbStatus === 'checking'
                  ? 'Connecting...'
                  : 'Offline'}
              </span>
            </div>

            <Link
              href="/"
              target="_blank"
              className="px-3.5 py-1.5 text-xs font-bold text-[#0C513F] hover:bg-[#FAF6EB] rounded-full transition-colors border border-[#0C513F]/20"
            >
              Public Site ↗
            </Link>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-full border border-red-200 transition-colors"
            >
              Lock
            </button>
          </div>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap gap-2.5 border-t border-[#0C513F]/10 pt-2 pb-2">
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`px-5 py-2.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-2 border ${
              activeTab === 'waitlist'
                ? 'bg-[#0C513F] text-white border-[#0C513F] shadow-[0_4px_14px_rgba(12,81,63,0.18)]'
                : 'text-[#6E6D66] hover:text-[#111111] bg-white border-gray-200 hover:bg-[#FAF6EB]'
            }`}
          >
            <span>📋 Waitlist Signups</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeTab === 'waitlist' ? 'bg-[#FFC928] text-[#111111]' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {waitlistStats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-5 py-2.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-2 border ${
              activeTab === 'vendors'
                ? 'bg-[#0C513F] text-white border-[#0C513F] shadow-[0_4px_14px_rgba(12,81,63,0.18)]'
                : 'text-[#6E6D66] hover:text-[#111111] bg-white border-gray-200 hover:bg-[#FAF6EB]'
            }`}
          >
            <span>🏪 All Registered Vendors</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeTab === 'vendors' ? 'bg-[#FFC928] text-[#111111]' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {allVendors.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('foods')}
            className={`px-5 py-2.5 text-xs font-extrabold rounded-full transition-all flex items-center gap-2 border ${
              activeTab === 'foods'
                ? 'bg-[#0C513F] text-white border-[#0C513F] shadow-[0_4px_14px_rgba(12,81,63,0.18)]'
                : 'text-[#6E6D66] hover:text-[#111111] bg-white border-gray-200 hover:bg-[#FAF6EB]'
            }`}
          >
            <span>🍲 Food Verification Queue</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeTab === 'foods' ? 'bg-[#FFC928] text-[#111111]' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {foodStats.totalItems}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* ======================================================== */}
        {/* TAB 1: WAITLIST SIGNUPS                                  */}
        {/* ======================================================== */}
        {activeTab === 'waitlist' && (
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-[#111111] tracking-tight">Waitlist Signups</h2>
                <p className="text-xs text-[#6E6D66] mt-1">
                  Live pre-launch registrations for students, vendors, and staff at OOU Sagamu campus.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadWaitlist}
                  disabled={waitlistLoading}
                  className="px-4 py-2 bg-white hover:bg-[#FAF6EB] text-[#111111] rounded-full text-xs font-bold border border-gray-200 shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-[#0C513F] ${waitlistLoading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {waitlistLoading ? 'Refreshing...' : 'Refresh List'}
                </button>

                <a
                  href="/api/waitlist/export"
                  download
                  className="px-5 py-2.5 bg-[#0C513F] hover:bg-[#073B2E] text-white rounded-full text-xs font-extrabold flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(12,81,63,0.18)]"
                >
                  <svg className="w-3.5 h-3.5 text-[#FFC928]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </a>
              </div>
            </div>

            {/* Bento Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6D66] block">Total Signups</span>
                <span className="text-3xl font-black text-[#111111] mt-1 block">
                  {waitlistStats.total}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#FAF6EB] text-[#0C513F] rounded-full border border-[#0C513F]/10">
                  All Roles
                </span>
              </div>

              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">Students</span>
                <span className="text-3xl font-black text-[#111111] mt-1 block">
                  {waitlistStats.students}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#D5E7FD] text-[#1D4ED8] rounded-full">
                  {waitlistStats.total ? `${Math.round((waitlistStats.students / waitlistStats.total) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-white border-2 border-[#0C513F] rounded-2xl p-5 shadow-[0_4px_20px_rgba(12,81,63,0.06)] relative overflow-hidden">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0C513F] block">Vendors</span>
                <span className="text-3xl font-black text-[#0C513F] mt-1 block">
                  {waitlistStats.vendors}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#E4F7EC] text-[#0C513F] rounded-full border border-[#0C513F]/20">
                  Store Signups
                </span>
              </div>

              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Staff & Others</span>
                <span className="text-3xl font-black text-[#111111] mt-1 block">
                  {waitlistStats.staff + waitlistStats.others}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#FFF2B2] text-[#B45309] rounded-full">
                  {waitlistStats.total ? `${Math.round(((waitlistStats.staff + waitlistStats.others) / waitlistStats.total) * 100)}%` : '0%'}
                </span>
              </div>

              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] col-span-2 md:col-span-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 block">Today&apos;s Signups</span>
                <span className="text-3xl font-black text-[#111111] mt-1 block">
                  {waitlistStats.today}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-purple-100 text-purple-800 rounded-full">
                  New Signups
                </span>
              </div>
            </div>

            {/* Search and Role Filter Toolbar */}
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
              <div className="relative w-full md:w-96">
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2.2" />
                  <path d="m21 21-4.3-4.3" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={waitlistSearch}
                  onChange={(e) => setWaitlistSearch(e.target.value)}
                  placeholder="Search by name, email, phone, department..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF6EB]/60 border border-gray-200 rounded-full text-xs font-medium text-[#111111] placeholder-gray-400 focus:outline-none focus:border-[#0C513F] focus:ring-1 focus:ring-[#0C513F]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    roleFilter === 'all'
                      ? 'bg-[#0C513F] text-white shadow-sm'
                      : 'bg-[#FAF6EB] text-[#383834] hover:bg-gray-100'
                  }`}
                >
                  All ({waitlistEntries.length})
                </button>
                <button
                  onClick={() => setRoleFilter('student')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    roleFilter === 'student'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-[#D5E7FD]/60 text-[#1D4ED8] hover:bg-[#D5E7FD]'
                  }`}
                >
                  Students ({waitlistStats.students})
                </button>
                <button
                  onClick={() => setRoleFilter('vendor')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    roleFilter === 'vendor'
                      ? 'bg-[#0C513F] text-white shadow-sm'
                      : 'bg-[#E4F7EC] text-[#0C513F] hover:bg-[#d2f2dd]'
                  }`}
                >
                  Vendors ({waitlistStats.vendors})
                </button>
                <button
                  onClick={() => setRoleFilter('staff')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    roleFilter === 'staff'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-[#FFF2B2]/60 text-[#B45309] hover:bg-[#FFF2B2]'
                  }`}
                >
                  Staff ({waitlistStats.staff})
                </button>
                <button
                  onClick={() => setRoleFilter('other')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    roleFilter === 'other'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  Other ({waitlistStats.others})
                </button>
              </div>
            </div>

            {/* Waitlist Data Table */}
            <div className="bg-white border border-gray-200/80 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#383834]">
                  <thead className="bg-[#FAF6EB] text-xs uppercase text-[#6E6D66] font-bold border-b border-gray-200/70">
                    <tr>
                      <th className="py-4 px-5 w-12">#</th>
                      <th className="py-4 px-5">Name</th>
                      <th className="py-4 px-5">Email Address</th>
                      <th className="py-4 px-5">Phone</th>
                      <th className="py-4 px-5">Role</th>
                      <th className="py-4 px-5">Department / Faculty</th>
                      <th className="py-4 px-5">Joined Date</th>
                      <th className="py-4 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {waitlistLoading ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-[#6E6D66]">
                          <div className="flex items-center justify-center gap-2 font-bold text-xs">
                            <div className="w-4 h-4 border-2 border-[#0C513F] border-t-transparent rounded-full animate-spin"></div>
                            Loading waitlist signups...
                          </div>
                        </td>
                      </tr>
                    ) : filteredWaitlist.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-[#6E6D66]">
                          <p className="text-base font-extrabold text-[#111111]">No waitlist entries found</p>
                          <p className="text-xs text-[#6E6D66] mt-1">Try clearing your search term or filter.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredWaitlist.map((entry, idx) => {
                        const role = (entry.userType || 'Other').toLowerCase();
                        let badgeColor = 'bg-gray-100 text-gray-700';
                        if (role.includes('vendor')) {
                          badgeColor = 'bg-[#E4F7EC] text-[#0C513F] border border-[#0C513F]/20 font-black';
                        } else if (role.includes('student')) {
                          badgeColor = 'bg-[#D5E7FD] text-[#1D4ED8]';
                        } else if (role.includes('staff')) {
                          badgeColor = 'bg-[#FFF2B2] text-[#B45309]';
                        }

                        const initials = (entry.name || '?')
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        return (
                          <tr key={entry.id} className="hover:bg-[#FAF6EB]/40 transition-colors">
                            <td className="py-3.5 px-5 font-mono text-xs text-gray-400">
                              {filteredWaitlist.length - idx}
                            </td>
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#FAF6EB] border border-[#0C513F]/15 flex items-center justify-center text-xs font-extrabold text-[#0C513F]">
                                  {initials}
                                </div>
                                <span className="font-bold text-[#111111]">{entry.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-5">
                              <a
                                href={`mailto:${entry.email}`}
                                className="text-[#0C513F] hover:underline font-medium text-xs"
                              >
                                {entry.email}
                              </a>
                            </td>
                            <td className="py-3.5 px-5 font-mono text-xs">
                              {entry.phone ? (
                                <a
                                  href={`tel:${entry.phone}`}
                                  className="text-[#111111] hover:underline"
                                >
                                  {entry.phone}
                                </a>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5">
                              <span
                                className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${badgeColor}`}
                              >
                                {entry.userType || 'Other'}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-xs text-[#383834] font-medium">
                              {entry.department?.trim() || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-3.5 px-5 text-xs text-[#6E6D66] whitespace-nowrap">
                              {formatDate(entry.createdAt)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                onClick={() => handleDeleteWaitlist(entry.id)}
                                title="Remove entry"
                                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg transition-colors hover:bg-red-50"
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
        {/* TAB 2: ALL REGISTERED VENDORS DIRECTORY                  */}
        {/* ======================================================== */}
        {activeTab === 'vendors' && (
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-[#111111] tracking-tight">Registered Vendors Directory</h2>
                <p className="text-xs text-[#6E6D66] mt-1">
                  Complete directory of all registered food vendors, their contact emails, phone numbers, and dish counts.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadFoods}
                  disabled={foodLoading}
                  className="px-4 py-2 bg-white hover:bg-[#FAF6EB] text-[#111111] rounded-full text-xs font-bold border border-gray-200 shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-[#0C513F] ${foodLoading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {foodLoading ? 'Refreshing...' : 'Refresh Vendors'}
                </button>

                <button
                  onClick={exportVendorsCsv}
                  className="px-4 py-2 bg-white hover:bg-[#FAF6EB] text-[#111111] rounded-full text-xs font-bold border border-gray-200 shadow-sm flex items-center gap-2 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-[#0C513F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Vendors CSV
                </button>

                <Link
                  href="/vendor/food/add"
                  className="px-5 py-2.5 bg-[#0C513F] hover:bg-[#073B2E] text-white rounded-full text-xs font-extrabold flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(12,81,63,0.18)]"
                >
                  <svg className="w-3.5 h-3.5 text-[#FFC928]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Food for Vendor ↗
                </Link>
              </div>
            </div>

            {/* Bento Statistics Cards for Vendors */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white border-2 border-[#0C513F] rounded-2xl p-5 shadow-[0_4px_20px_rgba(12,81,63,0.06)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0C513F] block">Total Registered Vendors</span>
                <span className="text-3xl font-black text-[#0C513F] mt-1 block">
                  {allVendors.length}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#E4F7EC] text-[#0C513F] rounded-full border border-[#0C513F]/20">
                  All Kitchens
                </span>
              </div>

              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#00B978] block">With Uploaded Dishes</span>
                <span className="text-3xl font-black text-[#111111] mt-1 block">
                  {vendorsWithFoodCount}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#E4F7EC] text-[#0C513F] rounded-full">
                  Has Menu Items
                </span>
              </div>

              <div className="bg-white border border-[#FFC928]/40 rounded-2xl p-5 shadow-[0_4px_20px_rgba(255,201,40,0.06)]">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A5B00] block">No Dishes Yet</span>
                <span className="text-3xl font-black text-[#7A5B00] mt-1 block">
                  {allVendors.length - vendorsWithFoodCount}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-black bg-[#FFF9E6] text-[#7A5B00] rounded-full">
                  Awaiting Food Upload
                </span>
              </div>

              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">Total Menu Dishes</span>
                <span className="text-3xl font-black text-[#111111] mt-1 block">
                  {foodStats.totalItems}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#D5E7FD] text-[#1D4ED8] rounded-full">
                  Across All Vendors
                </span>
              </div>
            </div>

            {/* Search and Filter Toolbar */}
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
              <div className="relative w-full md:w-96">
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2.2" />
                  <path d="m21 21-4.3-4.3" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  placeholder="Search vendor by store name, email, phone, address..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF6EB]/60 border border-gray-200 rounded-full text-xs font-medium text-[#111111] placeholder-gray-400 focus:outline-none focus:border-[#0C513F]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <button
                  onClick={() => setVendorFilter('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    vendorFilter === 'all'
                      ? 'bg-[#0C513F] text-white shadow-sm'
                      : 'bg-[#FAF6EB] text-[#383834] hover:bg-gray-100'
                  }`}
                >
                  All Vendors ({allVendors.length})
                </button>
                <button
                  onClick={() => setVendorFilter('with-food')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    vendorFilter === 'with-food'
                      ? 'bg-[#00B978] text-white shadow-sm'
                      : 'bg-[#E4F7EC] text-[#0C513F] hover:bg-[#d0f3dc]'
                  }`}
                >
                  With Uploaded Dishes ({vendorsWithFoodCount})
                </button>
                <button
                  onClick={() => setVendorFilter('no-food')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                    vendorFilter === 'no-food'
                      ? 'bg-[#FFC928] text-[#111111] shadow-sm font-black'
                      : 'bg-[#FFF9E6] text-[#7A5B00] hover:bg-[#ffefa8]'
                  }`}
                >
                  No Dishes Yet ({allVendors.length - vendorsWithFoodCount})
                </button>
              </div>
            </div>

            {/* Vendors Data Table */}
            <div className="bg-white border border-gray-200/80 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#383834]">
                  <thead className="bg-[#FAF6EB] text-xs uppercase text-[#6E6D66] font-bold border-b border-gray-200/70">
                    <tr>
                      <th className="py-4 px-5 w-12">#</th>
                      <th className="py-4 px-5">Store / Business Name</th>
                      <th className="py-4 px-5">Contact Email</th>
                      <th className="py-4 px-5">Phone Number</th>
                      <th className="py-4 px-5">Pickup Address</th>
                      <th className="py-4 px-5 text-center">Dishes</th>
                      <th className="py-4 px-5">Status</th>
                      <th className="py-4 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {foodLoading ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-[#6E6D66]">
                          <div className="flex items-center justify-center gap-2 font-bold text-xs">
                            <div className="w-4 h-4 border-2 border-[#0C513F] border-t-transparent rounded-full animate-spin"></div>
                            Loading registered vendors...
                          </div>
                        </td>
                      </tr>
                    ) : filteredVendors.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-[#6E6D66]">
                          <p className="text-base font-extrabold text-[#111111]">No vendors matching filter</p>
                          <p className="text-xs text-[#6E6D66] mt-1">Try clearing your search term.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredVendors.map((vendor, idx) => {
                        const dishCount = getVendorDishCount(vendor);
                        const initials = (vendor.businessName || '?')
                          .split(' ')
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        return (
                          <tr key={vendor.id ?? idx} className="hover:bg-[#FAF6EB]/40 transition-colors">
                            <td className="py-3.5 px-5 font-mono text-xs text-gray-400">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                {vendor.image ? (
                                  <img
                                    src={vendor.image}
                                    alt={vendor.businessName}
                                    className="w-9 h-9 rounded-xl object-cover bg-gray-100 border border-[#0C513F]/10 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/15 flex items-center justify-center text-xs font-extrabold text-[#0C513F] flex-shrink-0">
                                    {initials}
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-[#111111] block leading-tight">
                                    {vendor.businessName}
                                  </span>
                                  {vendor.storeId && (
                                    <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                                      {vendor.storeId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-5">
                              {vendor.contactEmail ? (
                                <a
                                  href={`mailto:${vendor.contactEmail}`}
                                  className="text-[#0C513F] font-bold text-xs hover:underline flex items-center gap-1.5"
                                >
                                  <span>✉️</span>
                                  <span>{vendor.contactEmail}</span>
                                </a>
                              ) : (
                                <span className="text-gray-300 text-xs italic">No email set</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 font-mono text-xs">
                              {vendor.ownerPhone ? (
                                <a
                                  href={`tel:${vendor.ownerPhone}`}
                                  className="text-[#111111] hover:underline"
                                >
                                  {vendor.ownerPhone}
                                </a>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-xs text-[#383834] max-w-xs">
                              <span className="line-clamp-1">
                                {vendor.address || <span className="text-gray-300 italic">No address on file</span>}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-center">
                              {dishCount > 0 ? (
                                <button
                                  onClick={() => {
                                    setSelectedVendorFilter(String(vendor.id));
                                    setActiveTab('foods');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#E4F7EC] text-[#0C513F] hover:bg-[#d0f3dc] font-black text-xs rounded-full border border-[#0C513F]/20 transition-colors"
                                  title="View dishes uploaded by this vendor"
                                >
                                  <span>🍲</span>
                                  <span>{dishCount} {dishCount === 1 ? 'Dish' : 'Dishes'}</span>
                                </button>
                              ) : (
                                <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-500 font-bold text-[11px] rounded-full">
                                  0 Dishes
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5">
                              <span
                                className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                                  vendor.status === 'approved'
                                    ? 'bg-[#E4F7EC] text-[#0C513F] border border-[#0C513F]/20'
                                    : 'bg-[#FFF9E6] text-[#7A5B00] border border-[#FFC928]/40'
                                }`}
                              >
                                {vendor.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {dishCount > 0 ? (
                                  <button
                                    onClick={() => {
                                      setSelectedVendorFilter(String(vendor.id));
                                      setActiveTab('foods');
                                    }}
                                    className="px-3 py-1.5 bg-[#FAF6EB] hover:bg-gray-100 text-[#0C513F] rounded-lg text-xs font-bold border border-[#0C513F]/20 transition-colors"
                                  >
                                    View Dishes →
                                  </button>
                                ) : (
                                  <Link
                                    href="/vendor/food/add"
                                    className="px-3 py-1.5 bg-[#0C513F] hover:bg-[#073B2E] text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                  >
                                    + Add Food
                                  </Link>
                                )}
                              </div>
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
        {/* TAB 3: REAL VENDOR UPLOADED FOOD                         */}
        {/* ======================================================== */}
        {activeTab === 'foods' && (
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-[#111111] tracking-tight">Vendor Uploaded Food</h2>
                <p className="text-xs text-[#6E6D66] mt-1">
                  Inspect authentic dishes, pricing models, and photos uploaded by registered campus food vendors.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={loadFoods}
                  disabled={foodLoading}
                  className="px-4 py-2 bg-white hover:bg-[#FAF6EB] text-[#111111] rounded-full text-xs font-bold border border-gray-200 shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-[#0C513F] ${foodLoading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {foodLoading ? 'Refreshing...' : 'Refresh Dishes'}
                </button>

                <Link
                  href="/vendor/food/add"
                  className="px-5 py-2.5 bg-[#0C513F] hover:bg-[#073B2E] text-white rounded-full text-xs font-extrabold flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(12,81,63,0.18)]"
                >
                  <svg className="w-3.5 h-3.5 text-[#FFC928]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Food As Vendor ↗
                </Link>
              </div>
            </div>

            {/* Bento Statistics Cards for Food */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6E6D66] block">Total Dishes</span>
                <span className="text-3xl font-black text-[#111111] mt-1 block">
                  {foodStats.totalItems}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#FAF6EB] text-[#0C513F] rounded-full border border-[#0C513F]/10">
                  Uploaded Dishes
                </span>
              </div>

              <div 
                onClick={() => setSelectedStatusFilter('pending')}
                className="bg-white border border-[#FFC928]/40 hover:border-[#FFC928] rounded-2xl p-5 shadow-[0_4px_20px_rgba(255,201,40,0.08)] cursor-pointer transition-all"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A5B00] block">Pending Verification</span>
                <span className="text-3xl font-black text-[#7A5B00] mt-1 block">
                  {foodStats.pendingItems ?? 0}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-black bg-[#FFF9E6] text-[#7A5B00] border border-[#FFC928]/40 rounded-full">
                  Needs Review ⏳
                </span>
              </div>

              <div 
                onClick={() => setSelectedStatusFilter('approved')}
                className="bg-white border border-[#00B978]/30 hover:border-[#00B978] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,185,120,0.06)] cursor-pointer transition-all"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0C513F] block">Live in Market</span>
                <span className="text-3xl font-black text-[#0C513F] mt-1 block">
                  {foodStats.approvedItems ?? foodStats.availableItems ?? 0}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-black bg-[#E4F7EC] text-[#0C513F] rounded-full">
                  Approved & Live ✓
                </span>
              </div>

              <div 
                onClick={() => setSelectedStatusFilter('rejected')}
                className="bg-white border border-rose-200 hover:border-rose-400 rounded-2xl p-5 shadow-[0_4px_20px_rgba(244,63,94,0.05)] cursor-pointer transition-all"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 block">Rejected</span>
                <span className="text-3xl font-black text-rose-700 mt-1 block">
                  {foodStats.rejectedItems ?? 0}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-rose-50 text-rose-700 rounded-full">
                  Declined ✕
                </span>
              </div>

              <div className="bg-white border border-[#0C513F]/10 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0C513F] block">Registered Stores</span>
                <span className="text-3xl font-black text-[#0C513F] mt-1 block">
                  {foodStats.totalRegisteredVendors}
                </span>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-extrabold bg-[#E4F7EC] text-[#0C513F] rounded-full">
                  Campus Vendors
                </span>
              </div>
            </div>

            {/* Verification Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  selectedStatusFilter === 'all'
                    ? 'bg-[#0C513F] text-white shadow-sm'
                    : 'bg-white text-[#6E6D66] border border-gray-200/80 hover:border-gray-300'
                }`}
              >
                All Foods ({foodStats.totalItems})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('pending')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedStatusFilter === 'pending'
                    ? 'bg-[#FFC928] text-[#111111] shadow-sm font-extrabold ring-2 ring-[#FFC928]/40'
                    : 'bg-white text-[#7A5B00] border border-[#FFC928]/40 hover:bg-[#FFF9E6]'
                }`}
              >
                <span>⏳ Pending Verification</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#7A5B00] text-white">
                  {foodStats.pendingItems ?? 0}
                </span>
              </button>
              <button
                onClick={() => setSelectedStatusFilter('approved')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedStatusFilter === 'approved'
                    ? 'bg-[#00B978] text-white shadow-sm'
                    : 'bg-white text-[#0C513F] border border-[#0C513F]/20 hover:bg-[#E4F7EC]'
                }`}
              >
                <span>✓ Approved & Live</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#0C513F] text-white">
                  {foodStats.approvedItems ?? foodStats.availableItems ?? 0}
                </span>
              </button>
              <button
                onClick={() => setSelectedStatusFilter('rejected')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedStatusFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                }`}
              >
                <span>✕ Rejected</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                  {foodStats.rejectedItems ?? 0}
                </span>
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white border border-gray-200/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
              {/* Search */}
              <div className="relative w-full md:w-72">
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2.2" />
                  <path d="m21 21-4.3-4.3" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Search dish or vendor name..."
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF6EB]/60 border border-gray-200 rounded-full text-xs font-medium text-[#111111] placeholder-gray-400 focus:outline-none focus:border-[#0C513F]"
                />
              </div>

              {/* Dropdowns & View toggles */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Vendor Filter */}
                <select
                  value={selectedVendorFilter}
                  onChange={(e) => setSelectedVendorFilter(e.target.value)}
                  className="bg-[#FAF6EB] border border-gray-200 text-[#111111] text-xs font-bold rounded-full px-3.5 py-2 focus:outline-none focus:border-[#0C513F]"
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
                  className="bg-[#FAF6EB] border border-gray-200 text-[#111111] text-xs font-bold rounded-full px-3.5 py-2 focus:outline-none focus:border-[#0C513F]"
                >
                  <option value="all">All Categories</option>
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-[#FAF6EB] border border-gray-200 rounded-full p-1 ml-auto md:ml-0">
                  <button
                    onClick={() => setFoodViewMode('grid')}
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold transition-colors ${
                      foodViewMode === 'grid' ? 'bg-[#0C513F] text-white' : 'text-[#6E6D66] hover:text-[#111111]'
                    }`}
                    title="Grid View"
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setFoodViewMode('table')}
                    className={`px-2.5 py-1 rounded-full text-xs font-extrabold transition-colors ${
                      foodViewMode === 'table' ? 'bg-[#0C513F] text-white' : 'text-[#6E6D66] hover:text-[#111111]'
                    }`}
                    title="Table View"
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {/* Food Content Display */}
            {foodLoading ? (
              <div className="bg-white border border-gray-200/80 rounded-3xl p-16 text-center text-[#6E6D66]">
                <div className="flex items-center justify-center gap-2 font-bold text-xs">
                  <div className="w-4 h-4 border-2 border-[#0C513F] border-t-transparent rounded-full animate-spin"></div>
                  Loading vendor food uploads...
                </div>
              </div>
            ) : filteredFoods.length === 0 ? (
              /* Empty State */
              <div className="bg-white border border-[#0C513F]/15 rounded-3xl p-12 md:p-16 text-center shadow-sm max-w-2xl mx-auto">
                <div className="w-16 h-16 rounded-full bg-[#E4F7EC] flex items-center justify-center text-3xl mx-auto mb-4">
                  🍲
                </div>
                <h3 className="text-xl font-extrabold text-[#111111] mb-2">
                  No Food Items Found
                </h3>
                <p className="text-xs text-[#6E6D66] max-w-md mx-auto leading-relaxed mb-6">
                  {selectedStatusFilter === 'pending'
                    ? 'No food items are currently pending verification. All submitted dishes have been reviewed.'
                    : selectedStatusFilter === 'approved'
                    ? 'No approved food items are currently live in the marketplace.'
                    : selectedStatusFilter === 'rejected'
                    ? 'No food items have been rejected.'
                    : 'Any real food uploaded by vendors from their dashboard will appear here for verification.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/vendor/food/add"
                    className="w-full sm:w-auto px-6 py-3 bg-[#0C513F] hover:bg-[#073B2E] text-white font-extrabold text-xs rounded-full transition-all shadow-[0_4px_14px_rgba(12,81,63,0.18)]"
                  >
                    + Upload Food As Vendor
                  </Link>
                  <Link
                    href="/vendor"
                    className="w-full sm:w-auto px-6 py-3 bg-[#FAF6EB] hover:bg-gray-100 text-[#0C513F] font-bold text-xs rounded-full border border-[#0C513F]/20 transition-all"
                  >
                    Open Vendor Portal ↗
                  </Link>
                </div>
              </div>
            ) : foodViewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredFoods.map((item) => {
                  const itemStatus = (item.status || '').toLowerCase();
                  const isPending = itemStatus === 'pending_verification' || !item.isPublished;
                  const isRejected = itemStatus === 'rejected';
                  const isApproved = itemStatus === 'available' && item.isPublished;
                  const isBusy = actionLoadingId === item.id;

                  // Determine price label (priceType stored uppercase in DB e.g. "PLATE")
                  const pt = (item.priceType || '').toLowerCase();
                  let priceLabel = `₦${formatPrice(item.price || item.platePrice || item.scoopPrice || item.piecePrice)}`;
                  if (pt === 'plate' && item.platePrice) {
                    priceLabel = `₦${formatPrice(item.platePrice)} / plate`;
                  } else if (pt === 'scoop' && item.scoopPrice) {
                    priceLabel = `₦${formatPrice(item.scoopPrice)} / scoop`;
                  } else if (pt === 'piece' && item.piecePrice) {
                    priceLabel = `₦${formatPrice(item.piecePrice)} / piece`;
                  } else if (pt === 'both') {
                    priceLabel = `₦${formatPrice(item.platePrice)} plate · ₦${formatPrice(item.scoopPrice)} scoop`;
                  }

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all group ${
                        isPending
                          ? 'border-[#FFC928]/60 hover:border-[#FFC928]'
                          : isRejected
                          ? 'border-rose-200/80 hover:border-rose-400'
                          : 'border-gray-200/80 hover:border-[#0C513F]/40'
                      }`}
                    >
                      {/* Top Part: Image & Content */}
                      <div>
                        {/* Food Image */}
                        <div className="h-48 bg-[#FAF6EB] relative overflow-hidden flex items-center justify-center">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-4xl">🍲</span>
                          )}

                          {/* Status Badge */}
                          <div className="absolute top-3 right-3">
                            <span
                              className={`px-3 py-1 text-[11px] font-black rounded-full backdrop-blur-md shadow-sm border flex items-center gap-1 ${
                                isPending
                                  ? 'bg-[#FFF9E6]/95 text-[#7A5B00] border-[#FFC928]/60'
                                  : isRejected
                                  ? 'bg-rose-50/95 text-rose-700 border-rose-200'
                                  : 'bg-[#E4F7EC]/95 text-[#0C513F] border-[#0C513F]/20'
                              }`}
                            >
                              {isPending ? '⏳ Pending Verification' : isRejected ? '✕ Rejected' : '✓ Live in Marketplace'}
                            </span>
                          </div>

                          {/* Category Pill */}
                          <div className="absolute bottom-3 left-3">
                            <span className="px-2.5 py-1 text-[10px] font-black bg-white/95 text-[#111111] rounded-full shadow-sm uppercase tracking-wider">
                              {item.category || 'General'}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                          {/* Vendor Name & Contact Info */}
                          <div className="flex flex-col gap-0.5 mb-2">
                            <div className="flex items-center gap-1.5 text-xs text-[#0C513F] font-black uppercase tracking-wider">
                              <span>🏪</span>
                              <span className="truncate">{item.vendorName || `Store #${item.vendorId}`}</span>
                            </div>
                            {item.vendorEmail && (
                              <div className="flex items-center gap-1 text-[11px] text-[#6E6D66] font-medium truncate">
                                <span>✉️</span>
                                <a href={`mailto:${item.vendorEmail}`} className="hover:underline hover:text-[#0C513F] truncate">
                                  {item.vendorEmail}
                                </a>
                                {item.vendorPhone && (
                                  <>
                                    <span className="text-gray-300">·</span>
                                    <a href={`tel:${item.vendorPhone}`} className="hover:underline hover:text-[#111111] whitespace-nowrap">
                                      {item.vendorPhone}
                                    </a>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Food Name */}
                          <h3 
                            onClick={() => setPreviewFoodItem(item)}
                            className="text-base font-extrabold text-[#111111] group-hover:text-[#0C513F] transition-colors line-clamp-1 cursor-pointer"
                          >
                            {item.name}
                          </h3>

                          {/* Description */}
                          {item.description && (
                            <p className="text-xs text-[#6E6D66] mt-1.5 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                          )}

                          {/* Price & Variants Footnote */}
                          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6D66] block">Price</span>
                              <span className="text-base font-black text-[#111111]">
                                {priceLabel}
                              </span>
                            </div>

                            {/* Sizes / Extras Pill */}
                            {(item.sizes?.length > 0 || item.extras?.length > 0) && (
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-[#0C513F] bg-[#FAF6EB] px-2.5 py-1 rounded-full border border-[#0C513F]/10">
                                  {item.sizes?.length > 0 ? `${item.sizes.length} sizes` : ''}
                                  {item.sizes?.length > 0 && item.extras?.length > 0 ? ' · ' : ''}
                                  {item.extras?.length > 0 ? `${item.extras.length} extras` : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Verification Actions Bar */}
                      <div className="p-4 bg-[#FAF6EB]/50 border-t border-gray-100 flex items-center gap-2">
                        <button
                          onClick={() => setPreviewFoodItem(item)}
                          className="flex-1 py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200/90 text-[#111111] font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5 text-[#0C513F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview
                        </button>

                        {isPending ? (
                          <>
                            <button
                              disabled={isBusy}
                              onClick={() => handleFoodAction(item.id, 'approve')}
                              className="py-2 px-3.5 bg-[#00B978] hover:bg-[#009661] text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 disabled:opacity-50"
                            >
                              {isBusy ? '...' : '✓ Approve'}
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => handleFoodAction(item.id, 'reject')}
                              className="py-2 px-2.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-extrabold text-xs rounded-xl transition-all disabled:opacity-50"
                              title="Reject dish"
                            >
                              ✕
                            </button>
                          </>
                        ) : isApproved ? (
                          <button
                            disabled={isBusy}
                            onClick={() => handleFoodAction(item.id, 'reject')}
                            className="py-2 px-3 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                          >
                            {isBusy ? '...' : 'Reject / Hide'}
                          </button>
                        ) : (
                          <button
                            disabled={isBusy}
                            onClick={() => handleFoodAction(item.id, 'approve')}
                            className="py-2 px-3 bg-[#0C513F] hover:bg-[#073B2E] text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                          >
                            {isBusy ? '...' : 'Re-Approve'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="bg-white border border-gray-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#383834]">
                    <thead className="bg-[#FAF6EB] text-xs uppercase text-[#6E6D66] font-bold border-b border-gray-200/70">
                      <tr>
                        <th className="py-4 px-5">Dish</th>
                        <th className="py-4 px-5">Vendor</th>
                        <th className="py-4 px-5">Category</th>
                        <th className="py-4 px-5">Price</th>
                        <th className="py-4 px-5">Price Model</th>
                        <th className="py-4 px-5">Verification Status</th>
                        <th className="py-4 px-5">Uploaded Date</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredFoods.map((item) => {
                        const itemStatus = (item.status || '').toLowerCase();
                        const isPending = itemStatus === 'pending_verification' || !item.isPublished;
                        const isRejected = itemStatus === 'rejected';
                        const isApproved = itemStatus === 'available' && item.isPublished;
                        const isBusy = actionLoadingId === item.id;

                        return (
                          <tr key={item.id} className="hover:bg-[#FAF6EB]/40 transition-colors">
                            <td className="py-3.5 px-5">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-10 h-10 rounded-xl object-cover bg-gray-100 border border-gray-200 flex-shrink-0 cursor-pointer"
                                    onClick={() => setPreviewFoodItem(item)}
                                  />
                                ) : (
                                  <div 
                                    onClick={() => setPreviewFoodItem(item)}
                                    className="w-10 h-10 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/15 flex items-center justify-center text-lg flex-shrink-0 cursor-pointer"
                                  >
                                    🍲
                                  </div>
                                )}
                                <div>
                                  <span 
                                    onClick={() => setPreviewFoodItem(item)}
                                    className="font-bold text-[#111111] block cursor-pointer hover:text-[#0C513F] transition-colors"
                                  >
                                    {item.name}
                                  </span>
                                  {item.description && (
                                    <span className="text-xs text-[#6E6D66] line-clamp-1 max-w-xs">
                                      {item.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="text-xs font-bold text-[#0C513F] block">
                                {item.vendorName || `Store #${item.vendorId}`}
                              </span>
                              {item.vendorEmail && (
                                <a
                                  href={`mailto:${item.vendorEmail}`}
                                  className="text-[11px] text-[#0C513F]/80 hover:text-[#0C513F] hover:underline block mt-0.5"
                                >
                                  ✉️ {item.vendorEmail}
                                </a>
                              )}
                              {item.vendorPhone && (
                                <a
                                  href={`tel:${item.vendorPhone}`}
                                  className="text-[10px] text-gray-400 hover:text-[#111111] hover:underline font-mono block"
                                >
                                  📞 {item.vendorPhone}
                                </a>
                              )}
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="px-2.5 py-1 text-xs rounded-full bg-[#FAF6EB] border border-[#0C513F]/10 font-bold text-[#111111]">
                                {item.category || 'General'}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 font-mono font-extrabold text-[#111111] text-xs">
                              ₦{formatPrice(item.price || item.platePrice || item.piecePrice || item.scoopPrice)}
                            </td>
                            <td className="py-3.5 px-5 text-xs uppercase text-[#6E6D66] font-mono">
                              {item.priceType || 'plate'}
                            </td>
                            <td className="py-3.5 px-5">
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full ${
                                  isPending
                                    ? 'bg-[#FFF9E6] text-[#7A5B00] border border-[#FFC928]/40'
                                    : isRejected
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-[#E4F7EC] text-[#0C513F] border border-[#0C513F]/20'
                                }`}
                              >
                                {isPending ? '⏳ Pending Verification' : isRejected ? '✕ Rejected' : '✓ Live in Market'}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-xs text-[#6E6D66] whitespace-nowrap">
                              {formatDate(item.createdAt)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setPreviewFoodItem(item)}
                                  className="px-2.5 py-1.5 text-xs font-bold bg-[#FAF6EB] hover:bg-gray-100 text-[#0C513F] border border-[#0C513F]/20 rounded-lg transition-colors"
                                >
                                  Preview
                                </button>
                                {isPending ? (
                                  <>
                                    <button
                                      disabled={isBusy}
                                      onClick={() => handleFoodAction(item.id, 'approve')}
                                      className="px-2.5 py-1.5 text-xs font-extrabold bg-[#00B978] hover:bg-[#009661] text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {isBusy ? '...' : 'Approve'}
                                    </button>
                                    <button
                                      disabled={isBusy}
                                      onClick={() => handleFoodAction(item.id, 'reject')}
                                      className="px-2 py-1.5 text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : isApproved ? (
                                  <button
                                    disabled={isBusy}
                                    onClick={() => handleFoodAction(item.id, 'reject')}
                                    className="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                ) : (
                                  <button
                                    disabled={isBusy}
                                    onClick={() => handleFoodAction(item.id, 'approve')}
                                    className="px-2.5 py-1.5 text-xs font-bold bg-[#0C513F] hover:bg-[#073B2E] text-white rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                )}
                              </div>
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

      {/* ------------------------------------------------------------- */}
      {/* RICH FOOD PREVIEW & VERIFICATION MODAL                        */}
      {/* ------------------------------------------------------------- */}
      {previewFoodItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewFoodItem(null)}
        >
          <div 
            className="bg-white border border-[#0C513F]/15 rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-xs font-black bg-[#FAF6EB] text-[#0C513F] rounded-full border border-[#0C513F]/15 uppercase tracking-wider">
                  {previewFoodItem.category || 'Food Item'}
                </span>
                <span className="text-xs font-bold text-[#6E6D66]">
                  ID: <span className="font-mono">{previewFoodItem.id.slice(0, 8)}...</span>
                </span>
              </div>
              <button 
                onClick={() => setPreviewFoodItem(null)}
                className="w-9 h-9 rounded-full bg-[#FAF6EB] hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Marketplace Status Banner */}
            {(() => {
              const status = (previewFoodItem.status || '').toLowerCase();
              const isPending = status === 'pending_verification' || !previewFoodItem.isPublished;
              const isRejected = status === 'rejected';

              if (isPending) {
                return (
                  <div className="mb-6 p-4 rounded-2xl bg-[#FFF9E6] border border-[#FFC928]/60 flex items-start gap-3">
                    <span className="text-2xl leading-none">⏳</span>
                    <div>
                      <h4 className="text-sm font-extrabold text-[#7A5B00]">Pending Admin Verification</h4>
                      <p className="text-xs text-[#8A6700] mt-0.5 leading-relaxed">
                        This food item is currently <strong>hidden from customers</strong> in the marketplace. Click <strong>Approve & Publish Live</strong> below to make it immediately available for ordering.
                      </p>
                    </div>
                  </div>
                );
              }
              if (isRejected) {
                return (
                  <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                    <span className="text-2xl leading-none">🚫</span>
                    <div>
                      <h4 className="text-sm font-extrabold text-rose-800">Food Item Rejected</h4>
                      <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                        This food item was rejected and is not visible to customers. You can re-approve it at any time.
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="mb-6 p-4 rounded-2xl bg-[#E4F7EC] border border-[#0C513F]/20 flex items-start gap-3">
                  <span className="text-2xl leading-none">✅</span>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0C513F]">Live in Marketplace</h4>
                    <p className="text-xs text-[#073B2E] mt-0.5 leading-relaxed">
                      This food item is approved and actively visible to students and customers on the Chow45 marketplace.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Food Image & Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Image Preview */}
              <div className="h-60 rounded-2xl bg-[#FAF6EB] border border-gray-200 overflow-hidden flex items-center justify-center relative">
                {previewFoodItem.imageUrl ? (
                  <img 
                    src={previewFoodItem.imageUrl} 
                    alt={previewFoodItem.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="text-center p-6">
                    <span className="text-5xl block mb-2">🍲</span>
                    <span className="text-xs font-bold text-[#6E6D66]">No Photo Uploaded</span>
                  </div>
                )}
              </div>

              {/* Vendor & Details */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#0C513F] font-black uppercase tracking-wider mb-1">
                    <span>🏪</span>
                    <span>{previewFoodItem.vendorName || `Vendor #${previewFoodItem.vendorId}`}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-[#111111] leading-tight">
                    {previewFoodItem.name}
                  </h2>
                  {previewFoodItem.description && (
                    <p className="text-xs text-[#6E6D66] mt-2 leading-relaxed">
                      {previewFoodItem.description}
                    </p>
                  )}
                </div>

                {/* Vendor Contact Box */}
                <div className="p-3.5 bg-[#FAF6EB] rounded-2xl border border-[#0C513F]/10 space-y-1.5 text-xs">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0C513F] block">
                    Vendor Contact
                  </span>
                  {previewFoodItem.vendorPhone ? (
                    <div className="flex items-center gap-2 text-[#111111] font-semibold">
                      <span>📞</span>
                      <a href={`tel:${previewFoodItem.vendorPhone}`} className="hover:underline text-[#0C513F]">
                        {previewFoodItem.vendorPhone}
                      </a>
                    </div>
                  ) : null}
                  {previewFoodItem.vendorEmail ? (
                    <div className="flex items-center gap-2 text-[#6E6D66]">
                      <span>✉️</span>
                      <a href={`mailto:${previewFoodItem.vendorEmail}`} className="hover:underline">
                        {previewFoodItem.vendorEmail}
                      </a>
                    </div>
                  ) : null}
                  <div className="text-[11px] text-[#8E8D86]">
                    Submitted: {formatDate(previewFoodItem.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing Model Section */}
            <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 mb-6">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6E6D66] block mb-2">
                Pricing Model ({previewFoodItem.priceType.toUpperCase()})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {previewFoodItem.platePrice ? (
                  <div className="p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-[#6E6D66] uppercase block">Plate Price</span>
                    <span className="text-base font-black text-[#111111]">₦{formatPrice(previewFoodItem.platePrice)}</span>
                  </div>
                ) : null}
                {previewFoodItem.scoopPrice ? (
                  <div className="p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-[#6E6D66] uppercase block">Scoop Price</span>
                    <span className="text-base font-black text-[#111111]">₦{formatPrice(previewFoodItem.scoopPrice)}</span>
                  </div>
                ) : null}
                {previewFoodItem.piecePrice ? (
                  <div className="p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-[#6E6D66] uppercase block">Piece Price</span>
                    <span className="text-base font-black text-[#111111]">₦{formatPrice(previewFoodItem.piecePrice)}</span>
                  </div>
                ) : null}
                {!previewFoodItem.platePrice && !previewFoodItem.scoopPrice && !previewFoodItem.piecePrice && (
                  <div className="p-3 bg-white rounded-xl border border-gray-200">
                    <span className="text-[10px] font-bold text-[#6E6D66] uppercase block">Base Price</span>
                    <span className="text-base font-black text-[#111111]">₦{formatPrice(previewFoodItem.price)}</span>
                  </div>
                )}
              </div>

              {/* Sizes Variants */}
              {previewFoodItem.sizes && previewFoodItem.sizes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6D66] block mb-1.5">
                    Size Variants ({previewFoodItem.sizes.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {previewFoodItem.sizes.map((s, idx) => (
                      <span key={idx} className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#111111]">
                        {s.name}: <span className="text-[#0C513F] font-black">₦{formatPrice(s.price)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Extras Section */}
            {previewFoodItem.extras && previewFoodItem.extras.length > 0 && (
              <div className="p-4 bg-[#FAF6EB]/60 rounded-2xl border border-[#0C513F]/10 mb-6">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0C513F] block mb-2">
                  Menu Extras & Addons ({previewFoodItem.extras.length})
                </span>
                <div className="space-y-2">
                  {previewFoodItem.extras.map((ex, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-200 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          ex.extraType === 'REQUIRED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {ex.extraType === 'REQUIRED' ? 'Compulsory' : 'Optional'}
                        </span>
                        <span className="font-bold text-[#111111]">{ex.name}</span>
                      </div>
                      <span className="font-mono font-extrabold text-[#0C513F]">
                        {ex.price > 0 ? `+₦${formatPrice(ex.price)}` : 'Free'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Action Footer */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                onClick={() => setPreviewFoodItem(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#111111] font-bold text-xs rounded-full transition-colors"
              >
                Close
              </button>

              {(() => {
                const status = (previewFoodItem.status || '').toLowerCase();
                const isPending = status === 'pending_verification' || !previewFoodItem.isPublished;
                const isRejected = status === 'rejected';
                const isBusy = actionLoadingId === previewFoodItem.id;

                if (isPending) {
                  return (
                    <>
                      <button
                        disabled={isBusy}
                        onClick={() => handleFoodAction(previewFoodItem.id, 'reject')}
                        className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-rose-50 border border-rose-300 text-rose-600 font-extrabold text-xs rounded-full transition-all disabled:opacity-50"
                      >
                        ✕ Reject Food
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => handleFoodAction(previewFoodItem.id, 'approve')}
                        className="w-full sm:w-auto px-6 py-2.5 bg-[#00B978] hover:bg-[#009661] text-white font-extrabold text-xs rounded-full transition-all shadow-[0_4px_14px_rgba(0,185,120,0.25)] flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isBusy ? 'Processing...' : '✓ Approve & Publish Live'}
                      </button>
                    </>
                  );
                }

                if (isRejected) {
                  return (
                    <button
                      disabled={isBusy}
                      onClick={() => handleFoodAction(previewFoodItem.id, 'approve')}
                      className="w-full sm:w-auto px-6 py-2.5 bg-[#0C513F] hover:bg-[#073B2E] text-white font-extrabold text-xs rounded-full transition-all shadow-sm disabled:opacity-50"
                    >
                      {isBusy ? 'Processing...' : '✓ Re-Approve Food'}
                    </button>
                  );
                }

                return (
                  <button
                    disabled={isBusy}
                    onClick={() => handleFoodAction(previewFoodItem.id, 'reject')}
                    className="w-full sm:w-auto px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs rounded-full transition-all disabled:opacity-50"
                  >
                    {isBusy ? 'Processing...' : '✕ Revoke / Reject Food'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0C513F] text-white font-extrabold text-xs px-5 py-3.5 rounded-2xl shadow-xl border border-[#FFC928]/30 flex items-center gap-2 animate-bounce-in">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
