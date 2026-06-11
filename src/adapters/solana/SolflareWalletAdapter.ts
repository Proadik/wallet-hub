import {BaseAdapter} from '../../BaseAdapter';
import type {SignMessageOptions} from '../../types';
import {WalletReadyState} from '../../types';
import {parseWalletError} from '../../utils/parseWalletError';
import bs58 from 'bs58';

interface SolflareProvider {
  isSolflare?: boolean;
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
    solflare?: SolflareProvider;
  }
}

/**
 * Solflare wallet adapter for Solana blockchain.
 */
export class SolflareWalletAdapter extends BaseAdapter {
  name = 'Solflare';
  url = 'https://solflare.com';
  icon = 'data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%3Csvg%20width%3D%22128%22%20height%3D%22128%22%20viewBox%3D%220%200%20128%20128%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22128%22%20height%3D%22128%22%20rx%3D%2226%22%20fill%3D%22%23FF6B35%22%2F%3E%3Cpath%20d%3D%22M64%2020C40.2%2020%2021%2039.2%2021%2063C21%2086.8%2040.2%20106%2064%20106C87.8%20106%20107%2086.8%20107%2063C107%2039.2%2087.8%2020%2064%2020ZM64%2095C45.2%2095%2030%2079.8%2030%2061C30%2042.2%2045.2%2027%2064%2027C82.8%2027%2098%2042.2%2098%2061C98%2079.8%2082.8%2095%2064%2095Z%22%20fill%3D%22white%22%2F%3E%3Cpath%20d%3D%22M64%2033C48.5%2033%2036%2045.5%2036%2061C36%2076.5%2048.5%2089%2064%2089C79.5%2089%2092%2076.5%2092%2061C92%2045.5%2079.5%2033%2064%2033ZM64%2083C52.4%2083%2043%2073.6%2043%2062C43%2050.4%2052.4%2041%2064%2041C75.6%2041%2085%2050.4%2085%2062C85%2073.6%2075.6%2083%2064%2083Z%22%20fill%3D%22%23FF6B35%22%2F%3E%3C%2Fsvg%3E';
  chain = 'solana' as const;
  rpcEndpoint: string | undefined;

  private _provider: SolflareProvider | null = null;
  private _readyState: WalletReadyState = WalletReadyState.NotDetected;

  constructor(options?: { rpcEndpoint?: string }) {
    super();
    this.rpcEndpoint = options?.rpcEndpoint;
    this._detectProvider();
  }

  /**
   * Gets the ready state of the Solflare wallet.
   * @returns WalletReadyState indicating if Solflare is installed
   */
  get readyState(): WalletReadyState {
    return this._readyState;
  }

  /**
   * Detects if Solflare wallet is installed.
   */
  private _detectProvider(): void {
    if (typeof window === 'undefined') return;

    const handleReady = () => {
      this._provider = window.solflare || null;

      if (this._provider && this._provider.isSolflare) {
        this._readyState = WalletReadyState.Installed;
        this._setupListeners();
      }
    };

    // Try immediately
    handleReady();

    // If not yet injected, listen for late injection events
    if (!this._provider) {
      window.addEventListener('load', () => {
        handleReady();
      }, { once: true } as any);

      // Some Solflare builds dispatch a custom initialization event
      window.addEventListener('solflare#initialized' as any, () => {
        handleReady();
      }, { once: true } as any);
    }
  }

  /**
   * Sets up provider event listeners for Solflare.
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
   * Connects to the Solflare wallet.
   * @throws {WalletError} If Solflare is not detected or connection fails
   */
  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    if (!this._provider) {
      const error = parseWalletError(new Error('Solflare wallet not detected'));
      this.setError(error);
      throw error;
    }

    this.connecting = true;

    try {
      const response = await this._provider.connect();
      let publicKey: string;
      if (response && response.publicKey) {
        publicKey = response.publicKey.toString();
      } else if (this._provider.publicKey) {
        publicKey = this._provider.publicKey.toString();
      } else {
        throw new Error('No public key returned from Solflare wallet');
      }
      this.setConnected(publicKey);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  /**
   * Disconnects from the Solflare wallet.
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
   * Signs and sends a transaction using Solflare wallet.
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
   * Signs a message using Solflare wallet.
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
