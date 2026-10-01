'use client';

import React from 'react';

export default function VendorSkeletonLoader() {
  return (
    <div className="fixed inset-0 z-50 bg-[#FAF9F5] overflow-y-auto pointer-events-none transition-opacity duration-300">
      <style>{`
        @keyframes chowShimmerWave {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .chow-bone {
          background: linear-gradient(
            90deg,
            rgba(240, 237, 230, 0.7) 0%,
            rgba(224, 235, 230, 0.9) 35%,
            rgba(210, 230, 222, 0.95) 50%,
            rgba(224, 235, 230, 0.9) 65%,
            rgba(240, 237, 230, 0.7) 100%
          );
          background-size: 250% 100%;
          animation: chowShimmerWave 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .chow-bone-subtle {
          background: linear-gradient(
            90deg,
            rgba(245, 243, 238, 0.8) 0%,
            rgba(235, 232, 224, 0.95) 50%,
            rgba(245, 243, 238, 0.8) 100%
          );
          background-size: 250% 100%;
          animation: chowShimmerWave 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .chow-bone-emerald {
          background: linear-gradient(
            90deg,
            #0C513F 0%,
            #15735A 50%,
            #0C513F 100%
          );
          background-size: 250% 100%;
          animation: chowShimmerWave 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* Top Navbar Skeleton */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#EDE8DC] px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl chow-bone-emerald flex items-center justify-center shadow-xs" />
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-28 rounded-md chow-bone" />
            <div className="h-2.5 w-16 rounded-md chow-bone-subtle" />
          </div>
          <div className="h-6 w-24 rounded-full chow-bone hidden sm:block ml-2" />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-8 w-28 rounded-full chow-bone hidden md:block" />
          <div className="w-9 h-9 rounded-full chow-bone border border-[#EDE8DC]" />
        </div>
      </header>

      {/* Main Vendor Dashboard Shell */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hero Store Profile Banner Skeleton */}
        <section className="bg-white rounded-3xl border border-[#EDE8DC] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
          {/* Banner cover */}
          <div className="w-full h-40 sm:h-48 chow-bone relative">
            <div className="absolute top-4 right-4 h-7 w-28 rounded-full bg-white/80 backdrop-blur-sm chow-bone-subtle" />
          </div>

          {/* Profile details */}
          <div className="p-6 -mt-14 relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div className="flex items-end gap-4 sm:gap-5">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white shadow-md chow-bone flex-shrink-0" />
              <div className="space-y-2 pb-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-48 sm:w-64 rounded-lg chow-bone" />
                  <div className="h-5 w-14 rounded-full chow-bone hidden sm:block" />
                </div>
                <div className="h-3.5 w-36 sm:w-44 rounded-md chow-bone-subtle" />
                <div className="h-3 w-56 sm:w-72 rounded-md chow-bone-subtle" />
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2 sm:pt-0">
              <div className="h-10 w-32 rounded-xl chow-bone flex-shrink-0" />
              <div className="h-10 w-10 rounded-xl chow-bone flex-shrink-0" />
            </div>
          </div>
        </section>

        {/* 4 Interactive Subtabs Skeleton */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          <div className="h-11 px-6 rounded-full chow-bone-emerald text-white flex-shrink-0 shadow-sm" style={{ width: '130px' }} />
          <div className="h-11 px-5 rounded-full chow-bone flex-shrink-0 bg-white border border-[#EDE8DC]" style={{ width: '110px' }} />
          <div className="h-11 px-5 rounded-full chow-bone flex-shrink-0 bg-white border border-[#EDE8DC]" style={{ width: '110px' }} />
          <div className="h-11 px-5 rounded-full chow-bone flex-shrink-0 bg-white border border-[#EDE8DC]" style={{ width: '140px' }} />
        </div>

        {/* 4 Key Business Metrics Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[
            { label: 'TODAY SALES' },
            { label: 'ACTIVE ORDERS' },
            { label: 'MENU DISHES' },
            { label: 'STORE RATING' }
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white p-4.5 rounded-2xl border border-[#EDE8DC] shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-20 rounded chow-bone-subtle" />
                <div className="w-5 h-5 rounded-md chow-bone" />
              </div>
              <div className="h-7 w-24 rounded-lg chow-bone" />
            </div>
          ))}
        </div>

        {/* Menu Controls: Search + Categories + Add Food Button */}
        <div className="bg-white p-5 rounded-3xl border border-[#EDE8DC] shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <div className="h-9 w-18 rounded-full chow-bone-emerald flex-shrink-0" />
              {['Rice', 'Soups', 'Swallow', 'Grills', 'Drinks', 'Shawarma'].map((c, idx) => (
                <div key={idx} className="h-9 w-20 rounded-full chow-bone-subtle flex-shrink-0 border border-[#EDE8DC]" />
              ))}
            </div>

            {/* Primary Add Food Action Button */}
            <div className="h-11 w-40 rounded-xl chow-bone-emerald shadow-sm flex-shrink-0" />
          </div>

          <div className="h-3 w-48 rounded chow-bone-subtle" />
        </div>

        {/* Food Dish Cards Grid Skeleton */}
        <div className="space-y-3.5">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-white p-4.5 rounded-2xl border border-[#EDE8DC] shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex items-center justify-between gap-4 transition-all"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {/* Food Image */}
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl chow-bone flex-shrink-0 border border-[#EDE8DC]" />

                {/* Details */}
                <div className="space-y-2.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-40 sm:w-56 rounded-md chow-bone" />
                    <div className="h-4 w-16 rounded-full chow-bone-subtle hidden sm:block" />
                  </div>
                  <div className="h-3.5 w-28 sm:w-36 rounded chow-bone-subtle" />
                  <div className="h-4.5 w-24 rounded-md chow-bone" />
                </div>
              </div>

              {/* Actions & Stock Toggle */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="h-9 w-16 rounded-xl chow-bone-subtle hidden sm:block" />
                <div className="h-8 w-20 rounded-full chow-bone" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
