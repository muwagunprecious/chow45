'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { riderAuthClient } from '@/lib/auth-client';

interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  avatar: string | null;
  location: string;
  identityMethod: string;
  identityNumber: string | null;
  institution: string;
  applicationStatus: string;
  approvalStatus: string;
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  tripsCount: number;
}

interface WalletState {
  available: number;
  processing: number;
  totalEarned: number;
  currency: string;
}

interface DeliveryOffer {
  id: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  deliveryFee: number;
  total: number;
  itemCount: number;
  status: string;
  createdAt: string;
  estimatedDurationMinutes: number;
}

interface ActiveMission {
  id: string;
  storeName: string;
  storeAddress?: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: string;
  pin?: string;
  items: Array<{ id: number; name: string; qty: number; unitPrice: number }>;
  vendor?: {
    businessName: string;
    address: string | null;
    ownerPhone: string | null;
  };
}

interface Transaction {
  id: string;
  type: string;
  direction: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description: string | null;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  fullAccountNumber?: string;
  isDefault: boolean;
}

export default function RiderDashboardPage() {
  const router = useRouter();

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<'radar' | 'mission' | 'wallet' | 'profile'>('radar');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Rider Data
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [wallet, setWallet] = useState<WalletState>({
    available: 0,
    processing: 0,
    totalEarned: 0,
    currency: 'NGN',
  });
  const [stats, setStats] = useState({
    todayEarnings: 0,
    todayTrips: 0,
    rating: 5.0,
    allTimeTrips: 0,
  });

  // Missions & Offers
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [activeMission, setActiveMission] = useState<ActiveMission | null>(null);

  // Completion PIN
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [completionReward, setCompletionReward] = useState<number | null>(null);

  // Financials & Bank Accounts
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // Bank Form Modal
  const [showBankModal, setShowBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('Opay');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [bankFormError, setBankFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Rider Profile & Mission
  const loadRiderState = useCallback(async () => {
    try {
      const res = await fetch('/api/rider/me');
      if (res.status === 401) {
        router.push('/rider/login');
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        if (data.applicationStatus === 'PENDING_REVIEW') {
          router.push('/rider/application-status');
          return;
        }
        throw new Error(data.message || 'Failed to load rider details');
      }

      setRider(data.rider);
      setWallet(data.wallet);
      setStats(data.stats);

      if (data.activeDelivery) {
        setActiveMission(data.activeDelivery);
        // Automatically switch to mission tab if on radar
        setActiveTab((prev) => (prev === 'radar' ? 'mission' : prev));
      } else {
        setActiveMission(null);
      }
    } catch (err: any) {
      console.error('Error fetching rider state:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 2. Fetch Radar Offers
  const loadOffers = useCallback(async () => {
    if (!rider?.isOnline || activeMission) {
      setOffers([]);
      return;
    }
    try {
      const res = await fetch('/api/rider/deliveries/offers');
      const data = await res.json();
      if (res.ok && data.offers) {
        setOffers(data.offers);
      }
    } catch (err) {
      console.error('Radar poll error:', err);
    }
  }, [rider?.isOnline, activeMission]);

  // 3. Fetch Wallet Ledger & Accounts
  const loadWalletDetails = useCallback(async () => {
    try {
      const res = await fetch('/api/rider/wallet');
      const data = await res.json();
      if (res.ok) {
        setTransactions(data.transactions || []);
        setBankAccounts(data.bankAccounts || []);
        if (data.wallet) setWallet(data.wallet);
      }
    } catch (err) {
      console.error('Wallet fetch error:', err);
    }
  }, []);

  useEffect(() => {
    loadRiderState();
  }, [loadRiderState]);

  // Polling for offers when online and no active mission
  useEffect(() => {
    if (!rider?.isOnline || activeMission) return;
    loadOffers();
    const interval = setInterval(loadOffers, 5000);
    return () => clearInterval(interval);
  }, [rider?.isOnline, activeMission, loadOffers]);

  // Load wallet when switching to wallet tab
  useEffect(() => {
    if (activeTab === 'wallet') {
      loadWalletDetails();
    }
  }, [activeTab, loadWalletDetails]);

  // Toggle Online Status
  const handleToggleOnline = async () => {
    if (!rider) return;
    const targetStatus = !rider.isOnline;
    setActionLoading(true);
    try {
      const res = await fetch('/api/rider/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update online state');
      setRider((prev: any) => ({ ...prev, isOnline: targetStatus }));
      showToast(targetStatus ? '🟢 You are now ONLINE & ready for orders!' : '⚪ You are now OFFLINE');
      if (targetStatus) loadOffers();
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Accept Delivery Offer
  const handleAcceptOffer = async (orderId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rider/deliveries/${orderId}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not accept offer');

      showToast('🎉 Mission Accepted! Proceed to restaurant.');
      setActiveMission(data.delivery);
      setActiveTab('mission');
      setOffers((prev) => prev.filter((o) => o.id !== orderId));
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
      loadOffers(); // refresh radar
    } finally {
      setActionLoading(false);
    }
  };

  // Decline Delivery Offer
  const handleRejectOffer = async (orderId: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await fetch(`/api/rider/deliveries/${orderId}/reject`, { method: 'POST' });
    } catch (err) {
      console.warn('Decline offer notice:', err);
    }
  };

  // Advance Delivery Status
  const handleUpdateDeliveryStatus = async (nextStatus: string, note?: string) => {
    if (!activeMission) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/rider/deliveries/${activeMission.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update delivery stage');

      setActiveMission((prev: any) => ({ ...prev, status: nextStatus }));
      showToast(`Status updated: ${nextStatus.replace(/_/g, ' ')}`);
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Complete Delivery with 4-Digit PIN
  const handleVerifyPinAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMission || enteredPin.length !== 4) {
      setPinError('Enter the complete 4-digit code given by the customer.');
      return;
    }
    setPinError(null);
    setActionLoading(true);

    try {
      const res = await fetch(`/api/rider/deliveries/${activeMission.id}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PIN verification failed');

      setCompletionReward(data.earnedAmount);
      setActiveMission(null);
      setEnteredPin('');
      loadRiderState();
      loadWalletDetails();
    } catch (err: any) {
      setPinError(err.message || 'Incorrect PIN code.');
    } finally {
      setActionLoading(false);
    }
  };

  // Request Withdrawal
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount < 1000) {
      setWithdrawError('Minimum withdrawal is ₦1,000');
      return;
    }
    if (amount > wallet.available) {
      setWithdrawError(`Exceeds available balance (₦${wallet.available.toLocaleString()})`);
      return;
    }
    setWithdrawError(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/rider/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');

      setShowWithdrawModal(false);
      setWithdrawAmount('');
      showToast(`💸 ₦${amount.toLocaleString()} payout requested and pending clearance.`);
      loadWalletDetails();
      loadRiderState();
    } catch (err: any) {
      setWithdrawError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Add Bank Account
  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccNumber || newAccNumber.length < 10 || !newAccName) {
      setBankFormError('Please enter valid account number (10 digits) and account name');
      return;
    }
    setBankFormError(null);
    setActionLoading(true);

    try {
      const res = await fetch('/api/rider/bank-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankName: newBankName,
          accountNumber: newAccNumber.trim(),
          accountName: newAccName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save account');

      setShowBankModal(false);
      setNewAccNumber('');
      setNewAccName('');
      showToast('🏦 Payout bank account saved.');
      loadWalletDetails();
    } catch (err: any) {
      setBankFormError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await riderAuthClient.signOut();
    } catch (err) {
      console.warn('Signout warning:', err);
    }
    router.push('/rider/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#00a205] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-[#00a205] uppercase tracking-wider">
            Connecting to Chow45 Dispatch Radar...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#000000] flex flex-col justify-between selection:bg-[#00a205] selection:text-white font-sans antialiased pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#00a205] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xl border border-white/20 animate-fade-in flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Completion Reward Modal */}
      {completionReward && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#ffffff] w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border border-[#00a205]/15 animate-scale-up">
            <div className="w-16 h-16 rounded-3xl bg-green-100 text-green-700 flex items-center justify-center text-3xl mx-auto mb-3 border border-green-200">
              🎉
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-green-700 bg-green-100 px-3 py-1 rounded-full border border-green-200">
              Mission Completed
            </span>
            <h2 className="text-2xl font-black text-[#00a205] mt-2 mb-1">
              ₦{completionReward.toLocaleString()}
            </h2>
            <p className="text-xs text-[#000000]/70 mb-5">
              Credited directly to your Chow45 rider wallet! Keep rolling to maximize your daily payout.
            </p>
            <button
              onClick={() => {
                setCompletionReward(null);
                setActiveTab('radar');
              }}
              className="w-full py-3.5 rounded-full bg-[#00a205] text-white text-xs font-extrabold shadow-lg shadow-[#00a205]/20 hover:bg-[#008704] transition-all"
            >
              Back to Radar Radar 🚀
            </button>
          </div>
        </div>
      )}

      {/* FLOATING CAPSULE HEADER */}
      <header className="sticky top-0 z-30 bg-[#fafafa]/90 backdrop-blur-md border-b border-[#00a205]/10 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-full bg-[#00a205] text-white flex items-center justify-center font-black text-sm tracking-tighter group-hover:scale-105 transition-transform">
              45
            </span>
            <span className="font-bold text-lg tracking-tight text-[#00a205]">
              CHOW<span className="text-[#E75A24]">45</span>
            </span>
          </Link>

          {/* ONLINE / OFFLINE TOGGLE */}
          <div className="flex items-center gap-2 bg-[#ffffff] px-3 py-1.5 rounded-full border border-[#00a205]/15 shadow-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                rider?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-neutral-300'
              }`}
            />
            <span className="text-xs font-extrabold text-[#00a205]">
              {rider?.isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
            <button
              onClick={handleToggleOnline}
              disabled={actionLoading}
              className={`ml-1 w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                rider?.isOnline ? 'bg-[#00a205]' : 'bg-neutral-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-transform ${
                  rider?.isOnline ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-2xl mx-auto w-full px-4 pt-4 sm:px-6">
        {/* RADAR / DISPATCH OFFERS TAB */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            {/* Live Status Banner */}
            <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00a205]/10 flex items-center justify-center text-xl">
                  {rider?.vehicle?.includes('Bike') ? '🚲' : '🛵'}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#00a205]">
                    {rider?.isOnline ? 'Active Campus Dispatch' : 'You are currently Offline'}
                  </h3>
                  <p className="text-xs text-[#000000]/60">
                    {rider?.isOnline
                      ? `Scanning ${rider.institution || 'Campus'} for food runs...`
                      : 'Switch toggle ON above to receive live customer offers.'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-[#E75A24]">
                  {offers.length} {offers.length === 1 ? 'offer' : 'offers'}
                </span>
              </div>
            </div>

            {/* If Rider has an active delivery while viewing radar */}
            {activeMission && (
              <div className="bg-[#00a205] text-white rounded-2xl p-4 shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                    Delivery In Progress
                  </span>
                  <p className="text-sm font-black mt-1">Order #{activeMission.id}</p>
                  <p className="text-xs text-white/80">{activeMission.storeName} → Drop-off</p>
                </div>
                <button
                  onClick={() => setActiveTab('mission')}
                  className="px-4 py-2 rounded-xl bg-white text-[#00a205] font-bold text-xs shadow-sm hover:bg-neutral-100"
                >
                  View Mission →
                </button>
              </div>
            )}

            {/* Radar Offers List */}
            {!rider?.isOnline ? (
              <div className="bg-[#ffffff] rounded-3xl p-8 border border-[#00a205]/10 text-center my-6">
                <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-3xl mx-auto mb-3">
                  💤
                </div>
                <h3 className="text-base font-bold text-[#000000] mb-1">
                  Ready to Start Earning?
                </h3>
                <p className="text-xs text-[#000000]/70 max-w-xs mx-auto mb-4">
                  Turn your status switch to <strong className="text-[#00a205]">ONLINE</strong> to receive nearby cafeteria and restaurant orders.
                </p>
                <button
                  onClick={handleToggleOnline}
                  className="px-6 py-2.5 rounded-full bg-[#00a205] text-white font-bold text-xs shadow-md shadow-[#00a205]/20"
                >
                  Go Online Now 🟢
                </button>
              </div>
            ) : offers.length === 0 ? (
              <div className="bg-[#ffffff] rounded-3xl p-8 border border-[#00a205]/10 text-center my-6">
                <div className="w-12 h-12 rounded-full bg-[#00a205]/10 flex items-center justify-center text-2xl mx-auto mb-3 animate-pulse">
                  📡
                </div>
                <h3 className="text-sm font-extrabold text-[#00a205] mb-1">
                  Listening for Orders...
                </h3>
                <p className="text-xs text-[#000000]/60 max-w-xs mx-auto">
                  New student cafeteria orders appear here the moment payment clears. Stay in your campus zone!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#00a205] px-1">
                  Available Delivery Runs ({offers.length})
                </h2>
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/15 shadow-sm hover:border-[#00a205]/40 transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#000000]/60">
                            #{offer.id}
                          </span>
                          <span className="text-[10px] font-bold bg-[#fafafa] text-[#00a205] px-2 py-0.5 rounded-md border border-[#00a205]/10">
                            {offer.itemCount} items
                          </span>
                        </div>
                        <h4 className="font-extrabold text-base text-[#000000] mt-0.5">
                          {offer.storeName}
                        </h4>
                        <p className="text-xs text-[#000000]/70 flex items-center gap-1 mt-0.5">
                          <span>📍 Pickup:</span> <span>{offer.storeAddress}</span>
                        </p>
                        <p className="text-xs text-[#00a205] font-medium flex items-center gap-1 mt-0.5">
                          <span>🎯 Destination:</span> <span>{offer.deliveryAddress}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-[#000000]/50 block">Your Earning</span>
                        <span className="text-lg font-black text-[#00a205]">
                          ₦{offer.deliveryFee.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#00a205]/10 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleRejectOffer(offer.id)}
                        disabled={actionLoading}
                        className="px-4 py-2.5 rounded-xl border border-[#00a205]/20 text-[#000000]/70 font-bold text-xs hover:bg-[#fafafa] transition-colors"
                      >
                        Decline
                      </button>

                      <button
                        onClick={() => handleAcceptOffer(offer.id)}
                        disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-full bg-[#00a205] hover:bg-[#008704] text-white font-extrabold text-xs shadow-md shadow-[#00a205]/20 transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Accept Delivery (₦{offer.deliveryFee.toLocaleString()}) →</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE MISSION TAB */}
        {activeTab === 'mission' && (
          <div className="space-y-4">
            {!activeMission ? (
              <div className="bg-[#ffffff] rounded-3xl p-8 border border-[#00a205]/10 text-center my-6">
                <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-3xl mx-auto mb-3">
                  📦
                </div>
                <h3 className="text-base font-bold text-[#000000] mb-1">
                  No Active Mission
                </h3>
                <p className="text-xs text-[#000000]/70 max-w-xs mx-auto mb-4">
                  You do not have any delivery assigned right now. Accept an incoming offer on the Radar.
                </p>
                <button
                  onClick={() => setActiveTab('radar')}
                  className="px-6 py-2.5 rounded-full bg-[#00a205] text-white font-bold text-xs shadow-md"
                >
                  View Radar Offers →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mission Header Card */}
                <div className="bg-[#00a205] text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full">
                        Order #{activeMission.id}
                      </span>
                      <h2 className="text-xl font-black mt-2">
                        {activeMission.storeName}
                      </h2>
                      <p className="text-xs text-white/80">
                        {activeMission.vendor?.address || 'Campus Cafeteria'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-white/70 block">Payout</span>
                      <span className="text-xl font-black text-[#fafafa]">
                        ₦{activeMission.deliveryFee.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Call Vendor Button */}
                  {activeMission.vendor?.ownerPhone && (
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-xs text-white/80">Vendor Contact:</span>
                      <a
                        href={`tel:${activeMission.vendor.ownerPhone}`}
                        className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <span>📞</span> <span>Call {activeMission.vendor.ownerPhone}</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Delivery Items Checklist */}
                <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#00a205] mb-2">
                    Package Line Items ({activeMission.items.length})
                  </h4>
                  <div className="divide-y divide-[#00a205]/10 text-xs">
                    {activeMission.items.map((item) => (
                      <div key={item.id} className="py-2 flex justify-between items-center">
                        <span className="font-semibold text-[#000000]">
                          {item.qty}x {item.name}
                        </span>
                        <span className="text-[#000000]/60">
                          ₦{(item.unitPrice * item.qty).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Drop-off Card */}
                <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#00a205] mb-1">
                    Customer Drop-Off Destination
                  </h4>
                  <p className="text-sm font-bold text-[#000000]">
                    {activeMission.customerName}
                  </p>
                  <p className="text-xs text-[#00a205] font-medium mt-0.5">
                    📍 {activeMission.deliveryAddress}
                  </p>
                  {activeMission.deliveryNotes && (
                    <p className="text-xs text-[#E75A24] font-medium mt-1 bg-[#fafafa] p-2 rounded-lg">
                      Note: {activeMission.deliveryNotes}
                    </p>
                  )}

                  {/* Customer Phone (revealed for assigned rider) */}
                  {activeMission.customerPhone && (
                    <div className="mt-3 pt-2 border-t border-[#00a205]/10 flex items-center justify-between">
                      <span className="text-xs text-[#000000]/70">Customer Phone:</span>
                      <a
                        href={`tel:${activeMission.customerPhone}`}
                        className="px-3 py-1.5 rounded-lg bg-[#00a205]/10 text-[#00a205] font-bold text-xs flex items-center gap-1.5 hover:bg-[#00a205]/20 transition-colors"
                      >
                        <span>📞</span> <span>Call {activeMission.customerPhone}</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* STEP-BY-STEP PROGRESSION ACTIONS */}
                <div className="bg-[#ffffff] rounded-2xl p-5 border border-[#00a205]/15 shadow-sm space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#00a205]">
                    Mission Status Action
                  </h4>

                  {/* STAGE 1: Heading to store */}
                  {activeMission.status === 'RIDER_ASSIGNED' && (
                    <button
                      onClick={() => handleUpdateDeliveryStatus('RIDER_HEADING_TO_STORE')}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-full bg-[#00a205] hover:bg-[#008704] text-white font-extrabold text-xs shadow-md shadow-[#00a205]/20 flex items-center justify-center gap-2"
                    >
                      <span>🛵 I am Heading to Restaurant →</span>
                    </button>
                  )}

                  {/* STAGE 2: Arrived at store */}
                  {activeMission.status === 'RIDER_HEADING_TO_STORE' && (
                    <button
                      onClick={() => handleUpdateDeliveryStatus('RIDER_AT_STORE')}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-full bg-[#00a205] hover:bg-[#008704] text-white font-extrabold text-xs shadow-md shadow-[#00a205]/20 flex items-center justify-center gap-2"
                    >
                      <span>📍 I Have Arrived at the Restaurant →</span>
                    </button>
                  )}

                  {/* STAGE 3: Picked up package */}
                  {activeMission.status === 'RIDER_AT_STORE' && (
                    <button
                      onClick={() => handleUpdateDeliveryStatus('PICKED_UP')}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-full bg-[#00a205] hover:bg-[#008704] text-white font-extrabold text-xs shadow-md shadow-[#00a205]/20 flex items-center justify-center gap-2"
                    >
                      <span>🍔 Food Picked Up! En Route to Drop-off →</span>
                    </button>
                  )}

                  {/* STAGE 4: Arrived at drop-off */}
                  {activeMission.status === 'PICKED_UP' && (
                    <button
                      onClick={() => handleUpdateDeliveryStatus('RIDER_NEARBY')}
                      disabled={actionLoading}
                      className="w-full py-3.5 rounded-full bg-[#00a205] hover:bg-[#008704] text-white font-extrabold text-xs shadow-md shadow-[#00a205]/20 flex items-center justify-center gap-2"
                    >
                      <span>🎯 Arrived at Customer Location →</span>
                    </button>
                  )}

                  {/* STAGE 5: PIN ENTRY & FINAL DELIVERY CONFIRMATION */}
                  {(activeMission.status === 'RIDER_NEARBY' || activeMission.status === 'OUT_FOR_DELIVERY') && (
                    <form onSubmit={handleVerifyPinAndComplete} className="space-y-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-[#fafafa] border border-[#00a205]/20 text-center">
                        <label className="block text-xs font-bold text-[#00a205] mb-1">
                          Ask Customer for 4-Digit Delivery PIN
                        </label>
                        <p className="text-[11px] text-[#000000]/70 mb-2">
                          Displayed on the customer&apos;s active order tracker screen.
                        </p>
                        <input
                          type="text"
                          maxLength={4}
                          value={enteredPin}
                          onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className="w-36 mx-auto text-center font-mono font-black text-2xl tracking-widest px-4 py-2.5 rounded-xl bg-[#ffffff] border-2 border-[#00a205] text-[#00a205] focus:outline-none"
                        />
                      </div>

                      {pinError && (
                        <p className="text-xs text-red-600 font-bold text-center">{pinError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={actionLoading || enteredPin.length !== 4}
                        className="w-full py-3.5 rounded-full bg-[#00a205] hover:bg-[#008704] disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-[#00a205]/20 flex items-center justify-center gap-2"
                      >
                        {actionLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span>Verify PIN & Claim ₦{activeMission.deliveryFee.toLocaleString()} ✨</span>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WALLET TAB */}
        {activeTab === 'wallet' && (
          <div className="space-y-4">
            {/* Balance Card */}
            <div className="bg-[#00a205] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                Rider Earnings Ledger
              </span>

              <div className="mt-4">
                <span className="text-xs text-white/70 block">Available Balance</span>
                <h2 className="text-3xl font-black text-[#fafafa]">
                  ₦{wallet.available.toLocaleString()}
                </h2>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs text-white/80">
                <div>
                  <span className="text-[10px] text-white/60 block">In Processing:</span>
                  <span className="font-bold">₦{wallet.processing.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-white/60 block">Lifetime Total:</span>
                  <span className="font-bold">₦{wallet.totalEarned.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setWithdrawError(null);
                  setShowWithdrawModal(true);
                }}
                disabled={wallet.available < 1000}
                className="mt-5 w-full py-3 rounded-xl bg-white hover:bg-neutral-100 disabled:opacity-50 text-[#00a205] font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>Request Payout to Bank 🏦</span>
              </button>
            </div>

            {/* Saved Bank Accounts */}
            <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#00a205]">
                  Payout Bank Accounts
                </h3>
                <button
                  onClick={() => setShowBankModal(true)}
                  className="text-xs font-bold text-[#00a205] hover:underline"
                >
                  + Add Account
                </button>
              </div>

              {bankAccounts.length === 0 ? (
                <div className="p-3 text-center bg-[#fafafa] rounded-xl text-xs text-[#000000]/60">
                  No bank account linked. Add one to enable fast withdrawals.
                </div>
              ) : (
                <div className="space-y-2">
                  {bankAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="p-3 rounded-xl bg-[#fafafa] border border-[#00a205]/10 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-xs text-[#000000]">{acc.bankName}</p>
                        <p className="text-[11px] font-mono text-[#000000]/70">
                          {acc.accountNumber} • {acc.accountName}
                        </p>
                      </div>
                      {acc.isDefault && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ledger Transactions */}
            <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#00a205] mb-3">
                Financial Transaction Trail
              </h3>

              {transactions.length === 0 ? (
                <p className="text-xs text-[#000000]/50 text-center py-4">
                  No transactions yet. Complete deliveries to see your earnings history.
                </p>
              ) : (
                <div className="divide-y divide-[#00a205]/10 text-xs">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[#000000]">
                          {tx.description || tx.type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] text-[#000000]/50">
                          {new Date(tx.createdAt).toLocaleDateString()} at{' '}
                          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-black text-xs ${
                            tx.direction === 'CREDIT' ? 'text-green-700' : 'text-[#E75A24]'
                          }`}
                        >
                          {tx.direction === 'CREDIT' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                        </span>
                        <span
                          className={`block text-[9px] font-extrabold uppercase ${
                            tx.status === 'COMPLETED'
                              ? 'text-green-600'
                              : tx.status === 'PENDING'
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-[#ffffff] rounded-3xl p-6 border border-[#00a205]/10 shadow-sm text-center">
              <div className="w-20 h-20 rounded-full bg-[#fafafa] border-2 border-[#00a205] flex items-center justify-center text-3xl mx-auto mb-3 overflow-hidden shadow-sm">
                {rider?.avatar ? (
                  <img
                    src={rider.avatar}
                    alt={rider.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>👤</span>
                )}
              </div>
              <h2 className="text-lg font-black text-[#00a205]">{rider?.name}</h2>
              <p className="text-xs text-[#000000]/70">{rider?.email}</p>

              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold border border-green-200">
                  ✓ Verified {rider?.identityMethod} Rider
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  ★ {rider?.rating ?? 5.0} Rating
                </span>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
                <span className="text-[11px] text-[#000000]/60 block">Today&apos;s Earnings</span>
                <span className="text-xl font-black text-[#00a205]">
                  ₦{stats.todayEarnings.toLocaleString()}
                </span>
              </div>
              <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
                <span className="text-[11px] text-[#000000]/60 block">Today&apos;s Drops</span>
                <span className="text-xl font-black text-[#00a205]">{stats.todayTrips} runs</span>
              </div>
              <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
                <span className="text-[11px] text-[#000000]/60 block">Total Completed</span>
                <span className="text-xl font-black text-[#00a205]">{stats.allTimeTrips} drops</span>
              </div>
              <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10">
                <span className="text-[11px] text-[#000000]/60 block">Vehicle</span>
                <span className="text-sm font-bold text-[#E75A24]">{rider?.vehicle}</span>
              </div>
            </div>

            {/* Account Details */}
            <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#00a205]/10 text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-[#00a205]/10">
                <span className="text-[#000000]/60">Campus Base:</span>
                <span className="font-bold">{rider?.institution}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#00a205]/10">
                <span className="text-[#000000]/60">Phone:</span>
                <span className="font-semibold">{rider?.phone}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#000000]/60">Verification:</span>
                <span className="font-mono font-bold text-[#00a205]">
                  {rider?.identityMethod} ({rider?.identityNumber})
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full py-3.5 rounded-xl border border-red-300 text-red-600 font-bold text-xs hover:bg-red-50 transition-colors"
            >
              Sign Out of Rider Session
            </button>
          </div>
        )}
      </main>

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#ffffff] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#00a205]/15 animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-base text-[#00a205]">Withdraw Earnings</h3>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="text-xs font-bold text-[#000000]/50 hover:text-[#000000]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#000000]/70 mb-3">
              Available to withdraw:{' '}
              <strong className="text-[#00a205]">₦{wallet.available.toLocaleString()}</strong>
            </p>

            {withdrawError && (
              <p className="text-xs text-red-600 font-bold mb-3">{withdrawError}</p>
            )}

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#00a205] mb-1">
                  Amount in Naira (Min. ₦1,000)
                </label>
                <input
                  type="number"
                  min="1000"
                  max={wallet.available}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-4 py-3 rounded-xl bg-[#fafafa] border border-[#00a205]/20 text-[#000000] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#00a205]"
                />
              </div>

              {bankAccounts.length > 0 && (
                <div className="p-3 bg-[#fafafa] rounded-xl text-xs">
                  <span className="text-[10px] text-[#000000]/50 block">Destination Bank</span>
                  <span className="font-bold text-[#00a205]">
                    {bankAccounts[0].bankName} ({bankAccounts[0].accountNumber})
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 rounded-xl border border-[#00a205]/20 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-full bg-[#00a205] text-white text-xs font-bold shadow-md shadow-[#00a205]/20"
                >
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD BANK ACCOUNT MODAL */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#ffffff] w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-[#00a205]/15 animate-scale-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-base text-[#00a205]">Add Bank Account</h3>
              <button
                onClick={() => setShowBankModal(false)}
                className="text-xs font-bold text-[#000000]/50 hover:text-[#000000]"
              >
                ✕
              </button>
            </div>

            {bankFormError && (
              <p className="text-xs text-red-600 font-bold mb-3">{bankFormError}</p>
            )}

            <form onSubmit={handleSaveBankAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#00a205] mb-1">
                  Bank Name
                </label>
                <select
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#00a205]/20 text-xs font-medium"
                >
                  <option value="Opay">OPay Digital Services</option>
                  <option value="Palmpay">PalmPay</option>
                  <option value="Moniepoint">Moniepoint MFB</option>
                  <option value="Kuda Bank">Kuda Microfinance Bank</option>
                  <option value="GTBank">Guaranty Trust Bank (GTBank)</option>
                  <option value="Access Bank">Access Bank</option>
                  <option value="Zenith Bank">Zenith Bank</option>
                  <option value="First Bank">First Bank of Nigeria</option>
                  <option value="UBA">United Bank for Africa (UBA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#00a205] mb-1">
                  Account Number (10 Digits)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={newAccNumber}
                  onChange={(e) => setNewAccNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 8012345678"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#00a205]/20 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#00a205] mb-1">
                  Account Name (As on Bank Account)
                </label>
                <input
                  type="text"
                  required
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="e.g. Samuel Olawale Adeleke"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#fafafa] border border-[#00a205]/20 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#00a205]/20 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-full bg-[#00a205] text-white text-xs font-bold shadow-md shadow-[#00a205]/20"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#fafafa]/95 backdrop-blur-lg border-t border-[#00a205]/15 py-2 px-4 shadow-lg">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab('radar')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'radar'
                ? 'text-[#00a205] font-black scale-105'
                : 'text-[#000000]/50 font-medium hover:text-[#00a205]'
            }`}
          >
            <span className="text-xl">📡</span>
            <span className="text-[10px] mt-0.5">Radar</span>
          </button>

          <button
            onClick={() => setActiveTab('mission')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all relative ${
              activeTab === 'mission'
                ? 'text-[#00a205] font-black scale-105'
                : 'text-[#000000]/50 font-medium hover:text-[#00a205]'
            }`}
          >
            <span className="text-xl">🛵</span>
            {activeMission && (
              <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-[#E75A24] animate-ping" />
            )}
            <span className="text-[10px] mt-0.5">Mission</span>
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'wallet'
                ? 'text-[#00a205] font-black scale-105'
                : 'text-[#000000]/50 font-medium hover:text-[#00a205]'
            }`}
          >
            <span className="text-xl">💰</span>
            <span className="text-[10px] mt-0.5">Wallet</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${
              activeTab === 'profile'
                ? 'text-[#00a205] font-black scale-105'
                : 'text-[#000000]/50 font-medium hover:text-[#00a205]'
            }`}
          >
            <span className="text-xl">👤</span>
            <span className="text-[10px] mt-0.5">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
