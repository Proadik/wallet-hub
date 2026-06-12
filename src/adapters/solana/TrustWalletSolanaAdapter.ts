import { BaseAdapter } from '../../BaseAdapter';
import type { SignMessageOptions } from '../../types';
import { WalletReadyState } from '../../types';
import { parseWalletError } from '../../utils/parseWalletError';
import bs58 from 'bs58';

interface TrustSolanaProvider {
  isTrust?: boolean;
  isTrustWallet?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on?(event: string, handler: (...args: any[]) => void): void;
  removeListener?(event: string, handler: (...args: any[]) => void): void;
  signMessage?(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?(
    transaction: any,
    options?: { preflightCommitment?: string }
  ): Promise<{ signature: string }>;
}

declare global {
  interface Window {
    trustwallet?: {
      solana?: TrustSolanaProvider;
    };
  }
}

export class TrustWalletSolanaAdapter extends BaseAdapter {
  name = 'Trust Wallet';
  url = 'https://trustwallet.com';
  icon = 'data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%3Csvg%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20viewBox%3D%220%200%201920%201080%22%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill%3Aurl(%23linear-gradient)%3B%7D.cls-2%7Bfill%3A%230500ff%3B%7D%3C%2Fstyle%3E%3ClinearGradient%20id%3D%22linear-gradient%22%20x1%3D%221123.26%22%20y1%3D%221865.78%22%20x2%3D%22954.61%22%20y2%3D%221337.5%22%20gradientTransform%3D%22translate(0%202182)%20scale(1%20-1)%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20offset%3D%22.02%22%20stop-color%3D%22blue%22%2F%3E%3Cstop%20offset%3D%22.08%22%20stop-color%3D%22%230094ff%22%2F%3E%3Cstop%20offset%3D%22.16%22%20stop-color%3D%22%2348ff91%22%2F%3E%3Cstop%20offset%3D%22.42%22%20stop-color%3D%22%230094ff%22%2F%3E%3Cstop%20offset%3D%22.68%22%20stop-color%3D%22%230038ff%22%2F%3E%3Cstop%20offset%3D%22.9%22%20stop-color%3D%22%230500ff%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m738.71%2C423.41l221.45-72.3v500.52c-158.18-66.74-221.45-194.65-221.45-266.94v-161.28Z%22%2F%3E%3Cpath%20class%3D%22cls-1%22%20d%3D%22m1181.62%2C423.41l-221.45-72.3v500.52c158.18-66.74%2C221.45-194.65%2C221.45-266.94v-161.28Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m825.91%2C230.85h30.9v17.31c10.13-15.56%2C21.78-17.31%2C38.84-17.31v30.6h-7.77c-20.44%2C0-30.23%2C9.62-30.23%2C28.67v32.52h-31.75v-91.79Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m998.78%2C322.63h-31.75v-8.75c-6.93%2C8.05-16.38%2C11.54-28.03%2C11.54-22.12%2C0-34.62-13.11-34.62-37.24v-57.34h31.75v50.18c0%2C11.36%2C5.57%2C18%2C15.02%2C18s15.88-6.47%2C15.88-17.48v-50.7h31.75v91.79Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m1006.54%2C294.3h29.73c1.36%2C6.64%2C5.91%2C9.43%2C16.88%2C9.43%2C8.95%2C0%2C14.19-2.09%2C14.19-5.94%2C0-2.98-2.54-4.9-9.79-6.47l-23.98-5.42c-16.04-3.66-24.15-12.93-24.15-27.8%2C0-19.59%2C14.35-29.73%2C42.21-29.73s41.54%2C9.88%2C43.91%2C31.04h-29.55c-.5-5.59-6.25-9.01-15.7-9.01-7.59%2C0-12.49%2C2.44-12.49%2C6.12%2C0%2C3.14%2C3.2%2C5.59%2C9.63%2C7.18l25.16%2C6.12c16.54%2C4.01%2C24.49%2C12.41%2C24.49%2C26.05%2C0%2C18.89-16.38%2C30.08-44.23%2C30.08s-46.27-12.06-46.27-31.65h-.03Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m1181.62%2C259.4v-28.55h-78.35v28.56h23.38v63.22h31.58v-63.24h23.39Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m817.08%2C259.4v-28.55h-78.35v28.56h23.38v63.22h31.58v-63.24h23.38Z%22%2F%3E%3C%2Fsvg%3E';
  chain = 'solana' as const;
  rpcEndpoint: string | undefined;

  private _provider: TrustSolanaProvider | null = null;
  private _readyState: WalletReadyState = WalletReadyState.NotDetected;

  constructor(options?: { rpcEndpoint?: string; icon?: unknown }) {
    super();
    this.rpcEndpoint = options?.rpcEndpoint;
    this.customIcon = options?.icon;
    this._detectProvider();
    this._setupListeners();
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  private _detectProvider(): void {
    if (typeof window === 'undefined') return;

    const solana = window.trustwallet?.solana;
    if (solana) {
      this._provider = solana;
      this._readyState = WalletReadyState.Installed;
      return;
    }

    // Fallback: window.solana injected by Trust Wallet (e.g. mobile in-app browser)
    const windowSolana = (window as any).solana;
    if (windowSolana && (windowSolana.isTrust || windowSolana.isTrustWallet)) {
      this._provider = windowSolana;
      this._readyState = WalletReadyState.Installed;
    }
  }

  private _setupListeners(): void {
    if (!this._provider || typeof this._provider.on !== 'function') return;

    this._provider.on('disconnect', () => {
      this.setDisconnected();
    });
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    if (!this._provider) {
      const error = parseWalletError(new Error('Trust Wallet not detected'));
      this.setError(error);
      throw error;
    }

    this.connecting = true;

    try {
      const response = await this._provider.connect();
      const publicKey = response.publicKey.toString();
      this.setConnected(publicKey);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async disconnect(): Promise<void> {
    if (!this._provider) return;

    try {
      await this._provider.disconnect();
      this.setDisconnected();
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async sendTransaction(transaction: any): Promise<string> {
    if (!this._provider || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    if (!this._provider.signAndSendTransaction) {
      const error = parseWalletError(new Error('Transaction sending not supported by this wallet'));
      this.setError(error);
      throw error;
    }

    try {
      const { signature } = await this._provider.signAndSendTransaction(transaction, {
        preflightCommitment: 'confirmed',
      });
      return signature;
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this._provider || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    if (!this._provider.signMessage) {
      const error = parseWalletError(new Error('Message signing not supported'));
      this.setError(error);
      throw error;
    }

    try {
      const response = await this._provider.signMessage(options.message);
      return response.signature;
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async signMessageAndEncodeToBase58(message: string): Promise<string> {
    if (!this._provider || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    if (!this._provider.signMessage) {
      const error = parseWalletError(new Error('Message signing not supported'));
      this.setError(error);
      throw error;
    }

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const response = await this._provider.signMessage(encodedMessage);
      return bs58.encode(response.signature);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }
}
