'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RiderApplicationStatusPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rider, setRider] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rider/me');
      const data = await res.json();
      if (!res.ok && res.status === 401) {
        router.push('/rider/login');
        return;
      }
      if (data.rider) {
        setRider(data.rider);
      } else {
        setError(data.message || 'Could not find rider profile.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to check application status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const status = (rider?.applicationStatus || rider?.approvalStatus || 'PENDING_REVIEW').toUpperCase();
  const isApproved = status === 'APPROVED';
  const isRejected = status === 'REJECTED';
  const isSuspended = status === 'SUSPENDED';
  const isPending = !isApproved && !isRejected && !isSuspended;

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#000000] flex flex-col justify-between selection:bg-[#00a205] selection:text-white font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#fafafa]/90 backdrop-blur-md border-b border-[#00a205]/10 px-4 py-3 sm:px-6">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-full bg-[#00a205] text-white flex items-center justify-center font-black text-sm tracking-tighter group-hover:scale-105 transition-transform">
              45
            </span>
            <span className="font-bold text-lg tracking-tight text-[#00a205]">
              CHOW<span className="text-[#E75A24]">45</span>
            </span>
          </Link>
          <span className="text-xs font-semibold text-[#00a205]/70 bg-[#00a205]/5 px-2.5 py-1 rounded-full border border-[#00a205]/10">
            Application Status
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-[#ffffff] rounded-3xl border border-[#00a205]/10 shadow-xl shadow-[#00a205]/5 p-6 sm:p-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-3 border-[#00a205] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xs font-bold text-[#00a205] uppercase tracking-wider">
                Verifying Application Status...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 text-xl">
                ⚠️
              </div>
              <h2 className="text-lg font-bold text-[#000000] mb-2">Notice</h2>
              <p className="text-xs text-[#000000]/70 mb-5">{error}</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={fetchStatus}
                  className="px-5 py-2.5 rounded-full bg-[#00a205] text-white text-xs font-bold"
                >
                  Try Again
                </button>
                <Link
                  href="/rider/login"
                  className="px-5 py-2.5 rounded-xl border border-[#00a205]/20 text-[#00a205] text-xs font-bold"
                >
                  Sign In
                </Link>
              </div>
            </div>
          ) : isApproved ? (
            /* APPROVED STATE */
            <div className="text-center">
              <div className="w-16 h-16 rounded-3xl bg-green-100 text-green-700 flex items-center justify-center text-3xl mx-auto mb-4 border border-green-200 shadow-sm animate-bounce">
                🎉
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-green-500/10 text-green-700 text-xs font-extrabold uppercase tracking-wider border border-green-500/20 mb-3">
                Application Approved
              </span>
              <h1 className="text-2xl font-black text-[#00a205] mb-2">
                Welcome to the Fleet, {rider?.name}!
              </h1>
              <p className="text-xs text-[#000000]/70 mb-6 max-w-sm mx-auto">
                Your identity verification has been cleared by Chow45 operations. You can now toggle online and start accepting campus food delivery missions.
              </p>

              <div className="p-4 rounded-2xl bg-[#fafafa] border border-[#00a205]/10 text-left text-xs space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-[#000000]/60">Assigned Campus:</span>
                  <span className="font-bold text-[#00a205]">{rider?.institution || 'OOU Sagamu'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#000000]/60">Vehicle:</span>
                  <span className="font-semibold">{rider?.vehicle || 'Bicycle'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#000000]/60">Verification Method:</span>
                  <span className="font-mono font-semibold">{rider?.identityMethod} ({rider?.identityNumber})</span>
                </div>
              </div>

              <Link
                href="/rider"
                className="w-full py-4 rounded-full bg-[#00a205] hover:bg-[#008704] text-white font-extrabold text-sm shadow-lg shadow-[#00a205]/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Launch Rider Dashboard 🚀</span>
              </Link>
            </div>
          ) : isRejected ? (
            /* REJECTED STATE */
            <div className="text-center">
              <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-600 flex items-center justify-center text-3xl mx-auto mb-4 border border-red-200">
                ❌
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-xs font-extrabold uppercase tracking-wider border border-red-500/20 mb-3">
                Application Not Approved
              </span>
              <h1 className="text-2xl font-black text-[#000000] mb-2">
                Application Status Notice
              </h1>
              <p className="text-xs text-[#000000]/70 mb-5">
                Unfortunately, your Chow45 rider application could not be approved at this time.
              </p>

              {rider?.rejectionReason && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-left mb-6">
                  <p className="text-[11px] font-bold text-red-800 uppercase tracking-wider mb-1">
                    Reason provided by operations:
                  </p>
                  <p className="text-xs text-red-700 font-medium">{rider.rejectionReason}</p>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <Link
                  href="/rider/register"
                  className="w-full py-3 rounded-full bg-[#00a205] text-white font-bold text-xs shadow-md"
                >
                  Submit Updated Application
                </Link>
                <a
                  href="mailto:support@chow45.com?subject=Rider Application Appeal"
                  className="w-full py-3 rounded-xl border border-[#00a205]/20 text-[#00a205] font-bold text-xs hover:bg-[#fafafa]"
                >
                  Contact Chow45 Support
                </a>
              </div>
            </div>
          ) : isSuspended ? (
            /* SUSPENDED STATE */
            <div className="text-center">
              <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-200">
                ⚠️
              </div>
              <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-extrabold uppercase tracking-wider border border-amber-500/20 mb-3">
                Account Suspended
              </span>
              <h1 className="text-2xl font-black text-[#000000] mb-2">
                Operational Suspension
              </h1>
              <p className="text-xs text-[#000000]/70 mb-5">
                Your rider privileges have been temporarily paused by the dispatch safety team.
              </p>

              {rider?.suspensionReason && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left mb-6">
                  <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                    Notice details:
                  </p>
                  <p className="text-xs text-amber-900 font-medium">{rider.suspensionReason}</p>
                </div>
              )}

              <a
                href="mailto:support@chow45.com?subject=Rider Account Suspension Review"
                className="inline-block w-full py-3.5 rounded-full bg-[#00a205] text-white font-bold text-xs"
              >
                Contact Dispatch Operations
              </a>
            </div>
          ) : (
            /* PENDING REVIEW STATE */
            <div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-3xl bg-[#00a205]/10 text-[#00a205] flex items-center justify-center text-3xl mx-auto mb-4 border border-[#00a205]/20 relative">
                  <span>⏳</span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E75A24] rounded-full border-2 border-[#ffffff] animate-ping" />
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 text-xs font-extrabold uppercase tracking-wider border border-amber-500/20 mb-2">
                  Review in Progress
                </span>
                <h1 className="text-2xl font-black text-[#00a205] mb-1">
                  We&apos;re Verifying Your Profile
                </h1>
                <p className="text-xs text-[#000000]/70 max-w-sm mx-auto">
                  Chow45 operations manually validates each rider&apos;s NIN/matriculation record to guarantee food safety and customer trust.
                </p>
              </div>

              {/* Progress Milestones */}
              <div className="space-y-3 mb-6 p-4 rounded-2xl bg-[#fafafa] border border-[#00a205]/10">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#00a205] text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#00a205]">Application Submitted</p>
                    <p className="text-[11px] text-[#000000]/60">Profile details and contact saved</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold animate-pulse">
                    ●
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-amber-900">Background & ID Verification</p>
                    <p className="text-[11px] text-[#000000]/60">
                      Checking {rider?.identityMethod || 'NIN'}: {rider?.identityNumber || 'Submitted'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 opacity-50">
                  <div className="w-6 h-6 rounded-full bg-[#000000]/20 text-white flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#000000]">Fleet Activation</p>
                    <p className="text-[11px] text-[#000000]/60">Start taking missions and receiving instant payouts</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={fetchStatus}
                  className="w-full py-3.5 rounded-full bg-[#00a205] hover:bg-[#008704] text-white font-bold text-xs shadow-md shadow-[#00a205]/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Check Status Now 🔄</span>
                </button>

                <p className="text-[11px] text-center text-[#000000]/60 pt-2">
                  Typical approval time: <strong className="text-[#00a205]">2 - 24 hours</strong> during campus operating hours.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-[#000000]/50 border-t border-[#00a205]/10">
        Chow45 Dispatch Fleet • Dedicated Student & Campus Courier Network
      </footer>
    </div>
  );
}
