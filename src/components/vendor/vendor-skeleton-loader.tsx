'use client';

import React from 'react';

export default function VendorSkeletonLoader() {
  return (
    <div className="fixed inset-0 z-50 bg-[#FFFDF6] overflow-y-auto pointer-events-none transition-opacity duration-300">
      <style>{`
        @keyframes vendorShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .v-shimmer {
          background: linear-gradient(90deg, #F3EFE6 25%, #E8E2D5 50%, #F3EFE6 75%);
          background-size: 200% 100%;
          animation: vendorShimmer 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* Top Navigation Bar Skeleton */}
      <header className="sticky top-0 z-20 bg-white border-b border-[#E6DEC8] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full v-shimmer" />
          <div className="h-6 w-32 rounded-lg v-shimmer" />
          <div className="h-5 w-20 rounded-full v-shimmer bg-[#E8F6F0]" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 rounded-full v-shimmer hidden sm:block" />
          <div className="w-9 h-9 rounded-full v-shimmer" />
        </div>
      </header>

      {/* Main Vendor Container */}
      <main className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        {/* Store Banner & Profile Header Skeleton */}
        <section className="bg-white rounded-3xl border border-[#E6DEC8] overflow-hidden shadow-sm">
          {/* Cover image placeholder */}
          <div className="w-full h-36 sm:h-44 v-shimmer" />
          
          <div className="p-5 sm:p-6 -mt-12 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-white shadow-md v-shimmer flex-shrink-0" />
              <div className="space-y-2 pb-1">
                <div className="h-6 w-44 sm:w-56 rounded-md v-shimmer" />
                <div className="h-4 w-32 sm:w-40 rounded-md v-shimmer" />
                <div className="h-3.5 w-48 rounded-md v-shimmer" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-28 rounded-xl v-shimmer" />
              <div className="h-10 w-10 rounded-xl v-shimmer" />
            </div>
          </div>
        </section>

        {/* Subtabs Skeleton ([Food Menu] [Orders] [Money] [Store Profile]) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="h-10 w-28 rounded-full v-shimmer flex-shrink-0" />
          <div className="h-10 w-24 rounded-full v-shimmer flex-shrink-0" />
          <div className="h-10 w-24 rounded-full v-shimmer flex-shrink-0" />
          <div className="h-10 w-32 rounded-full v-shimmer flex-shrink-0" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-[#E6DEC8] space-y-2">
              <div className="h-3 w-16 rounded v-shimmer" />
              <div className="h-6 w-20 rounded-md v-shimmer" />
            </div>
          ))}
        </div>

        {/* Action bar skeleton: Categories + Add Food button */}
        <div className="bg-white p-4 rounded-2xl border border-[#E6DEC8] space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              {['All Food', 'Rice', 'Soups', 'Swallow', 'Drinks'].map((cat, idx) => (
                <div key={idx} className="h-8 w-20 rounded-full v-shimmer flex-shrink-0" />
              ))}
            </div>
            <div className="h-10 w-36 rounded-xl v-shimmer flex-shrink-0" />
          </div>

          {/* Quick status bar */}
          <div className="h-4 w-40 rounded v-shimmer" />
        </div>

        {/* Food Items List Skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-white p-4 rounded-2xl border border-[#E6DEC8] flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl v-shimmer flex-shrink-0" />
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="h-5 w-40 sm:w-56 rounded v-shimmer" />
                  <div className="h-3.5 w-24 rounded v-shimmer" />
                  <div className="h-4 w-28 rounded v-shimmer" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-16 rounded-full v-shimmer hidden sm:block" />
                <div className="h-9 w-9 rounded-xl v-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
