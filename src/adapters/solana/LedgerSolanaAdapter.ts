import { BaseAdapter } from '../../BaseAdapter';
import type { SignMessageOptions, LedgerAccount } from '../../types';
import { WalletReadyState } from '../../types';
import { parseWalletError } from '../../utils/parseWalletError';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import SolanaApp from '@ledgerhq/hw-app-solana';
import { PublicKey, Connection } from '@solana/web3.js';
import bs58 from 'bs58';

export class LedgerSolanaAdapter extends BaseAdapter {
  name = 'Ledger';
  url = 'https://ledger.com';
  icon = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2222%22%20fill%3D%22%23000%22%2F%3E%3Cpath%20d%3D%22M40%2020H20v40h20V20zM60%2020h20v20H60V20zM60%2060h20v20H60V60zM40%2060H20v20h20V60zM60%2040h20v20H60V40z%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E';
  chain = 'solana' as const;
  readonly isLedger = true;
  rpcEndpoint: string | undefined;
  /** Separate RPC used only for balance fetching in the account picker. Falls back to rpcEndpoint. */
  balanceRpcEndpoint: string | undefined;

  private _transport: any = null;
  private _solanaApp: SolanaApp | null = null;
  private _selectedAccount: LedgerAccount | null = null;
  private _readyState: WalletReadyState;

  constructor(options?: { rpcEndpoint?: string; balanceRpcEndpoint?: string; icon?: unknown }) {
    super();
    this.rpcEndpoint = options?.rpcEndpoint;
    this.balanceRpcEndpoint = options?.balanceRpcEndpoint;
    this.customIcon = options?.icon;
    this._readyState = this._detectBrowserSupport();
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  private _detectBrowserSupport(): WalletReadyState {
    if (typeof navigator === 'undefined') return WalletReadyState.NotDetected;
    if ('hid' in navigator || 'usb' in navigator) return WalletReadyState.Installed;
    return WalletReadyState.NotDetected;
  }

  async openTransport(): Promise<void> {
    try {
      this._transport = await TransportWebHID.create();
    } catch {
      this._transport = await TransportWebUSB.create();
    }
    this._solanaApp = new SolanaApp(this._transport);
  }

  async getAccounts(count = 5, offset = 0): Promise<LedgerAccount[]> {
    if (!this._solanaApp) throw new Error('Transport not open');
    const rpc = this.balanceRpcEndpoint ?? this.rpcEndpoint ?? 'https://api.mainnet-beta.solana.com';
    const accounts: LedgerAccount[] = [];

    for (let i = offset; i < offset + count; i++) {
      const path = `44'/501'/${i}'/0'`;
      const { address } = await this._solanaApp.getAddress(path, false);
      const pubkey = new PublicKey(address as unknown as Uint8Array);
      const pubkeyStr = pubkey.toBase58();

      let balance = 0;
      try {
        const res = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [pubkeyStr] }),
        });
        const json = await res.json();
        balance = (json.result?.value ?? 0) / 1e9;
      } catch { /* balance stays 0 */ }

      accounts.push({ path, address: pubkeyStr, balance, index: i });
    }

    return accounts;
  }

  selectAccount(account: LedgerAccount): void {
    this._selectedAccount = account;
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;
    if (!this._selectedAccount) {
      const error = parseWalletError(new Error('No Ledger account selected'));
      this.setError(error);
      throw error;
    }

    this.connecting = true;
    try {
      this.setConnected(this._selectedAccount.address);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async closeTransport(): Promise<void> {
    try { await this._transport?.close(); } catch { /* ignore */ }
    this._transport = null;
    this._solanaApp = null;
  }

  async disconnect(): Promise<void> {
    await this.closeTransport();
    this._selectedAccount = null;
    this.setDisconnected();
  }

  async sendTransaction(transaction: any): Promise<string> {
    if (!this._solanaApp || !this._selectedAccount || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    try {
      const rpc = this.rpcEndpoint ?? 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpc, 'confirmed');
      const pubkey = new PublicKey(this._selectedAccount.address);

      if (!transaction.feePayer) transaction.feePayer = pubkey;
      if (!transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
      }

      const messageBytes = transaction.serializeMessage();
      const { signature } = await this._solanaApp.signTransaction(
        this._selectedAccount.path,
        Buffer.from(messageBytes),
      );
      transaction.addSignature(pubkey, Buffer.from(signature));

      const rawTx = transaction.serialize({ requireAllSignatures: true });
      return await connection.sendRawTransaction(rawTx);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this._solanaApp || !this._selectedAccount || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    try {
      const { signature } = await (this._solanaApp as any).signOffchainMessage(
        this._selectedAccount.path,
        Buffer.from(options.message),
      );
      return new Uint8Array(signature);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async signMessageAndEncodeToBase58(message: string): Promise<string> {
    const encoded = new TextEncoder().encode(message);
    const sig = await this.signMessage({ message: encoded });
    return bs58.encode(sig);
  }
}
