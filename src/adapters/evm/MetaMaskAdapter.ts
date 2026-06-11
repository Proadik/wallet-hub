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
  _metamask?: {
    isUnlocked?: () => Promise<boolean>;
  };
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

declare global {
  interface Window {
    ethereum?: EthereumProvider | EthereumProvider[];
    addEventListener(type: 'eip6963:announceProvider', listener: (event: CustomEvent<EIP6963ProviderDetail>) => void): void;
    dispatchEvent(event: Event): boolean;
  }
}

/**
 * MetaMask wallet adapter for EVM-compatible blockchains.
 * Supports EIP-6963 provider discovery and fallback detection.
 */
export class MetaMaskAdapter extends BaseAdapter {
  name = 'MetaMask';
  url = 'https://metamask.io';
  icon = 'data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22iso-8859-1%22%3F%3E%3C!--%20Generator%3A%20Adobe%20Illustrator%2029.4.0%2C%20SVG%20Export%20Plug-In%20.%20SVG%20Version%3A%209.03%20Build%200)%20%20--%3E%3Csvg%20version%3D%221.1%22%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%20viewBox%3D%220%200%20142%20136.878%22%20style%3D%22enable-background%3Anew%200%200%20142%20136.878%3B%22%20xml%3Aspace%3D%22preserve%22%3E%3Cpath%20style%3D%22fill%3A%23FF5C16%3B%22%20d%3D%22M132.682%2C132.192l-30.583-9.106l-23.063%2C13.787l-16.092-0.007l-23.077-13.78l-30.569%2C9.106L0%2C100.801l9.299-34.839L0%2C36.507L9.299%2C0l47.766%2C28.538h27.85L132.682%2C0l9.299%2C36.507l-9.299%2C29.455l9.299%2C34.839L132.682%2C132.192L132.682%2C132.192z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23FF5C16%3B%22%20d%3D%22M9.305%2C0l47.767%2C28.558l-1.899%2C19.599L9.305%2C0z%20M39.875%2C100.814l21.017%2C16.01l-21.017%2C6.261C39.875%2C123.085%2C39.875%2C100.814%2C39.875%2C100.814z%20M59.212%2C74.345l-4.039-26.174L29.317%2C65.97l-0.014-0.007v0.013l0.08%2C18.321l10.485-9.951L59.212%2C74.345L59.212%2C74.345z%20M132.682%2C0L84.915%2C28.558l1.893%2C19.599L132.682%2C0z%20M102.113%2C100.814l-21.018%2C16.01l21.018%2C6.261V100.814z%20M112.678%2C65.975h0.007H112.678v-0.013l-0.006%2C0.007L86.815%2C48.171l-4.039%2C26.174h19.336l10.492%2C9.95C112.604%2C84.295%2C112.678%2C65.975%2C112.678%2C65.975z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23E34807%3B%22%20d%3D%22M39.868%2C123.085l-30.569%2C9.106L0%2C100.814h39.868C39.868%2C100.814%2C39.868%2C123.085%2C39.868%2C123.085z%20M59.205%2C74.338l5.839%2C37.84l-8.093-21.04L29.37%2C84.295l10.491-9.956h19.344L59.205%2C74.338z%20M102.112%2C123.085l30.57%2C9.106l9.299-31.378h-39.869C102.112%2C100.814%2C102.112%2C123.085%2C102.112%2C123.085z%20M82.776%2C74.338l-5.839%2C37.84l8.092-21.04l27.583-6.843l-10.498-9.956H82.776V74.338z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23FF8D5D%3B%22%20d%3D%22M0%2C100.801l9.299-34.839h19.997l0.073%2C18.327l27.584%2C6.843l8.092%2C21.039l-4.16%2C4.633l-21.017-16.01H0V100.801z%20M141.981%2C100.801l-9.299-34.839h-19.998l-0.073%2C18.327l-27.582%2C6.843l-8.093%2C21.039l4.159%2C4.633l21.018-16.01h39.868V100.801z%20M84.915%2C28.538h-27.85l-1.891%2C19.599l9.872%2C64.013h11.891l9.878-64.013L84.915%2C28.538z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23661800%3B%22%20d%3D%22M9.299%2C0L0%2C36.507l9.299%2C29.455h19.997l25.87-17.804L9.299%2C0z%20M53.426%2C81.938h-9.059l-4.932%2C4.835l17.524%2C4.344l-3.533-9.186V81.938z%20M132.682%2C0l9.299%2C36.507l-9.299%2C29.455h-19.998L86.815%2C48.158L132.682%2C0z%20M88.568%2C81.938h9.072l4.932%2C4.841l-17.544%2C4.353l3.54-9.201V81.938z%20M79.029%2C124.385l2.067-7.567l-4.16-4.633h-11.9l-4.159%2C4.633l2.066%2C7.567%22%2F%3E%3Cpath%20style%3D%22fill%3A%23C0C4CD%3B%22%20d%3D%22M79.029%2C124.384v12.495H62.945v-12.495L79.029%2C124.384L79.029%2C124.384z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23E7EBF6%3B%22%20d%3D%22M39.875%2C123.072l23.083%2C13.8v-12.495l-2.067-7.566C60.891%2C116.811%2C39.875%2C123.072%2C39.875%2C123.072z%20M102.113%2C123.072l-23.084%2C13.8v-12.495l2.067-7.566C81.096%2C116.811%2C102.113%2C123.072%2C102.113%2C123.072z%22%2F%3E%3C%2Fsvg%3E';
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
   * Gets the ready state of the MetaMask wallet.
   * @returns WalletReadyState indicating if MetaMask is installed
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
      console.log('[MetaMaskAdapter] EIP-6963 provider discovered:', event.detail.info.name);
    }) as EventListener);

    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  /**
   * Finds MetaMask provider from EIP-6963 discovered providers.
   * @returns MetaMask provider if found, undefined otherwise
   */
  private _pickMetaMaskFromEIP6963(): EthereumProvider | undefined {
    const metamask = this._discoveredProviders.find(
      (d) =>
        d.info.rdns === 'io.metamask' ||
        d.info.name.toLowerCase().includes('metamask')
    );

    if (metamask) {
      console.log('[MetaMaskAdapter] Found MetaMask via EIP-6963:', metamask.info.name);
      return metamask.provider;
    }

    return undefined;
  }

  /**
   * Finds the MetaMask provider using EIP-6963 discovery or fallback detection.
   * @returns MetaMask provider if found, undefined otherwise
   */
  private _findMetaMaskProvider(): EthereumProvider | undefined {
    if (typeof window === 'undefined') return undefined;

    const eip6963MetaMask = this._pickMetaMaskFromEIP6963();
    if (eip6963MetaMask) {
      return eip6963MetaMask;
    }

    // EIP-6963 found providers (e.g. Trust Wallet) but MetaMask wasn't among them.
    // Don't fall through to window.ethereum — another wallet is masquerading as MetaMask.
    if (this._discoveredProviders.length > 0) {
      return undefined;
    }

    const eth = window.ethereum as any;
    if (!eth) return undefined;

    if (eth && !Array.isArray(eth) && eth.providers && Array.isArray(eth.providers)) {
      const metamask = eth.providers.find((p: any) => {
        const isMetaMask = !!p?.isMetaMask;
        const isTrust = !!p?.isTrust || !!p?.isTrustWallet;
        return isMetaMask && !isTrust;
      });

      if (metamask) {
        console.log('[MetaMaskAdapter] Found MetaMask in providers array');
        return metamask;
      }
    }

    if (Array.isArray(eth)) {
      const found = eth.find((p: any) => {
        const isMetaMask = !!p?.isMetaMask;
        const isTrust = !!p?.isTrust || !!p?.isTrustWallet;
        return isMetaMask && !isTrust;
      });

      if (found) {
        console.log('[MetaMaskAdapter] Found MetaMask in array');
        return found;
      }
    }

    if (eth && !Array.isArray(eth)) {
      const isTrust = !!eth.isTrust || !!eth.isTrustWallet;
      const isMetaMask = !!eth.isMetaMask;

      console.log('[MetaMaskAdapter] Single provider detected:', {
        isMetaMask,
        isTrust,
        mobileAdapter: eth.mobileAdapter !== undefined,
      });

      if (isMetaMask && !isTrust) {
        console.log('[MetaMaskAdapter] Accepted: isMetaMask without Trust flags');
        return eth;
      }
    }

    console.log('[MetaMaskAdapter] No MetaMask provider found');
    return undefined;
  }

  /**
   * Detects if MetaMask wallet is installed.
   */
  private _detectProvider(): void {
    if (typeof window === 'undefined') return;

    const ethereumProvider = this._findMetaMaskProvider();

    if (ethereumProvider && ethereumProvider.isMetaMask === true) {
      this._provider = ethereumProvider;
      this._readyState = WalletReadyState.Installed;
    } else {
      this._provider = null;
      this._readyState = WalletReadyState.NotDetected;
    }
  }

  /**
   * Sets up event listeners for account changes and disconnection.
   * Safe to call multiple times — attaches only once per provider instance.
   */
  private _setupListeners(): void {
    if (!this._provider || !this._provider.isMetaMask) return;
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
   * Connects to the MetaMask wallet.
   * @throws {WalletError} If MetaMask is not detected or connection fails
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    if (typeof window === 'undefined') {
      const error = parseWalletError(new Error('MetaMask wallet not detected'));
      this.setError(error);
      throw error;
    }

    const metamaskProvider = this._findMetaMaskProvider();
    console.log('--metamaskProvider', metamaskProvider)

    if (!metamaskProvider || metamaskProvider.isMetaMask !== true) {
      const error = parseWalletError(new Error('MetaMask wallet not detected'));
      this.setError(error);
      throw error;
    }

    this._provider = metamaskProvider;
    // Register listeners now in case EIP-6963 resolved after construction
    this._setupListeners();

    this.connecting = true;

    try {
      // wallet_requestPermissions always shows the account picker, so the user
      // can select any account — not just the one previously connected to this site.
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
   * Disconnects from the MetaMask wallet.
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
   * Sends an EVM transaction using MetaMask.
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
   * Signs a message using MetaMask wallet.
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
   * Sends a request to the MetaMask provider.
   * @param args - Request arguments with method and optional params
   * @returns The result of the request
   * @throws {WalletError} If MetaMask is not detected or request fails
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this._provider) {
      const error = parseWalletError(new Error('MetaMask wallet not detected'));
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

