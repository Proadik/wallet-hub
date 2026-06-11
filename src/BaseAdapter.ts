import type {
  WalletAdapter,
  WalletAdapterEvents,
  SendTransactionOptions,
  SignMessageOptions,
} from './types';
import {
  WalletReadyState,
  WalletError,
  WalletErrorCode,
} from './types';

export abstract class BaseAdapter implements WalletAdapter, WalletAdapterEvents {
  abstract name: string;
  abstract url: string;
  abstract icon: string;
  abstract chain: 'evm' | 'solana';
  abstract get readyState(): WalletReadyState;

  publicKey: string | null = null;
  chainId: string | null = null;
  connecting: boolean = false;
  connected: boolean = false;

  protected listeners: Map<string, Set<Function>> = new Map();

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  sendTransaction?(_options: SendTransactionOptions): Promise<string> {
    throw new Error('sendTransaction not implemented');
  }

  signMessage?(_options: SignMessageOptions): Promise<Uint8Array> {
    throw new Error('signMessage not implemented');
  }

  on(event: 'connect', callback: (publicKey: string) => void): void;
  on(event: 'disconnect', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'chainChanged', callback: (chainId: string) => void): void;
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  protected emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  protected setConnected(publicKey: string): void {
    this.publicKey = publicKey;
    this.connected = true;
    this.connecting = false;
    this.emit('connect', publicKey);
  }

  protected setDisconnected(): void {
    this.publicKey = null;
    this.connected = false;
    this.connecting = false;
    this.chainId = null;
    this.emit('disconnect');
  }

  protected setError(error: Error): void {
    this.connecting = false;
    if (error instanceof WalletError) {
      if (
        error.code === WalletErrorCode.WALLET_NOT_CONNECTED ||
        error.code === WalletErrorCode.WALLET_NOT_DETECTED
      ) {
        this.setDisconnected();
      }
    }
    this.emit('error', error);
  }
}
