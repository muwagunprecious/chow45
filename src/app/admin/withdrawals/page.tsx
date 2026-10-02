'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface WithdrawalRow {
  id: string;
  riderId: string;
  riderName: string;
  riderPhone: string | null;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  payoutReference: string | null;
  createdAt: string;
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_ADMIN_APPROVAL' | 'PAID' | 'REJECTED'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal for Mark Paid or Reject
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRow | null>(null);
  const [modalAction, setModalAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [referenceInput, setReferenceInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/withdrawals', window.location.origin);
      if (statusFilter !== 'ALL') url.searchParams.set('status', statusFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok && data.withdrawals) {
        setWithdrawals(data.withdrawals);
      }
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const handleProcess = async () => {
    if (!selectedWithdrawal || !modalAction) return;
    setActionLoading(selectedWithdrawal.id);

    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalId: selectedWithdrawal.id,
          action: modalAction,
          reference: referenceInput.trim() || undefined,
          reason: reasonInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process withdrawal');

      showToast(data.message || 'Withdrawal status updated.');
      setSelectedWithdrawal(null);
      setModalAction(null);
      setReferenceInput('');
      setReasonInput('');
      loadWithdrawals();
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
              Operations • Rider Withdrawals
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/riders"
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#0C513F]/20 text-[#0C513F] hover:bg-[#0C513F]/5"
            >
              ← Rider Fleet
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
        <div className="mb-6">
          <h1 className="text-2xl font-black text-[#0C513F]">Rider Payout Requests</h1>
          <p className="text-xs text-[#111111]/70 mt-1">
            Audit and approve bank payouts for completed campus deliveries. Funds are reserved safely in real-time.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {(['ALL', 'PENDING_ADMIN_APPROVAL', 'PAID', 'REJECTED'] as const).map((tab) => (
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
                ? 'All Withdrawals'
                : tab === 'PENDING_ADMIN_APPROVAL'
                ? '⏳ Pending Payout'
                : tab === 'PAID'
                ? '✓ Paid / Disbursed'
                : '❌ Rejected'}
            </button>
          ))}
        </div>

        {/* Table of Withdrawals */}
        <div className="bg-[#FFFDF6] rounded-3xl border border-[#0C513F]/15 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-[#0C513F] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-[#0C513F]">Loading payout requests...</p>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-bold text-[#111111]/70">No withdrawal requests found under this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6EB] border-b border-[#0C513F]/10 text-[#0C513F] uppercase font-extrabold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Rider</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Destination Bank Account</th>
                    <th className="py-3 px-4">Status & Reference</th>
                    <th className="py-3 px-4">Date Requested</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0C513F]/10">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-[#FAF6EB]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-extrabold text-sm text-[#111111]">{w.riderName}</p>
                        <p className="text-[#111111]/60 text-[11px]">{w.riderPhone || 'No phone'}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-mono font-black text-sm text-[#0C513F]">
                          ₦{w.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[#111111]/50">Net Payout: ₦{w.netAmount.toLocaleString()}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-[#111111]">{w.bankName}</p>
                        <p className="font-mono text-xs text-[#0C513F]">{w.accountNumber}</p>
                        <p className="text-[11px] text-[#111111]/60">{w.accountName}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                            w.status === 'PAID'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : w.status === 'PENDING_ADMIN_APPROVAL'
                              ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}
                        >
                          {w.status === 'PENDING_ADMIN_APPROVAL' ? 'Pending Approval' : w.status}
                        </span>
                        {w.payoutReference && (
                          <p className="text-[10px] font-mono text-[#111111]/60 mt-1">
                            Ref: {w.payoutReference}
                          </p>
                        )}
                        {w.rejectionReason && (
                          <p className="text-[10px] text-red-600 font-medium mt-1">
                            Reason: {w.rejectionReason}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#111111]/70">
                        {new Date(w.createdAt).toLocaleDateString()} at{' '}
                        {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {w.status === 'PENDING_ADMIN_APPROVAL' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedWithdrawal(w);
                                setModalAction('APPROVE');
                                setReferenceInput(`PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
                              }}
                              disabled={actionLoading === w.id}
                              className="px-3 py-1.5 rounded-lg bg-[#0C513F] text-white font-bold text-[11px] shadow-sm hover:bg-[#0a4334]"
                            >
                              Disburse Payout ✓
                            </button>

                            <button
                              onClick={() => {
                                setSelectedWithdrawal(w);
                                setModalAction('REJECT');
                              }}
                              disabled={actionLoading === w.id}
                              className="px-3 py-1.5 rounded-lg border border-red-300 text-red-600 font-bold text-[11px] hover:bg-red-50"
                            >
                              Reject ✕
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ACTION MODAL */}
      {selectedWithdrawal && modalAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFDF6] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#0C513F]/15 animate-scale-up">
            <h3 className="font-black text-base text-[#111111] mb-1">
              {modalAction === 'APPROVE' ? 'Confirm Payout Disbursement' : 'Reject Withdrawal Request'}
            </h3>
            <p className="text-xs text-[#111111]/70 mb-4">
              Rider: <strong className="text-[#0C513F]">{selectedWithdrawal.riderName}</strong> •{' '}
              <strong className="text-[#0C513F]">₦{selectedWithdrawal.amount.toLocaleString()}</strong>
            </p>

            {modalAction === 'APPROVE' ? (
              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-xl bg-[#FAF6EB] text-xs space-y-1">
                  <p>
                    <span className="text-[#111111]/60">Bank:</span>{' '}
                    <strong>{selectedWithdrawal.bankName}</strong>
                  </p>
                  <p>
                    <span className="text-[#111111]/60">Account Number:</span>{' '}
                    <strong className="font-mono">{selectedWithdrawal.accountNumber}</strong>
                  </p>
                  <p>
                    <span className="text-[#111111]/60">Account Name:</span>{' '}
                    <strong>{selectedWithdrawal.accountName}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    Bank Transfer / NIP Reference Code
                  </label>
                  <input
                    type="text"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    placeholder="e.g. NIP-837261947"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0C513F]"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                <p className="text-xs text-red-600">
                  Rejecting this payout will automatically refund the ₦{selectedWithdrawal.amount.toLocaleString()} back to the rider&apos;s available wallet balance.
                </p>
                <div>
                  <label className="block text-xs font-bold text-[#0C513F] mb-1">
                    Rejection Reason
                  </label>
                  <textarea
                    rows={2}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="e.g. Account name mismatch, incorrect NUBAN..."
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-xs focus:outline-none focus:ring-2 focus:ring-[#0C513F]"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedWithdrawal(null);
                  setModalAction(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-[#0C513F]/20 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleProcess}
                disabled={actionLoading === selectedWithdrawal.id}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-md ${
                  modalAction === 'APPROVE' ? 'bg-[#0C513F] hover:bg-[#0a4334]' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {modalAction === 'APPROVE' ? 'Confirm Disbursed' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
