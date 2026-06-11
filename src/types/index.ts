export interface WalletAdapter {
  name: string;
  url: string;
  icon: string;
  chain: 'evm' | 'solana';
  readyState: WalletReadyState;
  publicKey: string | null;
  chainId: string | null;
  connecting: boolean;
  connected: boolean;
}

export const WalletReadyState = {
  Installed: 'Installed',
  NotDetected: 'NotDetected',
} as const;
export type WalletReadyState = (typeof WalletReadyState)[keyof typeof WalletReadyState];

export interface WalletAdapterEvents {
  on(event: 'connect', callback: (publicKey: string) => void): void;
  on(event: 'disconnect', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'chainChanged', callback: (chainId: string) => void): void;
  off(event: string, callback: Function): void;
}

export interface SendTransactionOptions {
  skipPreflight?: boolean;
  preflightCommitment?: string;
  maxRetries?: number;
}

export interface SignMessageOptions {
  message: Uint8Array;
}

export interface ChainConfig {
  name: string;
  rpcUrl?: string;
  chainId?: number | string;
}

export const WalletEnvironment = {
  DesktopBrowser: 'desktop-browser',
  DesktopDappBrowser: 'desktop-dapp-browser',
  MobileBrowser: 'mobile-browser',
  MobileDappBrowser: 'mobile-dapp-browser',
  Pwa: 'pwa',
} as const;
export type WalletEnvironment = (typeof WalletEnvironment)[keyof typeof WalletEnvironment];

export * from './errors';
