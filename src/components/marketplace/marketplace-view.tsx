'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MARKETPLACE_SHELL_HTML } from '@/lib/marketplace-html';

interface MarketplaceViewProps {
  initialRole?: 'customer' | 'vendor' | 'rider' | 'admin';
  initialTab?: 'food' | 'orders' | 'money' | 'store' | 'home';
}

declare global {
  interface Window {
    __CHOW45_MAPBOX_TOKEN__?: string;
    _chow45Initialized?: boolean;
    _chow45ScriptsLoading?: Promise<void>;
    __chow45ScriptPromises?: Record<string, Promise<void>>;
    Chow45App?: any;
    VendorController?: any;
    CustomerController?: any;
    RiderController?: any;
    AdminController?: any;
    Chow45Auth?: any;
    ChowUnits?: any;
    chowStore?: any;
  }
}

const SCRIPTS_TO_LOAD = [
  'https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.js',
  '/app/js/mapbox-config.js?v=20260928c',
  '/app/js/service-zones.js',
  // Units must be ready before the controllers read it, so it loads ahead of
  // state, customer and vendor.
  '/app/js/units.js?v=20260928a',
  '/app/js/data.js?v=20260927f',
  '/app/js/state.js?v=20260928a',
  '/app/js/mapbox-service.js?v=20260928c',
  '/app/js/location-picker.js',
  '/app/js/customer.js?v=20260928a',
  '/app/js/vendor.js?v=20260928b',
  '/app/js/rider.js',
  '/app/js/admin.js',
  '/app/js/auth.js?v=20260930b',
  // Must be ready before app.js boots, because app.js starts the gate.
  '/app/js/vendor-onboarding.js?v=20260928a',
  '/app/js/app.js?v=20260928b',
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

    const script = existing ?? document.createElement('script');
    const settleOk = () => resolve();
    const settleFail = () => {
      // A 404 or network error leaves the page permanently half-initialised if
      // it is swallowed, so the failure is surfaced and the entry is dropped so
      // a later attempt can retry.
      delete cache[src];
      script.remove();
      reject(new Error(`Failed to load script ${src}`));
    };

    script.addEventListener('load', settleOk);
    script.addEventListener('error', settleFail);

    if (!existing) {
      script.src = src;
      script.async = false;
      script.dataset.chow45Src = src;
      document.body.appendChild(script);
      return;
    }

    // A tag is already on the page (static shell, or a Fast Refresh re-run).
    // If it has not finished loading we must wait for it rather than assume it
    // is ready.
    if (existing.getAttribute('data-chow45-loaded') === 'true') {
      resolve();
    }
  });

  cache[src] = promise;
  promise
    .then(() => {
      const el = document.querySelector<HTMLScriptElement>(
        `script[data-chow45-src="${CSS.escape(src)}"]`
      );
      if (el) el.setAttribute('data-chow45-loaded', 'true');
    })
    .catch(() => {});

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
    for (const src of SCRIPTS_TO_LOAD) {
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

  useEffect(() => {
    setMounted(true);

    // Provide public Mapbox token to global scope.
    // No hardcoded fallback: the token must come from NEXT_PUBLIC_MAPBOX_TOKEN.
    // Mapbox degrades gracefully when it is absent.
    window.__CHOW45_MAPBOX_TOKEN__ =
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

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
    <div className="chow45-marketplace-wrapper min-h-screen">
      {/* Stylesheets for the marketplace shell */}
      <link
        rel="stylesheet"
        href="https://api.mapbox.com/mapbox-gl-js/v3.1.2/mapbox-gl.css"
      />
      <link rel="stylesheet" href="/app/css/tokens.css" />
      <link rel="stylesheet" href="/app/css/layout.css?v=20260928b" />
      <link rel="stylesheet" href="/app/css/marketplace.css?v=20260928a" />
      <link rel="stylesheet" href="/app/css/tracking.css" />
      <link rel="stylesheet" href="/app/css/location-picker.css?v=20260928a" />
      <link rel="stylesheet" href="/app/css/vendor.css?v=20260928a" />
      <link rel="stylesheet" href="/app/css/rider.css" />
      <link rel="stylesheet" href="/app/css/admin.css" />

      {/* Injected marketplace DOM shell */}
      <div
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: MARKETPLACE_SHELL_HTML }}
      />
    </div>
  );
}

export default MarketplaceView;
