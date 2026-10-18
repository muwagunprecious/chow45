'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MARKETPLACE_SHELL_HTML } from '@/lib/marketplace-html';
import VendorSkeletonLoader from '@/components/vendor/vendor-skeleton-loader';

interface MarketplaceViewProps {
  initialRole?: 'customer' | 'vendor' | 'rider' | 'admin';
  initialTab?: 'food' | 'orders' | 'money' | 'store' | 'home';
}

declare global {
  interface Window {
    __CHOW45_MAPBOX_TOKEN__?: string;
    __CHOW45_GOOGLE_MAPS_KEY__?: string;
    _chow45Initialized?: boolean;
    _chow45ScriptsLoading?: Promise<void>;
    __chow45ScriptPromises?: Record<string, Promise<void>>;
    Chow45App?: any;
    chowApp?: any;
    VendorController?: any;
    CustomerController?: any;
    RiderController?: any;
    AdminController?: any;
    Chow45Auth?: any;
    ChowUnits?: any;
    chowStore?: any;
    chowLocationPicker?: any;
    Chow45LocationPicker?: any;
  }
}

const GOOGLE_MAPS_SCRIPT =
  'https://maps.googleapis.com/maps/api/js?key=AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo&libraries=places,geometry,marker&loading=async&v=weekly';

const LOCAL_SCRIPTS_TO_LOAD = [
  '/app/js/google-maps-config.js?v=20261017e',
  '/app/js/mapbox-config.js?v=20261017e',
  '/app/js/service-zones.js?v=20261017e',
  // Units must be ready before the controllers read it, so it loads ahead of
  // state, customer and vendor.
  '/app/js/units.js?v=20261017e',
  '/app/js/data.js?v=20261017e',
  '/app/js/state.js?v=20261017e',
  '/app/js/google-maps-service.js?v=20261017e',
  '/app/js/location-picker.js?v=20261017e',
  '/app/js/customer.js?v=20261017e',
  '/app/js/vendor.js?v=20261017e',
  '/app/js/rider.js?v=20261017e',
  '/app/js/admin.js?v=20261017e',
  '/app/js/auth.js?v=20261017e',
  // Must be ready before app.js boots, because app.js starts the gate.
  '/app/js/vendor-onboarding.js?v=20261017e',
  '/app/js/app.js?v=20261017e',
];


// Globals that must exist before the controllers can safely run. Without this
// gate a cached script tag could resolve early and boot the app against a
// half-loaded page, which is what produced `Chow45Auth is not defined`.
const REQUIRED_GLOBALS = [
  'ChowUnits',
  'chowStore',
  'CustomerController',
  'VendorController',
  'RiderController',
  'AdminController',
  'Chow45Auth',
  'VendorOnboarding',
  'Chow45App',
];

function getScriptPromises(): Record<string, Promise<void>> {
  if (!window.__chow45ScriptPromises) {
    window.__chow45ScriptPromises = {};
  }
  return window.__chow45ScriptPromises;
}

function loadScript(src: string): Promise<void> {
  const cache = getScriptPromises();
  const cached = cache[src];
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-chow45-src="${CSS.escape(src)}"]`
    );

    if (existing) {
      if (
        existing.getAttribute('data-chow45-loaded') === 'true' ||
        (existing as any).readyState === 'complete' ||
        (existing as any).readyState === 'loaded'
      ) {
        resolve();
        return;
      }
      const onSettle = () => resolve();
      existing.addEventListener('load', onSettle);
      existing.addEventListener('error', onSettle);
      setTimeout(resolve, 2500);
      return;
    }

    const script = document.createElement('script');
    let settled = false;

    const settleOk = () => {
      if (settled) return;
      settled = true;
      script.setAttribute('data-chow45-loaded', 'true');
      resolve();
    };

    const settleFail = () => {
      if (settled) return;
      settled = true;
      delete cache[src];
      if (src.includes('maps.googleapis.com')) {
        console.warn('[chow45] Google Maps failed to load; proceeding with offline fallback');
        resolve();
      } else {
        script.remove();
        reject(new Error(`Failed to load script ${src}`));
      }
    };

    script.addEventListener('load', settleOk);
    script.addEventListener('error', settleFail);
    script.src = src;
    script.async = src.includes('maps.googleapis.com');
    script.dataset.chow45Src = src;
    document.body.appendChild(script);

    if (src.includes('maps.googleapis.com')) {
      setTimeout(settleOk, 3000);
    }
  });

  cache[src] = promise;
  return promise;
}

async function waitForGlobals(names: string[], timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const missing = () => names.filter((n) => typeof (window as any)[n] === 'undefined');

  let pending = missing();
  while (pending.length > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    pending = missing();
  }

  if (pending.length > 0) {
    throw new Error(`Marketplace scripts did not initialise: missing ${pending.join(', ')}`);
  }
}

async function loadAllScriptsSequentially() {
  if (window._chow45ScriptsLoading) {
    return window._chow45ScriptsLoading;
  }

  const loadPromise = (async () => {
    // Non-blocking load of Google Maps in parallel
    void loadScript(GOOGLE_MAPS_SCRIPT).catch((err) => {
      console.warn('[chow45] Google Maps async load bypassed:', err);
    });

    // Load local Chow45 application logic modules sequentially
    for (const src of LOCAL_SCRIPTS_TO_LOAD) {
      await loadScript(src);
    }
  })();

  window._chow45ScriptsLoading = loadPromise;
  return loadPromise;
}

export function MarketplaceView({
  initialRole = 'customer',
  initialTab = 'food',
}: MarketplaceViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isVendorLoading, setIsVendorLoading] = useState(initialRole === 'vendor');

  useEffect(() => {
    setMounted(true);

    // Provide Google Maps Platform key to global scope
    const googleKey =
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      'AIzaSyD1Sn5JeNPEpijWMU6kRyOkyr4RZksTwWo';
    window.__CHOW45_GOOGLE_MAPS_KEY__ = googleKey;
    window.__CHOW45_MAPBOX_TOKEN__ = googleKey;

    // Early resilient global stubs so clicking buttons before full script hydration never throws
    window.Chow45App = window.Chow45App || {
      openLocationModal: () => {
        if (window.chowLocationPicker && window.chowLocationPicker.open) {
          window.chowLocationPicker.open();
        } else if (window.Chow45LocationPicker && window.Chow45LocationPicker.open) {
          window.Chow45LocationPicker.open();
        } else {
          const m = document.getElementById('map-picker-modal') || document.getElementById('location-modal');
          if (m) m.classList.add('open');
        }
      },
      toast: (msg: string, type: string) => console.log(`[Toast ${type}]`, msg)
    };
    window.chowApp = window.chowApp || window.Chow45App;

    window.CustomerController = window.CustomerController || {
      openOrderHistory: () => {
        const m = document.getElementById('order-history-modal');
        if (m) m.classList.add('open');
      },
      openCart: () => {
        const m = document.getElementById('cart-modal');
        if (m) m.classList.add('open');
      },
      closeCart: () => {
        const m = document.getElementById('cart-modal');
        if (m) m.classList.remove('open');
      },
    };

    window.Chow45Auth = window.Chow45Auth || {
      openProfile: (event?: any) => {
        if (event?.preventDefault) event.preventDefault();
        const m = document.getElementById('signout-confirm-modal') || document.getElementById('account-modal') || document.getElementById('auth-modal');
        if (m) m.classList.add('open');
      },
      openMobileProfile: (event?: any) => {
        if (event?.preventDefault) event.preventDefault();
        const m = document.getElementById('account-modal') || document.getElementById('auth-modal');
        if (m) m.classList.add('open');
      },
      openSignOutConfirm: () => {
        const m = document.getElementById('signout-confirm-modal');
        if (m) m.classList.add('open');
      },
      closeSignOutConfirm: () => {
        const m = document.getElementById('signout-confirm-modal');
        if (m) m.classList.remove('open');
      },
      open: () => {
        const m = document.getElementById('auth-modal');
        if (m) m.classList.add('open');
      },
      openAccountModal: (event?: any) => {
        if (event?.preventDefault) event.preventDefault();
        const m = document.getElementById('account-modal') || document.getElementById('auth-modal');
        if (m) m.classList.add('open');
      },
      close: () => {
        const a = document.getElementById('auth-modal');
        if (a) a.classList.remove('open');
        const acc = document.getElementById('account-modal');
        if (acc) acc.classList.remove('open');
        const so = document.getElementById('signout-confirm-modal');
        if (so) so.classList.remove('open');
      },
      signOut: async () => {
        try {
          await fetch('/api/auth/sign-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({}),
          });
        } catch {}
        try {
          localStorage.removeItem('chow45_auth_session_v1');
          localStorage.removeItem('chow45_user');
          localStorage.removeItem('chow45_marketplace_state_v2');
          localStorage.removeItem('chow45_vendor_trigger_setup');
          sessionStorage.clear();
        } catch {}
        window.location.replace('/app');
      },
    };

    let cancelled = false;

    const boot = async () => {
      // A Fast Refresh can re-run this effect while an earlier load is still
      // settling, so failures are retried once and the cache is cleared to
      // force genuinely fresh script tags.
      for (let attempt = 0; attempt < 2 && !cancelled; attempt += 1) {
        try {
          await loadAllScriptsSequentially();
          await waitForGlobals(REQUIRED_GLOBALS);
          if (cancelled) return;

          // init() guards against re-entry, so a Fast Refresh re-run is safe.
          window.Chow45App.init();

          // Apply requested role
          if (initialRole) {
            window.Chow45App.switchRole(initialRole);
            if (window.Chow45App.updateRoleUI) {
              window.Chow45App.updateRoleUI(initialRole);
            }
          }

          // Apply requested sub-tab if role is vendor
          if (
            initialRole === 'vendor' &&
            initialTab &&
            window.VendorController &&
            window.VendorController.switchSubTab
          ) {
            window.VendorController.switchSubTab(initialTab);
          }

          if (initialRole === 'vendor') {
            // Smoothly remove skeleton loader once vendor view has booted
            setTimeout(() => {
              if (!cancelled) setIsVendorLoading(false);
            }, 150);
          }
          return;
        } catch (err) {
          console.error('[chow45] marketplace boot failed', err);
          window._chow45ScriptsLoading = undefined;
          window.__chow45ScriptPromises = {};
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [initialRole, initialTab]);

  return (
    <div className="chow45-marketplace-wrapper min-h-screen relative">
      {/* Stylesheets for the marketplace shell */}
      <link rel="stylesheet" href="/app/css/tokens.css?v=20261017e" />
      <link rel="stylesheet" href="/app/css/layout.css?v=20261017e" />
      <link rel="stylesheet" href="/app/css/marketplace.css?v=20261017e" />
      <link rel="stylesheet" href="/app/css/tracking.css?v=20261017e" />
      <link rel="stylesheet" href="/app/css/location-picker.css?v=20261017e" />
      <link rel="stylesheet" href="/app/css/vendor.css?v=20261017e" />
      <link rel="stylesheet" href="/app/css/rider.css?v=20261017e" />
      <link rel="stylesheet" href="/app/css/admin.css?v=20261017e" />


      {/* When entering directly as vendor, prevent customer marketplace UI from flashing */}
      {initialRole === 'vendor' && (
        <style>{`
          #view-customer { display: none !important; }
          #view-vendor { display: block !important; }
          .bottom-nav[data-nav-for="customer"] { display: none !important; }
          @media (max-width: 768px) {
            .bottom-nav[data-nav-for="vendor"] { display: flex !important; }
          }
          @media (min-width: 769px) {
            .bottom-nav { display: none !important; }
            .vendor-topnav[data-nav-for="vendor"] { display: flex !important; }
          }
        `}</style>
      )}

      {/* When entering directly as customer, ensure customer nav displays and vendor nav is hidden */}
      {initialRole === 'customer' && (
        <style>{`
          #view-vendor { display: none !important; }
          #view-rider { display: none !important; }
          .bottom-nav[data-nav-for="vendor"] { display: none !important; }
          .bottom-nav[data-nav-for="rider"] { display: none !important; }
          .vendor-topnav[data-nav-for="vendor"] { display: none !important; }
          @media (max-width: 768px) {
            .bottom-nav[data-nav-for="customer"] { display: flex !important; }
          }
          @media (min-width: 769px) {
            .bottom-nav { display: none !important; }
          }
        `}</style>
      )}

      {/* When entering directly as rider, ensure rider view displays and others are hidden */}
      {initialRole === 'rider' && (
        <style>{`
          .top-nav { display: none !important; }
          #view-customer { display: none !important; }
          #view-vendor { display: none !important; }
          #view-admin { display: none !important; }
          #view-rider { display: block !important; background: #FFFDF6 !important; min-height: 100vh !important; }
          .bottom-nav[data-nav-for="customer"] { display: none !important; }
          .bottom-nav[data-nav-for="vendor"] { display: none !important; }
          .vendor-topnav { display: none !important; }
          @media (max-width: 768px) {
            .bottom-nav[data-nav-for="rider"] { display: flex !important; }
          }
        `}</style>
      )}

      {/* Dedicated Vendor Skeleton Loader while booting */}
      {initialRole === 'vendor' && isVendorLoading && (
        <VendorSkeletonLoader />
      )}

      {/* Injected marketplace DOM shell */}
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: MARKETPLACE_SHELL_HTML }}
      />
    </div>
  );
}

export default MarketplaceView;
