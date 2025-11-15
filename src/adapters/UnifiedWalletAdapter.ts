import { BaseAdapter } from '../BaseAdapter';
import { WalletReadyState, SignMessageOptions } from '../types';
import { parseWalletError } from '../utils';
import bs58 from 'bs58';

/**
 * Unified wallet adapter that manages multiple wallet adapters.
 * Allows switching between different wallets while maintaining a single active wallet.
 */
export class UnifiedWalletAdapter extends BaseAdapter {
  name = 'Unified Wallet';
  url = '';
  icon = '';
  
  private _wallets: BaseAdapter[] = [];
  private _activeWallet: BaseAdapter | null = null;

  /**
   * Creates a new UnifiedWalletAdapter instance.
   * @param wallets - Array of wallet adapters to manage
   */
  constructor(wallets: BaseAdapter[]) {
    super();
    this._wallets = wallets;
    
    this._wallets.forEach(wallet => {
      wallet.on('connect', (publicKey: string) => {
        if (wallet === this._activeWallet) {
          this.setConnected(publicKey);
        }
      });
      
      wallet.on('disconnect', () => {
        if (wallet === this._activeWallet) {
          this.setDisconnected();
        }
      });
      
      wallet.on('error', (error: Error) => {
        if (wallet === this._activeWallet) {
          this.setError(error);
        }
      });
    });
  }

  /**
   * Gets the ready state of the active wallet.
   * @returns WalletReadyState of the active wallet, or NotDetected if none selected
   */
  get readyState(): WalletReadyState {
    if (this._activeWallet) {
      return this._activeWallet.readyState;
    }
    return WalletReadyState.NotDetected;
  }

  /**
   * Gets all available wallets.
   * @returns Array of all wallet adapters
   */
  get wallets(): BaseAdapter[] {
    return this._wallets;
  }

  /**
   * Gets the currently active wallet.
   * @returns The active wallet adapter or null if none selected
   */
  get activeWallet(): BaseAdapter | null {
    return this._activeWallet;
  }

  /**
   * Checks if the active wallet is Phantom.
   * @returns True if Phantom wallet is active
   */
  get isPhantom(): boolean {
    return this._activeWallet?.name === 'Phantom' || 
           this._activeWallet?.constructor.name === 'PhantomWalletAdapter';
  }

  /**
   * Checks if the active wallet is Solflare.
   * @returns True if Solflare wallet is active
   */
  get isSolflare(): boolean {
    return this._activeWallet?.name === 'Solflare' || 
           this._activeWallet?.constructor.name === 'SolflareWalletAdapter';
  }

  /**
   * Checks if the active wallet is MetaMask.
   * @returns True if MetaMask wallet is active
   */
  get isMetaMask(): boolean {
    return this._activeWallet?.name === 'MetaMask' || 
           this._activeWallet?.constructor.name === 'MetaMaskAdapter';
  }

  /**
   * Checks if the active wallet is Trust Wallet.
   * @returns True if Trust Wallet is active
   */
  get isTrust(): boolean {
    return this._activeWallet?.name === 'Trust Wallet' || 
           this._activeWallet?.constructor.name === 'TrustWalletAdapter';
  }

  /**
   * Selects a wallet to become the active wallet.
   * Disconnects from the current wallet if connected.
   * @param wallet - The wallet adapter to activate
   */
  selectWallet(wallet: BaseAdapter): void {
    if (this._activeWallet && this._activeWallet.connected) {
      this._activeWallet.disconnect().catch(() => {});
    }

    this._activeWallet = wallet;
    
    if (wallet.connected && wallet.publicKey) {
      this.setConnected(wallet.publicKey);
    } else {
      this.setDisconnected();
    }
  }

  /**
   * Connects to the active wallet.
   * @throws {WalletError} If no wallet is selected or connection fails
   */
  async connect(): Promise<void> {
    if (!this._activeWallet) {
      const error = parseWalletError(new Error('No wallet selected'));
      this.setError(error);
      throw error;
    }

    if (this.connected || this.connecting) return;

    this.connecting = true;
    try {
      await this._activeWallet.connect();
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Disconnects from the active wallet.
   * @throws {WalletError} If disconnection fails
   */
  async disconnect(): Promise<void> {
    if (!this._activeWallet) {
      return;
    }

    try {
      await this._activeWallet.disconnect();
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Signs a message using the active wallet.
   * @param options - Message signing options
   * @returns Signature as Uint8Array
   * @throws {WalletError} If no wallet is selected, signing is not supported, or signing fails
   */
  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this._activeWallet) {
      const error = parseWalletError(new Error('No wallet selected'));
      this.setError(error);
      throw error;
    }

    if (!this._activeWallet.signMessage) {
      const error = parseWalletError(new Error('Message signing not supported by this wallet'));
      this.setError(error);
      throw error;
    }

    try {
      return await this._activeWallet.signMessage(options);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Signs a message and encodes the signature to base58.
   * @param message - The message string to sign
   * @returns Base58 encoded signature string
   * @throws {WalletError} If no wallet is selected, signing is not supported, or signing fails
   */
  async signMessageAndEncodeToBase58(message: string): Promise<string> {
    if (!this._activeWallet) {
      const error = parseWalletError(new Error('No wallet selected'));
      this.setError(error);
      throw error;
    }

    if (typeof (this._activeWallet as any).signMessageAndEncodeToBase58 === 'function') {
      try {
        return await (this._activeWallet as any).signMessageAndEncodeToBase58(message);
      } catch (error: any) {
        const walletError = parseWalletError(error);
        this.setError(walletError);
        throw walletError;
      }
    }

    if (!this._activeWallet.signMessage) {
      const error = parseWalletError(new Error('Message signing not supported by this wallet'));
      this.setError(error);
      throw error;
    }

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await this._activeWallet.signMessage({ message: encodedMessage });
      return bs58.encode(signature);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Sends a request to the active wallet provider (EVM wallets only).
   * @param args - Request arguments with method and optional params
   * @returns The result of the request
   * @throws {WalletError} If no wallet is selected, request method is not supported, or request fails
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    if (!this._activeWallet) {
      const error = parseWalletError(new Error('No wallet selected'));
      this.setError(error);
      throw error;
    }

    if (typeof (this._activeWallet as any).request === 'function') {
      try {
        return await (this._activeWallet as any).request(args);
      } catch (error: any) {
        const walletError = parseWalletError(error);
        this.setError(walletError);
        throw walletError;
      }
    }

    const error = parseWalletError(new Error('Request method not supported by this wallet'));
    this.setError(error);
    throw error;
  }
}
