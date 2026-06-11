import { WalletEnvironment } from '../types';

function isWindowAvailable(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

function isMobileUserAgent(ua: string): boolean {
  return /android|iphone|ipad|ipod|opera mini|iemobile|wpdesktop/i.test(ua);
}

function hasAnyWalletProvider(): boolean {
  if (!isWindowAvailable()) return false;

  const w = window as any;
  return (
    !!w.ethereum ||
    !!w.solana ||
    !!w.phantom?.solana ||
    !!w.solflare
  );
}

function isPwaDisplayMode(): boolean {
  if (!isWindowAvailable()) return false;

  const w = window as any;
  const mqStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  // iOS Safari PWA
  const navStandalone = typeof w.navigator !== 'undefined' && w.navigator.standalone;

  return !!(mqStandalone || navStandalone);
}

/**
 * Detects the high-level environment in which wallets are rendered.
 * This is intentionally heuristic-based and kept lightweight.
 */
export function detectWalletEnvironment(): WalletEnvironment {
  if (!isWindowAvailable()) {
    // Default to desktop browser semantics in non-DOM environments
    return WalletEnvironment.DesktopBrowser;
  }

  const ua = navigator.userAgent || navigator.vendor || '';
  const isMobile = isMobileUserAgent(ua);
  const hasProvider = hasAnyWalletProvider();
  const isPwa = isPwaDisplayMode();

  if (isPwa) {
    return WalletEnvironment.Pwa;
  }

  if (isMobile) {
    if (hasProvider) {
      return WalletEnvironment.MobileDappBrowser;
    }
    return WalletEnvironment.MobileBrowser;
  }

  // Desktop
  if (hasProvider) {
    return WalletEnvironment.DesktopDappBrowser;
  }

  return WalletEnvironment.DesktopBrowser;
}


