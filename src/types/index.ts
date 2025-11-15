export interface WalletAdapter {
  name: string;
  url: string;
  icon: string;
  readyState: WalletReadyState;
  publicKey: string | null;
  connecting: boolean;
  connected: boolean;
}

export enum WalletReadyState {
  Installed = 'Installed',
  NotDetected = 'NotDetected',
  Loadable = 'Loadable',
}

export interface WalletAdapterEvents {
  on(event: 'connect', callback: (publicKey: string) => void): void;
  on(event: 'disconnect', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
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

export * from './errors';

