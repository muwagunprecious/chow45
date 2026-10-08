'use client';

import React from 'react';

export default function VendorSkeletonLoader() {
  return (
    <div className="fixed inset-0 z-50 bg-[#FAF9F5]/95 backdrop-blur-sm flex flex-col items-center justify-center transition-opacity duration-300">
      <style>{`
        @keyframes chowLogoPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.92;
          }
        }
        @keyframes chowSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .chow-normal-spinner {
          width: 36px;
          height: 36px;
          border: 3.5px solid rgba(12, 81, 63, 0.12);
          border-top-color: #9DE53C;
          border-right-color: #0C513F;
          border-radius: 50%;
          animation: chowSpin 0.75s linear infinite;
        }
      `}</style>

      <div className="flex flex-col items-center gap-5 p-8 bg-white rounded-3xl shadow-[0_16px_45px_rgba(0,0,0,0.06)] border border-[#EDE8DC] max-w-xs w-full mx-4 text-center">
        {/* Official Chow45 Logo */}
        <div style={{ animation: 'chowLogoPulse 2.2s ease-in-out infinite' }}>
          <img
            src="/logo.png"
            alt="Chow45 Logo"
            className="h-20 w-auto object-contain select-none"
          />
        </div>

        {/* Normal Circular Spinner */}
        <div className="chow-normal-spinner mt-1" />

        {/* Friendly Status Text */}
        <div className="space-y-1">
          <p className="font-display text-base font-extrabold text-[#111111] tracking-[-0.02em]">
            Loading Chow45...
          </p>
          <p className="text-xs font-medium text-gray-500">
            Getting your dashboard ready
          </p>
        </div>
      </div>
    </div>
  );
}
