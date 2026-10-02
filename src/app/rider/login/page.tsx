'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { riderAuthClient } from '@/lib/auth-client';

export default function RiderLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await riderAuthClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.error) {
        throw new Error(res.error.message || 'Invalid email or password.');
      }

      // Check rider approval status via /api/rider/me
      const meRes = await fetch('/api/rider/me');
      const meData = await meRes.json();

      if (meRes.ok && meData.rider) {
        const appStatus = (meData.rider.applicationStatus || meData.rider.approvalStatus || '').toUpperCase();
        if (appStatus === 'APPROVED') {
          router.push('/rider');
        } else {
          router.push('/rider/application-status');
        }
      } else {
        router.push('/rider');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EB] text-[#111111] flex flex-col justify-between selection:bg-[#0C513F] selection:text-white font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FAF6EB]/90 backdrop-blur-md border-b border-[#0C513F]/10 px-4 py-3 sm:px-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-full bg-[#0C513F] text-white flex items-center justify-center font-black text-sm tracking-tighter group-hover:scale-105 transition-transform">
              45
            </span>
            <span className="font-bold text-lg tracking-tight text-[#0C513F]">
              CHOW<span className="text-[#E75A24]">45</span>
            </span>
          </Link>
          <span className="text-xs font-semibold text-[#0C513F]/70 bg-[#0C513F]/5 px-2.5 py-1 rounded-full border border-[#0C513F]/10">
            Rider Portal
          </span>
        </div>
      </header>

      {/* Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-[#FFFDF6] rounded-3xl border border-[#0C513F]/10 shadow-xl shadow-[#0C513F]/5 p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#0C513F]/10 text-[#0C513F] flex items-center justify-center text-3xl mx-auto mb-3">
              🛵
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0C513F]">
              Welcome Back, Rider
            </h1>
            <p className="text-xs text-[#111111]/70 mt-1">
              Sign in to access your delivery radar, active missions, and wallet.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#0C513F] mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rider@chow45.com"
                className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#0C513F]">
                  Password
                </label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl bg-[#FAF6EB] border border-[#0C513F]/20 text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:ring-2 focus:ring-[#0C513F] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#0C513F] hover:bg-[#0a4334] text-white font-bold text-sm shadow-md shadow-[#0C513F]/20 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to Dashboard →</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#0C513F]/10 text-center">
            <p className="text-xs text-[#111111]/70">
              New to the Chow45 dispatch fleet?{' '}
              <Link href="/rider/register" className="font-bold text-[#0C513F] hover:underline">
                Apply to Deliver
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-[#111111]/50 border-t border-[#0C513F]/10">
        Chow45 Dispatch • Instant Payouts & Reliable Campus Logistics
      </footer>
    </div>
  );
}
