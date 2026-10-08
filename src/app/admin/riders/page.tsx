'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface RiderRow {
  id: string;
  name: string;
  phone: string | null;
  vehicle: string | null;
  avatar: string | null;
  location: string | null;
  identityMethod: string | null;
  identityNumber: string | null;
  institution: string | null;
  applicationStatus: string;
  approvalStatus: string;
  rejectionReason: string | null;
  suspensionReason: string | null;
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  tripsCount: number;
  approvedAt: string | null;
  createdAt: string;
  walletAvailable: number | null;
  walletTotalEarned: number | null;
}

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<RiderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal for reject/suspend reason
  const [selectedRider, setSelectedRider] = useState<RiderRow | null>(null);
  const [actionType, setActionType] = useState<'REJECT' | 'SUSPEND' | null>(null);
  const [reasonInput, setReasonInput] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadRiders = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/riders', window.location.origin);
      if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter);
      if (searchQuery.trim()) url.searchParams.set('q', searchQuery.trim());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok && data.riders) {
        setRiders(data.riders);
      }
    } catch (err) {
      console.error('Failed to load riders:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadRiders();
  }, [loadRiders]);

  const handleAction = async (riderId: string, action: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE', reason?: string) => {
    setActionLoading(riderId);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      showToast(data.message || `Rider ${action.toLowerCase()}d successfully.`);
      setSelectedRider(null);
      setActionType(null);
      setReasonInput('');
      loadRiders();
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EB] text-[#111111] font-sans antialiased selection:bg-[#0C513F] selection:text-white">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#0C513F] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xl border border-white/20 animate-fade-in flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FAF6EB]/90 backdrop-blur-md border-b border-[#0C513F]/10 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-full bg-[#0C513F] text-white flex items-center justify-center font-black text-sm tracking-tighter group-hover:scale-105 transition-transform">
                45
              </span>
              <span className="font-bold text-lg tracking-tight text-[#0C513F]">
                CHOW<span className="text-[#E75A24]">45</span>
              </span>
            </Link>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0C513F] bg-[#0C513F]/10 px-2.5 py-1 rounded-full border border-[#0C513F]/20">
              Operations • Rider Approvals
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/withdrawals"
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#0C513F]/20 text-[#0C513F] hover:bg-[#0C513F]/5"
            >
              Rider Withdrawals →
            </Link>
            <Link
              href="/admin"
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#0C513F] text-white"
            >
              Main Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#0C513F]">Rider Fleet Management</h1>
            <p className="text-xs text-[#111111]/70 mt-1">
              Verify identity documents (NIN / Matriculation), approve campus dispatchers, and audit status.
            </p>
          </div>

          {/* Search Bar */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, NIN, campus..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#FFFDF6] border border-[#0C513F]/20 text-xs text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#0C513F]"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {(['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? 'bg-[#0C513F] text-white shadow-sm'
                  : 'bg-[#FFFDF6] text-[#111111]/70 border border-[#0C513F]/15 hover:bg-[#FAF6EB]'
              }`}
            >
              {tab === 'ALL'
                ? 'All Riders'
                : tab === 'PENDING_REVIEW'
                ? '⏳ Pending Review'
                : tab === 'APPROVED'
                ? '✓ Approved'
                : tab === 'REJECTED'
                ? '❌ Rejected'
                : '⚠️ Suspended'}
            </button>
          ))}
        </div>

        {/* Table of Riders */}
        <div className="bg-[#FFFDF6] rounded-3xl border border-[#0C513F]/15 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-[#0C513F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-[#0C513F]">Loading fleet records...</p>
            </div>
          ) : riders.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-bold text-[#111111]/70">No rider accounts found matching this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6EB] border-b border-[#0C513F]/10 text-[#0C513F] uppercase font-extrabold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Rider</th>
                    <th className="py-3 px-4">Identity Verification</th>
                    <th className="py-3 px-4">Vehicle & Campus</th>
                    <th className="py-3 px-4">Wallet Balance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0C513F]/10">
                  {riders.map((r) => {
                    const status = (r.applicationStatus || r.approvalStatus || 'PENDING_REVIEW').toUpperCase();
                    return (
                      <tr key={r.id} className="hover:bg-[#FAF6EB]/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 flex items-center justify-center overflow-hidden shrink-0">
                              {r.avatar ? (
                                <img src={r.avatar} alt={r.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg">👤</span>
                              )}
                            </div>
                            <div>
                              <p className="font-extrabold text-sm text-[#111111]">{r.name}</p>
                              <p className="text-[#111111]/60 text-[11px]">{r.phone || 'No phone'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#0C513F] block">
                            {r.identityMethod || 'NIN'}:
                          </span>
                          <span className="font-mono text-xs bg-[#FAF6EB] px-2 py-0.5 rounded border border-[#0C513F]/10">
                            {r.identityNumber || 'Not provided'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#111111]">{r.vehicle || 'Bicycle'}</p>
                          <p className="text-[11px] text-[#111111]/60">{r.institution || r.location || 'General Hub'}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-mono font-bold text-[#0C513F]">
                            ₦{(r.walletAvailable ?? 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[#111111]/50">
                            Earned: ₦{(r.walletTotalEarned ?? 0).toLocaleString()} ({r.tripsCount} trips)
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              status === 'APPROVED'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : status === 'PENDING_REVIEW' || status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                                : status === 'REJECTED'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : 'bg-neutral-100 text-neutral-800 border-neutral-300'
                            }`}
                          >
                            {status}
                          </span>
                          {r.isOnline && (
                            <span className="ml-1 text-[10px] font-bold text-green-600">● Live Online</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {status !== 'APPROVED' && (
                              <button
                                onClick={() => handleAction(r.id, 'APPROVE')}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-lg bg-[#0C513F] text-white font-bold text-[11px] shadow-sm hover:bg-[#0a4334]"
                              >
                                Approve ✓
                              </button>
                            )}

                            {status === 'PENDING_REVIEW' && (
                              <button
                                onClick={() => {
                                  setSelectedRider(r);
                                  setActionType('REJECT');
                                }}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 font-bold text-[11px] hover:bg-red-50"
                              >
                                Reject ✕
                              </button>
                            )}

                            {status === 'APPROVED' && (
                              <button
                                onClick={() => {
                                  setSelectedRider(r);
                                  setActionType('SUSPEND');
                                }}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 font-bold text-[11px] hover:bg-amber-50"
                              >
                                Suspend ⚠️
                              </button>
                            )}

                            {status === 'SUSPENDED' && (
                              <button
                                onClick={() => handleAction(r.id, 'REACTIVATE')}
                                disabled={actionLoading === r.id}
                                className="px-3 py-1.5 rounded-lg bg-green-700 text-white font-bold text-[11px]"
                              >
                                Reactivate
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
          )}
        </div>
      </main>

      {/* REJECT / SUSPEND MODAL */}
      {selectedRider && actionType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF6] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#0C513F]/15 animate-scale-up">
            <h3 className="font-black text-base text-[#111111] mb-1">
              {actionType === 'REJECT' ? 'Reject Application' : 'Suspend Rider Account'}
            </h3>
            <p className="text-xs text-[#111111]/70 mb-4">
              Rider: <strong className="text-[#0C513F]">{selectedRider.name}</strong>
            </p>

            <label className="block text-xs font-bold text-[#0C513F] mb-1">
              Reason / Explanation (Visible to Rider)
            </label>
            <textarea
              rows={3}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="e.g. Unclear NIN document, image blurry, campus mismatch..."
              className="w-full px-3 py-2 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C513F] mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedRider(null);
                  setActionType(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#0C513F]/20 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(selectedRider.id, actionType, reasonInput)}
                disabled={actionLoading === selectedRider.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md hover:bg-red-700"
              >
                Confirm {actionType}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
