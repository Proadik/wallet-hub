import {BaseAdapter} from '../../BaseAdapter';
import type {SignMessageOptions} from '../../types';
import {WalletReadyState} from '../../types';
import {parseWalletError} from '../../utils/parseWalletError';
import bs58 from 'bs58';

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on?(event: string, handler: (...args: any[]) => void): void;
  removeListener?(event: string, handler: (...args: any[]) => void): void;
  signTransaction?(transaction: any): Promise<any>;
  signAllTransactions?(transactions: any[]): Promise<any[]>;
  signMessage?(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction?(
    transaction: any,
    options?: { preflightCommitment?: string }
  ): Promise<{ signature: string }>;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solana?: PhantomProvider;
  }
}

/**
 * Phantom wallet adapter for Solana blockchain.
 */
export class PhantomWalletAdapter extends BaseAdapter {
  name = 'Phantom';
  url = 'https://phantom.app';
  icon = 'data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22128%22%20height%3D%22128%22%20viewBox%3D%220%200%20128%20128%22%20fill%3D%22none%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20fill%3D%22%23AB9FF2%22%2F%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M55.6416%2082.1477C50.8744%2089.4525%2042.8862%2098.6966%2032.2568%2098.6966C27.232%2098.6966%2022.4004%2096.628%2022.4004%2087.6424C22.4004%2064.7584%2053.6445%2029.3335%2082.6339%2029.3335C99.1257%2029.3335%20105.697%2040.7755%20105.697%2053.7689C105.697%2070.4471%2094.8739%2089.5171%2084.1156%2089.5171C80.7013%2089.5171%2079.0264%2087.6424%2079.0264%2084.6688C79.0264%2083.8931%2079.1552%2083.0527%2079.4129%2082.1477C75.7409%2088.4182%2068.6546%2094.2361%2062.0192%2094.2361C57.1877%2094.2361%2054.7397%2091.1979%2054.7397%2086.9314C54.7397%2085.3799%2055.0618%2083.7638%2055.6416%2082.1477ZM80.6133%2053.3182C80.6133%2057.1044%2078.3795%2058.9975%2075.8806%2058.9975C73.3438%2058.9975%2071.1479%2057.1044%2071.1479%2053.3182C71.1479%2049.532%2073.3438%2047.6389%2075.8806%2047.6389C78.3795%2047.6389%2080.6133%2049.532%2080.6133%2053.3182ZM94.8102%2053.3184C94.8102%2057.1046%2092.5763%2058.9977%2090.0775%2058.9977C87.5407%2058.9977%2085.3447%2057.1046%2085.3447%2053.3184C85.3447%2049.5323%2087.5407%2047.6392%2090.0775%2047.6392C92.5763%2047.6392%2094.8102%2049.5323%2094.8102%2053.3184Z%22%20fill%3D%22%23FFFDF8%22%2F%3E%3C%2Fsvg%3E';
  chain = 'solana' as const;
  rpcEndpoint: string | undefined;

  private _provider: PhantomProvider | null = null;
  private _readyState: WalletReadyState = WalletReadyState.NotDetected;

  constructor(options?: { rpcEndpoint?: string }) {
    super();
    this.rpcEndpoint = options?.rpcEndpoint;
    this._detectProvider();
    this._setupListeners();
  }

  /**
   * Gets the ready state of the Phantom wallet.
   * @returns WalletReadyState indicating if Phantom is installed
   */
  get readyState(): WalletReadyState {
    return this._readyState;
  }

  /**
   * Detects if Phantom wallet is installed.
   */
  private _detectProvider(): void {
    if (typeof window === 'undefined') return;

    this._provider = window.phantom?.solana || window.solana || null;

    if (this._provider) {
      this._readyState = WalletReadyState.Installed;
    }
  }

  /**
   * Sets up provider event listeners for Phantom.
   * Currently only listens for 'disconnect' to keep adapter state in sync
   * when the user revokes the dapp from the wallet UI.
   */
  private _setupListeners(): void {
    if (!this._provider || typeof this._provider.on !== 'function') return;

    this._provider.on('disconnect', () => {
      this.setDisconnected();
    });
  }

  /**
   * Connects to the Phantom wallet.
   * @throws {WalletError} If Phantom is not detected or connection fails
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    if (!this._provider) {
      const error = parseWalletError(new Error('Phantom wallet not detected'));
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

  /**
   * Disconnects from the Phantom wallet.
   * @throws {WalletError} If disconnection fails
   */
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

  /**
   * Signs and sends a transaction using Phantom wallet.
   * Uses the wallet's configured network/cluster.
   * @param transaction - The transaction to sign and send
   * @returns Transaction signature string returned by the wallet/network
   * @throws {WalletError} If wallet is not connected, signing is not supported, or sending fails
   */
  async sendTransaction(transaction: any): Promise<string> {
    if (!this._provider || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    if (!this._provider.signAndSendTransaction) {
      const error = parseWalletError(
        new Error('Transaction sending not supported by this wallet'),
      );
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

  /**
   * Signs a message using Phantom wallet.
   * @param options - Message signing options with Uint8Array message
   * @returns Signature as Uint8Array
   * @throws {WalletError} If wallet is not connected, signing is not supported, or signing fails
   */
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

  /**
   * Signs a message string and returns the signature encoded as base58.
   * @param message - The message string to sign
   * @returns Base58 encoded signature string
   * @throws {WalletError} If wallet is not connected, signing is not supported, or signing fails
   */
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
