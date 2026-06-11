import { BaseAdapter } from '../../BaseAdapter';
import type { SignMessageOptions } from '../../types';
import { WalletReadyState } from '../../types';
import { parseWalletError } from '../../utils';
import bs58 from 'bs58';

interface EthereumProvider {
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EthereumProvider[];
  mobileAdapter?: any;
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, handler: Function): void;
  removeListener(event: string, handler: Function): void;
}

interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns?: string;
  };
  provider: EthereumProvider;
}

/**
 * Trust Wallet adapter for EVM-compatible blockchains.
 * Supports EIP-6963 provider discovery and fallback detection.
 */
export class TrustWalletAdapter extends BaseAdapter {
  name = 'Trust Wallet';
  url = 'https://trustwallet.com';
  icon = 'data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%3Csvg%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20viewBox%3D%220%200%201920%201080%22%3E%3Cdefs%3E%3Cstyle%3E.cls-1%7Bfill%3Aurl(%23linear-gradient)%3B%7D.cls-2%7Bfill%3A%230500ff%3B%7D%3C%2Fstyle%3E%3ClinearGradient%20id%3D%22linear-gradient%22%20x1%3D%221123.26%22%20y1%3D%221865.78%22%20x2%3D%22954.61%22%20y2%3D%221337.5%22%20gradientTransform%3D%22translate(0%202182)%20scale(1%20-1)%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20offset%3D%22.02%22%20stop-color%3D%22blue%22%2F%3E%3Cstop%20offset%3D%22.08%22%20stop-color%3D%22%230094ff%22%2F%3E%3Cstop%20offset%3D%22.16%22%20stop-color%3D%22%2348ff91%22%2F%3E%3Cstop%20offset%3D%22.42%22%20stop-color%3D%22%230094ff%22%2F%3E%3Cstop%20offset%3D%22.68%22%20stop-color%3D%22%230038ff%22%2F%3E%3Cstop%20offset%3D%22.9%22%20stop-color%3D%22%230500ff%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m738.71%2C423.41l221.45-72.3v500.52c-158.18-66.74-221.45-194.65-221.45-266.94v-161.28Z%22%2F%3E%3Cpath%20class%3D%22cls-1%22%20d%3D%22m1181.62%2C423.41l-221.45-72.3v500.52c158.18-66.74%2C221.45-194.65%2C221.45-266.94v-161.28Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m825.91%2C230.85h30.9v17.31c10.13-15.56%2C21.78-17.31%2C38.84-17.31v30.6h-7.77c-20.44%2C0-30.23%2C9.62-30.23%2C28.67v32.52h-31.75v-91.79Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m998.78%2C322.63h-31.75v-8.75c-6.93%2C8.05-16.38%2C11.54-28.03%2C11.54-22.12%2C0-34.62-13.11-34.62-37.24v-57.34h31.75v50.18c0%2C11.36%2C5.57%2C18%2C15.02%2C18s15.88-6.47%2C15.88-17.48v-50.7h31.75v91.79Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m1006.54%2C294.3h29.73c1.36%2C6.64%2C5.91%2C9.43%2C16.88%2C9.43%2C8.95%2C0%2C14.19-2.09%2C14.19-5.94%2C0-2.98-2.54-4.9-9.79-6.47l-23.98-5.42c-16.04-3.66-24.15-12.93-24.15-27.8%2C0-19.59%2C14.35-29.73%2C42.21-29.73s41.54%2C9.88%2C43.91%2C31.04h-29.55c-.5-5.59-6.25-9.01-15.7-9.01-7.59%2C0-12.49%2C2.44-12.49%2C6.12%2C0%2C3.14%2C3.2%2C5.59%2C9.63%2C7.18l25.16%2C6.12c16.54%2C4.01%2C24.49%2C12.41%2C24.49%2C26.05%2C0%2C18.89-16.38%2C30.08-44.23%2C30.08s-46.27-12.06-46.27-31.65h-.03Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m1181.62%2C259.4v-28.55h-78.35v28.56h23.38v63.22h31.58v-63.24h23.39Z%22%2F%3E%3Cpath%20class%3D%22cls-2%22%20d%3D%22m817.08%2C259.4v-28.55h-78.35v28.56h23.38v63.22h31.58v-63.24h23.38Z%22%2F%3E%3C%2Fsvg%3E';
  chain = 'evm' as const;
  private _provider: EthereumProvider | null = null;
  private _readyState: WalletReadyState = WalletReadyState.NotDetected;
  private _discoveredProviders: EIP6963ProviderDetail[] = [];
  private _listenersAttached = false;

  constructor() {
    super();
    this._setupEIP6963Discovery();
    this._detectProvider();
    this._setupListeners();
  }

  /**
   * Gets the ready state of the Trust Wallet.
   * @returns WalletReadyState indicating if Trust Wallet is installed
   */
  get readyState(): WalletReadyState {
    return this._readyState;
  }

  /**
   * Sets up EIP-6963 provider discovery listener.
   */
  private _setupEIP6963Discovery(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('eip6963:announceProvider', ((event: CustomEvent<EIP6963ProviderDetail>) => {
      this._discoveredProviders.push(event.detail);
      console.log('[TrustWalletAdapter] EIP-6963 provider discovered:', event.detail.info.name);
    }) as EventListener);

    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  /**
   * Finds Trust Wallet provider from EIP-6963 discovered providers.
   * @returns Trust Wallet provider if found, undefined otherwise
   */
  private _pickTrustFromEIP6963(): EthereumProvider | undefined {
    const trust = this._discoveredProviders.find(
      (d) =>
        d.info.rdns === 'com.trustwallet.app' ||
        d.info.name.toLowerCase().includes('trust')
    );

    if (trust) {
      console.log('[TrustWalletAdapter] Found Trust Wallet via EIP-6963:', trust.info.name);
      return trust.provider;
    }

    return undefined;
  }

  /**
   * Finds the Trust Wallet provider using EIP-6963 discovery or fallback detection.
   * @returns Trust Wallet provider if found, undefined otherwise
   */
  private _findTrustWalletProvider(): EthereumProvider | undefined {
    if (typeof window === 'undefined') return undefined;

    const eip6963Trust = this._pickTrustFromEIP6963();
    if (eip6963Trust) {
      return eip6963Trust;
    }

    const eth = window.ethereum as any;
    if (!eth) return undefined;

    if (eth && !Array.isArray(eth) && eth.providers && Array.isArray(eth.providers)) {
      const trust = eth.providers.find((p: any) => {
        const isTrust = !!p?.isTrust || !!p?.isTrustWallet;
        return isTrust;
      });

      if (trust) {
        console.log('[TrustWalletAdapter] Found Trust Wallet in providers array');
        return trust;
      }
    }

    if (Array.isArray(eth)) {
      const found = eth.find((p: any) => {
        const isTrust = !!p?.isTrust || !!p?.isTrustWallet;
        return isTrust;
      });

      if (found) {
        console.log('[TrustWalletAdapter] Found Trust Wallet in array');
        return found;
      }
    }

    if (eth && !Array.isArray(eth)) {
      const isTrust = !!eth.isTrust || !!eth.isTrustWallet;
      const hasMobileAdapter = eth.mobileAdapter !== undefined;

      console.log('[TrustWalletAdapter] Single provider detected:', {
        isTrust,
        hasMobileAdapter,
        isMetaMask: eth.isMetaMask,
      });

      if (isTrust || hasMobileAdapter) {
        console.log('[TrustWalletAdapter] Accepted: Trust Wallet detected');
        return eth;
      }
    }

    console.log('[TrustWalletAdapter] No Trust Wallet provider found');
    return undefined;
  }

  /**
   * Detects if Trust Wallet is installed.
   */
  private _detectProvider(): void {
    if (typeof window === 'undefined') return;

    const ethereumProvider = this._findTrustWalletProvider();

    if (ethereumProvider && (ethereumProvider.isTrust === true || ethereumProvider.isTrustWallet === true || ethereumProvider.mobileAdapter !== undefined)) {
      this._provider = ethereumProvider;
      this._readyState = WalletReadyState.Installed;
    } else {
      this._provider = null;
      this._readyState = WalletReadyState.NotDetected;
    }
  }

  /**
   * Sets up event listeners for account changes and disconnection.
   */
  private _setupListeners(): void {
    if (!this._provider) return;
    if (this._listenersAttached) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        this.setDisconnected();
      } else {
        this.setConnected(accounts[0]);
      }
    };

    const handleChainChanged = (chainId: string) => {
      this.chainId = chainId;
      this.emit('chainChanged', chainId);
    };

    const handleDisconnect = () => {
      this.setDisconnected();
    };

    this._provider.on('accountsChanged', handleAccountsChanged);
    this._provider.on('chainChanged', handleChainChanged);
    this._provider.on('disconnect', handleDisconnect);
    this._listenersAttached = true;
  }

  /**
   * Connects to the Trust Wallet.
   * @throws {WalletError} If Trust Wallet is not detected or connection fails
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    if (typeof window === 'undefined') {
      const error = parseWalletError(new Error('Trust Wallet not detected'));
      this.setError(error);
      throw error;
    }

    const trustProvider = this._findTrustWalletProvider();

    if (!trustProvider || (!trustProvider.isTrust && !trustProvider.isTrustWallet && !trustProvider.mobileAdapter)) {
      const error = parseWalletError(new Error('Trust Wallet not detected'));
      this.setError(error);
      throw error;
    }

    this._provider = trustProvider;
    this._setupListeners();
    this.connecting = true;

    try {
      await this._provider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts = await this._provider.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        this.setConnected(accounts[0]);
      }
      try {
        this.chainId = await this._provider.request({ method: 'eth_chainId' });
      } catch {
        this.chainId = null;
      }
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Disconnects from the Trust Wallet.
   */
  async disconnect(): Promise<void> {
    this._listenersAttached = false;
    this.setDisconnected();
  }

  /**
   * Converts Uint8Array to hexadecimal string.
   * @param uint8Array - The Uint8Array to convert
   * @returns Hexadecimal string representation
   */
  private _uint8ArrayToHex(uint8Array: Uint8Array): string {
    return Array.from(uint8Array)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Converts hexadecimal string to Uint8Array.
   * @param hex - The hexadecimal string to convert
   * @returns Uint8Array representation
   */
  private _hexToUint8Array(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Sends an EVM transaction using Trust Wallet.
   * This both requests a signature from the user and broadcasts the tx.
   *
   * @param tx - EVM transaction request object (to, value, data, gas, etc.)
   * @returns Transaction hash as a string
   * @throws {WalletError} If wallet is not connected, no account connected, or sending fails
   */
  async sendTransaction(tx: Record<string, any>): Promise<string> {
    if (!this._provider || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    if (!this.publicKey) {
      const error = parseWalletError(new Error('No account connected'));
      this.setError(error);
      throw error;
    }

    try {
      const txWithFrom = {
        ...tx,
        from: tx.from ?? this.publicKey,
      };

      const txHash = await this._provider.request({
        method: 'eth_sendTransaction',
        params: [txWithFrom],
      });

      return txHash;
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Signs a message using Trust Wallet.
   * @param options - Message signing options with Uint8Array message
   * @returns Signature as Uint8Array
   * @throws {WalletError} If wallet is not connected, no account connected, or signing fails
   */
  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this._provider || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    if (!this.publicKey) {
      const error = parseWalletError(new Error('No account connected'));
      this.setError(error);
      throw error;
    }

    try {
      const messageHex = '0x' + this._uint8ArrayToHex(options.message);

      const signatureHex = await this._provider.request({
        method: 'personal_sign',
        params: [messageHex, this.publicKey],
      });

      return this._hexToUint8Array(signatureHex);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Signs a message string and returns the signature encoded as base58.
   * @param message - The message string to sign
   * @returns Base58 encoded signature string
   * @throws {WalletError} If wallet is not connected, no account connected, or signing fails
   */
  async signMessageAndEncodeToBase58(message: string): Promise<string> {
    if (!this._provider || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    if (!this.publicKey) {
      const error = parseWalletError(new Error('No account connected'));
      this.setError(error);
      throw error;
    }

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const messageHex = '0x' + this._uint8ArrayToHex(encodedMessage);

      const signatureHex = await this._provider.request({
        method: 'personal_sign',
        params: [messageHex, this.publicKey],
      });

      const signatureUint8Array = this._hexToUint8Array(signatureHex);
      return bs58.encode(signatureUint8Array);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Sends a request to the Trust Wallet provider.
   * @param args - Request arguments with method and optional params
   * @returns The result of the request
   * @throws {WalletError} If Trust Wallet is not detected or request fails
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this._provider) {
      const error = parseWalletError(new Error('Trust Wallet not detected'));
      this.setError(error);
      throw error;
    }

    try {
      return await this._provider.request(args);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }
}

