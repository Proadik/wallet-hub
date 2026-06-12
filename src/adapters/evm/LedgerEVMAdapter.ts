import { BaseAdapter } from '../../BaseAdapter';
import type { SignMessageOptions, LedgerAccount } from '../../types';
import { WalletReadyState } from '../../types';
import { parseWalletError } from '../../utils/parseWalletError';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import EthApp from '@ledgerhq/hw-app-eth';
import { ethers } from 'ethers';
import bs58 from 'bs58';

export class LedgerEVMAdapter extends BaseAdapter {
  name = 'Ledger';
  url = 'https://ledger.com';
  icon = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20rx%3D%2222%22%20fill%3D%22%23000%22%2F%3E%3Cpath%20d%3D%22M40%2020H20v40h20V20zM60%2020h20v20H60V20zM60%2060h20v20H60V60zM40%2060H20v20h20V60zM60%2040h20v20H60V40z%22%20fill%3D%22%23fff%22%2F%3E%3C%2Fsvg%3E';
  chain = 'evm' as const;
  readonly isLedger = true;
  rpcEndpoint: string | undefined;
  /** Separate RPC used only for balance fetching in the account picker. Falls back to rpcEndpoint. */
  balanceRpcEndpoint: string | undefined;

  private _transport: any = null;
  private _ethApp: EthApp | null = null;
  private _selectedAccount: LedgerAccount | null = null;
  private _networkChainId: bigint = 1n;
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

  private _rpcProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(this.rpcEndpoint ?? 'https://eth.llamarpc.com');
  }

  async openTransport(): Promise<void> {
    try {
      this._transport = await TransportWebHID.create();
    } catch {
      this._transport = await TransportWebUSB.create();
    }
    this._ethApp = new EthApp(this._transport);

    try {
      const provider = this._rpcProvider();
      const network = await provider.getNetwork();
      this._networkChainId = network.chainId;
      this.chainId = '0x' + network.chainId.toString(16);
    } catch { /* keep default */ }
  }

  private _balanceRpcProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(
      this.balanceRpcEndpoint ?? this.rpcEndpoint ?? 'https://eth.llamarpc.com'
    );
  }

  async getAccounts(count = 5, offset = 0): Promise<LedgerAccount[]> {
    if (!this._ethApp) throw new Error('Transport not open');
    const provider = this._balanceRpcProvider();
    const accounts: LedgerAccount[] = [];

    for (let i = offset; i < offset + count; i++) {
      const path = `44'/60'/0'/0/${i}`;
      const { address } = await this._ethApp.getAddress(path, false);
      const checksumAddress = ethers.getAddress(address);

      let balance = 0;
      try {
        const raw = await provider.getBalance(checksumAddress);
        balance = parseFloat(ethers.formatEther(raw));
      } catch { /* balance stays 0 */ }

      accounts.push({ path, address: checksumAddress, balance, index: i });
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
    this._ethApp = null;
  }

  async disconnect(): Promise<void> {
    await this.closeTransport();
    this._selectedAccount = null;
    this.setDisconnected();
  }

  async sendTransaction(tx: Record<string, any>): Promise<string> {
    if (!this._ethApp || !this._selectedAccount || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    try {
      const provider = this._rpcProvider();
      const from = this._selectedAccount.address;
      const nonce = await provider.getTransactionCount(from);
      const feeData = await provider.getFeeData();
      const gasLimit = tx.gas
        ? BigInt(tx.gas)
        : await provider.estimateGas({ from, to: tx.to, data: tx.data ?? '0x', value: BigInt(tx.value ?? 0) });

      const txFields = {
        type: 2,
        to: tx.to as string,
        value: BigInt(tx.value ?? 0),
        data: (tx.data ?? '0x') as string,
        nonce,
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas ?? 0n,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 0n,
        chainId: this._networkChainId,
      };

      const unsignedTx = ethers.Transaction.from(txFields);
      const rawHex = unsignedTx.unsignedSerialized.slice(2);

      const { v, r, s } = await this._ethApp.signTransaction(this._selectedAccount.path, rawHex, null);
      const sig = ethers.Signature.from({ v: parseInt(v, 16), r: '0x' + r, s: '0x' + s });
      const signedTx = ethers.Transaction.from({ ...txFields, signature: sig });

      return await provider.send('eth_sendRawTransaction', [signedTx.serialized]);
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this._ethApp || !this._selectedAccount || !this.connected) {
      const error = parseWalletError(new Error('Wallet not connected'));
      this.setError(error);
      throw error;
    }

    try {
      const msgHex = Buffer.from(options.message).toString('hex');
      const { v, r, s } = await this._ethApp.signPersonalMessage(this._selectedAccount.path, msgHex);
      const sig = '0x' + r + s + (v - 27).toString(16).padStart(2, '0');
      const bytes = ethers.getBytes(sig);
      return bytes;
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

  async request(args: { method: string; params?: any[] }): Promise<any> {
    return this._rpcProvider().send(args.method, args.params ?? []);
  }
}
