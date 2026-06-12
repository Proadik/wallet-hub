import { BaseAdapter } from '../../BaseAdapter';
import type { SignMessageOptions } from '../../types';
import { WalletReadyState } from '../../types';
import { parseWalletError } from '../../utils/parseWalletError';
import bs58 from 'bs58';

// MetaMask v12.7+ exposes Solana via its CAIP-25 multichain API, not snaps.
// Solana mainnet CAIP-2 chain ID used by MetaMask.
const SOLANA_SCOPE = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9';

interface EthereumProvider {
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EthereumProvider[];
  request(args: { method: string; params?: any }): Promise<any>;
  on(event: string, handler: Function): void;
}

export class MetaMaskSolanaAdapter extends BaseAdapter {
  name = 'MetaMask';
  url = 'https://metamask.io';
  icon = 'data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22iso-8859-1%22%3F%3E%3C!--%20Generator%3A%20Adobe%20Illustrator%2029.4.0%2C%20SVG%20Export%20Plug-In%20.%20SVG%20Version%3A%209.03%20Build%200)%20%20--%3E%3Csvg%20version%3D%221.1%22%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%20viewBox%3D%220%200%20142%20136.878%22%20style%3D%22enable-background%3Anew%200%200%20142%20136.878%3B%22%20xml%3Aspace%3D%22preserve%22%3E%3Cpath%20style%3D%22fill%3A%23FF5C16%3B%22%20d%3D%22M132.682%2C132.192l-30.583-9.106l-23.063%2C13.787l-16.092-0.007l-23.077-13.78l-30.569%2C9.106L0%2C100.801l9.299-34.839L0%2C36.507L9.299%2C0l47.766%2C28.538h27.85L132.682%2C0l9.299%2C36.507l-9.299%2C29.455l9.299%2C34.839L132.682%2C132.192L132.682%2C132.192z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23FF5C16%3B%22%20d%3D%22M9.305%2C0l47.767%2C28.558l-1.899%2C19.599L9.305%2C0z%20M39.875%2C100.814l21.017%2C16.01l-21.017%2C6.261C39.875%2C123.085%2C39.875%2C100.814%2C39.875%2C100.814z%20M59.212%2C74.345l-4.039-26.174L29.317%2C65.97l-0.014-0.007v0.013l0.08%2C18.321l10.485-9.951L59.212%2C74.345L59.212%2C74.345z%20M132.682%2C0L84.915%2C28.558l1.893%2C19.599L132.682%2C0z%20M102.113%2C100.814l-21.018%2C16.01l21.018%2C6.261V100.814z%20M112.678%2C65.975h0.007H112.678v-0.013l-0.006%2C0.007L86.815%2C48.171l-4.039%2C26.174h19.336l10.492%2C9.95C112.604%2C84.295%2C112.678%2C65.975%2C112.678%2C65.975z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23E34807%3B%22%20d%3D%22M39.868%2C123.085l-30.569%2C9.106L0%2C100.814h39.868C39.868%2C100.814%2C39.868%2C123.085%2C39.868%2C123.085z%20M59.205%2C74.338l5.839%2C37.84l-8.093-21.04L29.37%2C84.295l10.491-9.956h19.344L59.205%2C74.338z%20M102.112%2C123.085l30.57%2C9.106l9.299-31.378h-39.869C102.112%2C100.814%2C102.112%2C123.085%2C102.112%2C123.085z%20M82.776%2C74.338l-5.839%2C37.84l8.092-21.04l27.583-6.843l-10.498-9.956H82.776V74.338z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23FF8D5D%3B%22%20d%3D%22M0%2C100.801l9.299-34.839h19.997l0.073%2C18.327l27.584%2C6.843l8.092%2C21.039l-4.16%2C4.633l-21.017-16.01H0V100.801z%20M141.981%2C100.801l-9.299-34.839h-19.998l-0.073%2C18.327l-27.582%2C6.843l-8.093%2C21.039l4.159%2C4.633l21.018-16.01h39.868V100.801z%20M84.915%2C28.538h-27.85l-1.891%2C19.599l9.872%2C64.013h11.891l9.878-64.013L84.915%2C28.538z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23661800%3B%22%20d%3D%22M9.299%2C0L0%2C36.507l9.299%2C29.455h19.997l25.87-17.804L9.299%2C0z%20M53.426%2C81.938h-9.059l-4.932%2C4.835l17.524%2C4.344l-3.533-9.186V81.938z%20M132.682%2C0l9.299%2C36.507l-9.299%2C29.455h-19.998L86.815%2C48.158L132.682%2C0z%20M88.568%2C81.938h9.072l4.932%2C4.841l-17.544%2C4.353l3.54-9.201V81.938z%20M79.029%2C124.385l2.067-7.567l-4.16-4.633h-11.9l-4.159%2C4.633l2.066%2C7.567%22%2F%3E%3Cpath%20style%3D%22fill%3A%23C0C4CD%3B%22%20d%3D%22M79.029%2C124.384v12.495H62.945v-12.495L79.029%2C124.384L79.029%2C124.384z%22%2F%3E%3Cpath%20style%3D%22fill%3A%23E7EBF6%3B%22%20d%3D%22M39.875%2C123.072l23.083%2C13.8v-12.495l-2.067-7.566C60.891%2C116.811%2C39.875%2C123.072%2C39.875%2C123.072z%20M102.113%2C123.072l-23.084%2C13.8v-12.495l2.067-7.566C81.096%2C116.811%2C102.113%2C123.072%2C102.113%2C123.072z%22%2F%3E%3C%2Fsvg%3E';
  chain = 'solana' as const;
  rpcEndpoint: string | undefined;

  private _ethereum: EthereumProvider | null = null;
  private _readyState: WalletReadyState = WalletReadyState.NotDetected;
  private _mobileSolana: any = null;  // window.solana on MetaMask Mobile
  private _useCaip25 = false;         // MetaMask desktop native Solana (CAIP-25)

  constructor(options?: { rpcEndpoint?: string; icon?: unknown }) {
    super();
    this.rpcEndpoint = options?.rpcEndpoint;
    this.customIcon = options?.icon;
    this._detectProvider();
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  private _findMetaMaskEthereum(): EthereumProvider | null {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    const eth = window.ethereum as any;

    // Multiple providers injected (e.g. MetaMask + Trust Wallet)
    if (eth.providers && Array.isArray(eth.providers)) {
      return eth.providers.find((p: any) => p.isMetaMask && !p.isTrust && !p.isTrustWallet) ?? null;
    }

    if (eth.isMetaMask && !eth.isTrust && !eth.isTrustWallet) return eth;
    return null;
  }

  private _detectProvider(): void {
    const mm = this._findMetaMaskEthereum();
    if (mm) {
      this._ethereum = mm;
      this._readyState = WalletReadyState.Installed;
    }
  }

  private _caip25Invoke(method: string, params?: Record<string, any>): Promise<any> {
    return this._ethereum!.request({
      method: 'wallet_invokeMethod',
      params: { scope: SOLANA_SCOPE, request: params ? { method, params } : { method } },
    });
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    if (!this._ethereum) this._detectProvider();
    if (!this._ethereum) {
      const error = parseWalletError(new Error('MetaMask not detected'));
      this.setError(error);
      throw error;
    }

    this.connecting = true;

    try {
      // MetaMask Mobile injects window.solana with isMetaMask: true
      const windowSolana = (window as any).solana;
      if (windowSolana?.isMetaMask) {
        const response = await windowSolana.connect();
        this._mobileSolana = windowSolana;
        this._useCaip25 = false;
        this.setConnected(response.publicKey.toString());
        return;
      }

      const evmAccounts: string[] = await this._ethereum.request({ method: 'eth_requestAccounts' });
      console.log('[MetaMaskSolanaAdapter] eth_requestAccounts:', evmAccounts);

      const installedSnaps = await this._ethereum.request({ method: 'wallet_getSnaps' });
      console.log('[MetaMaskSolanaAdapter] wallet_getSnaps:', JSON.stringify(installedSnaps, null, 2));

      // MetaMask's CAIP-25 handler throws "wallet must has at least one account"
      // if no scope in requiredScopes has any account. We anchor the session to
      // the already-connected EVM account so MetaMask can build a valid session,
      // then ask for Solana optionally on top.
      const evmAddress = evmAccounts[0];
      const evmChains = ['eip155:1', 'eip155:137', 'eip155:56'];
      const requiredScopes: Record<string, any> = {};
      evmChains.forEach(c => {
        requiredScopes[c] = {
          methods: [],
          notifications: [],
          accounts: evmAddress ? [`${c}:${evmAddress}`] : [],
        };
      });

      console.log('[MetaMaskSolanaAdapter] Trying wallet_createSession (CAIP-25)…');
      const session = await this._ethereum.request({
        method: 'wallet_createSession',
        params: {
          requiredScopes,
          optionalScopes: {
            [SOLANA_SCOPE]: {
              methods: ['solana_signTransaction', 'solana_signMessage', 'solana_sendTransaction'],
              notifications: ['accountsChanged'],
            },
          },
        },
      });
      console.log('[MetaMaskSolanaAdapter] wallet_createSession result:', JSON.stringify(session, null, 2));

      const sessionScopes = session?.sessionScopes ?? {};
      const scopeAccounts: string[] = sessionScopes[SOLANA_SCOPE]?.accounts ?? [];
      console.log('[MetaMaskSolanaAdapter] Solana scope accounts:', scopeAccounts);

      const address = scopeAccounts[0]?.split(':').pop();
      if (!address) throw new Error('No Solana account returned from MetaMask');

      this._useCaip25 = true;
      this._mobileSolana = null;
      this.setConnected(address);
    } catch (error: any) {
      console.error('[MetaMaskSolanaAdapter] connect error:', error);
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async disconnect(): Promise<void> {
    this._useCaip25 = false;
    this._mobileSolana = null;
    this.setDisconnected();
  }

  async sendTransaction(transaction: any): Promise<string> {
    if (!this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    try {
      if (this._mobileSolana?.signAndSendTransaction) {
        const { signature } = await this._mobileSolana.signAndSendTransaction(transaction, {
          preflightCommitment: 'confirmed',
        });
        return signature;
      }

      if (this._useCaip25) {
        const serialized = Buffer.from(
          transaction.serialize({ requireAllSignatures: false })
        ).toString('base64');
        const result: { signature: string } = await this._caip25Invoke(
          'solana_sendTransaction', { transaction: serialized }
        );
        return result.signature;
      }

      throw new Error('Not connected');
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    try {
      if (this._mobileSolana?.signMessage) {
        const response = await this._mobileSolana.signMessage(options.message);
        return response.signature;
      }

      if (this._useCaip25) {
        const base64Message = Buffer.from(options.message).toString('base64');
        const result: { signature: string } = await this._caip25Invoke(
          'solana_signMessage', { message: base64Message, pubkey: this.publicKey }
        );
        return Buffer.from(result.signature, 'base64');
      }

      throw new Error('Not connected');
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async signMessageAndEncodeToBase58(message: string): Promise<string> {
    if (!this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    try {
      if (this._mobileSolana?.signMessage) {
        const encoded = new TextEncoder().encode(message);
        const response = await this._mobileSolana.signMessage(encoded);
        return bs58.encode(response.signature);
      }

      if (this._useCaip25) {
        const encoded = new TextEncoder().encode(message);
        const base64Message = Buffer.from(encoded).toString('base64');
        const result: { signature: string } = await this._caip25Invoke(
          'solana_signMessage', { message: base64Message, pubkey: this.publicKey }
        );
        return bs58.encode(Buffer.from(result.signature, 'base64'));
      }

      throw new Error('Not connected');
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }
}
