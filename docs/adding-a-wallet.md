# Adding a New Wallet to wallet-hub

## 1. Determine the chain type

| Chain | Folder | Base pattern |
|---|---|---|
| EVM (Ethereum, Polygon, BSC, …) | `src/adapters/evm/` | Copy `TrustWalletAdapter.ts` |
| Solana | `src/adapters/solana/` | Copy `PhantomWalletAdapter.ts` |

---

## 2. Create the adapter file

### EVM wallet example — `src/adapters/evm/SafePalAdapter.ts`

```ts
import { BaseAdapter } from '../../BaseAdapter';
import type { SignMessageOptions, WalletReadyState } from '../../types';
import { parseWalletError } from '../../utils';

// Extend window.ethereum with the wallet's identity flag
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface EIP6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns?: string };
  provider: any;
}

export class SafePalAdapter extends BaseAdapter {
  name    = 'SafePal';
  url     = 'https://safepal.com';
  icon    = 'data:image/svg+xml,...'; // paste the wallet's SVG data URI here
  chain   = 'evm' as const;

  private _provider: any = null;
  private _readyState: WalletReadyState = WalletReadyState.NotDetected;
  private _discoveredProviders: EIP6963ProviderDetail[] = [];
  private _listenersAttached = false;

  constructor() {
    super();
    this._setupEIP6963Discovery();
    this._detectProvider();
  }

  get readyState() { return this._readyState; }

  // ── Provider discovery ────────────────────────────────────────

  private _setupEIP6963Discovery(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('eip6963:announceProvider', ((e: CustomEvent<EIP6963ProviderDetail>) => {
      this._discoveredProviders.push(e.detail);
    }) as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  private _detectProvider(): void {
    if (this._findSafePalProvider()) {
      this._readyState = WalletReadyState.Installed;
    }
  }

  private _findSafePalProvider(): any {
    // EIP-6963 first (reliable, no masquerading)
    const via6963 = this._discoveredProviders.find(
      d => d.info.rdns === 'com.safepal' || d.info.name.toLowerCase().includes('safepal')
    );
    if (via6963) return via6963.provider;

    // Fallback: window.ethereum identity flag
    const eth = window.ethereum;
    if (eth?.isSafePal) return eth;
    if (Array.isArray(eth?.providers)) {
      return eth.providers.find((p: any) => p?.isSafePal) ?? null;
    }
    return null;
  }

  // ── Event listeners ───────────────────────────────────────────

  private _setupListeners(): void {
    if (!this._provider || this._listenersAttached) return;

    const handleAccountsChanged = (accounts: string[]) => {
      accounts.length === 0 ? this.setDisconnected() : this.setConnected(accounts[0]);
    };
    const handleChainChanged = (chainId: string) => {
      this.chainId = chainId;
      this.emit('chainChanged', chainId);
    };
    const handleDisconnect = () => this.setDisconnected();

    this._provider.on('accountsChanged', handleAccountsChanged);
    this._provider.on('chainChanged',    handleChainChanged);
    this._provider.on('disconnect',      handleDisconnect);
    this._listenersAttached = true;
  }

  // ── connect / disconnect ──────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    const provider = this._findSafePalProvider();
    if (!provider) {
      const error = parseWalletError(new Error('SafePal not detected'));
      this.setError(error);
      throw error;
    }

    this._provider = provider;
    this._setupListeners();
    this.connecting = true;

    try {
      // wallet_requestPermissions forces the account-picker UI
      await this._provider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts: string[] = await this._provider.request({ method: 'eth_accounts' });
      if (accounts?.length) this.setConnected(accounts[0]);

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

  async disconnect(): Promise<void> {
    this._listenersAttached = false;
    this.setDisconnected();
  }

  // ── Optional: signMessage ─────────────────────────────────────

  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this._provider || !this.publicKey) {
      throw parseWalletError(new Error('SafePal not connected'));
    }
    const hex = '0x' + Buffer.from(options.message).toString('hex');
    const sig: string = await this._provider.request({
      method: 'personal_sign',
      params: [hex, this.publicKey],
    });
    return Uint8Array.from(Buffer.from(sig.slice(2), 'hex'));
  }
}
```

### Solana wallet example — `src/adapters/solana/BackpackAdapter.ts`

```ts
import { BaseAdapter } from '../../BaseAdapter';
import type { SignMessageOptions, WalletReadyState } from '../../types';
import { parseWalletError } from '../../utils';
import bs58 from 'bs58';

interface BackpackProvider {
  isBackpack?: boolean;
  publicKey?: { toBase58(): string };
  connect(): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  on(event: string, handler: Function): void;
  removeListener(event: string, handler: Function): void;
}

declare global {
  interface Window { backpack?: BackpackProvider; }
}

export class BackpackAdapter extends BaseAdapter {
  name   = 'Backpack';
  url    = 'https://backpack.app';
  icon   = 'data:image/svg+xml,...'; // paste SVG data URI here
  chain  = 'solana' as const;

  rpcEndpoint: string | undefined;

  private _provider: BackpackProvider | null = null;
  private _readyState: WalletReadyState = WalletReadyState.NotDetected;

  constructor(options?: { rpcEndpoint?: string }) {
    super();
    this.rpcEndpoint = options?.rpcEndpoint;
    this._detectProvider();
  }

  get readyState() { return this._readyState; }

  private _detectProvider(): void {
    if (typeof window !== 'undefined' && window.backpack?.isBackpack) {
      this._provider  = window.backpack;
      this._readyState = WalletReadyState.Installed;
    }
  }

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;

    if (!this._provider) {
      const error = parseWalletError(new Error('Backpack not detected'));
      this.setError(error);
      throw error;
    }

    this.connecting = true;
    try {
      const { publicKey } = await this._provider.connect();
      this.setConnected(publicKey.toBase58());
    } catch (error: any) {
      const walletError = parseWalletError(error);
      this.setError(walletError);
      throw walletError;
    }
  }

  async disconnect(): Promise<void> {
    await this._provider?.disconnect();
    this.setDisconnected();
  }

  async signMessage(options: SignMessageOptions): Promise<Uint8Array> {
    if (!this._provider || !this.connected) {
      throw parseWalletError(new Error('Backpack not connected'));
    }
    const { signature } = await this._provider.signMessage(options.message, 'utf8');
    return signature;
  }
}
```

---

## 3. Export the adapter

Add one line to `src/adapters/index.ts`:

```ts
export { SafePalAdapter } from './evm/SafePalAdapter';   // EVM
// or
export { BackpackAdapter } from './solana/BackpackAdapter'; // Solana
```

---

## 4. Use it in the frontend

In `test-adadpter-frontend/src/App.tsx`, add the adapter to the `wallets` array:

```ts
import { ..., SafePalAdapter } from 'wallet-hub';

const wallets = [
  new PhantomWalletAdapter({ rpcEndpoint: SOLANA_DEVNET }),
  new SolflareWalletAdapter({ rpcEndpoint: SOLANA_DEVNET }),
  new MetaMaskAdapter(),
  new TrustWalletAdapter(),
  new SafePalAdapter(),   // ← new wallet appears automatically in the EVM panel
];
```

No changes needed to `WalletAdapterContext` or `UnifiedWalletConnector` — the EVM panel renders any adapter with `chain === 'evm'`, and the Solana panel renders any adapter with `chain === 'solana'`.

---

## 5. Find the wallet icon

Options:
- The wallet's official GitHub repo (`/public/logo.svg` or similar)
- [Wallets Standard](https://github.com/wallet-standard/assets) — community SVG assets
- The wallet's own documentation / press kit
- Browser extension: open DevTools → Application → Extension storage, or inspect the extension's popup HTML

Convert the SVG to a data URI:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('logo.svg','utf8'); console.log('data:image/svg+xml,' + encodeURIComponent(s))"
```

---

## 6. Find the EIP-6963 `rdns`

Every modern EVM wallet announces its `rdns` (reverse domain name) via EIP-6963. To find it:

1. Install the wallet extension and open any dapp (or `localhost:5173`)
2. Open DevTools console and run:
   ```js
   window.addEventListener('eip6963:announceProvider', e => console.log(e.detail.info));
   window.dispatchEvent(new Event('eip6963:requestProvider'));
   ```
3. The logged object contains `{ name, rdns, uuid, icon }` — use the `rdns` value in `_findSafePalProvider()`.

---

## 7. Bump version and publish

```bash
# wallet-hub/package.json
"version": "0.1.1"

# rebuild and publish
pnpm --filter wallet-hub run build
pnpm --filter wallet-hub publish --no-git-checks --access public --otp=<code>
```

Then update the frontend's dependency:

```bash
# test-adadpter-frontend/package.json
"wallet-hub": "^0.1.1"

pnpm install
```

---

## Checklist

- [ ] Adapter file created in correct folder (`evm/` or `solana/`)
- [ ] `name`, `url`, `icon`, `chain` set
- [ ] `readyState` reflects whether the extension is installed
- [ ] EVM: EIP-6963 discovery + `window.ethereum` fallback
- [ ] EVM: `wallet_requestPermissions` used in `connect()` (not `eth_requestAccounts`)
- [ ] EVM: `eth_chainId` read after connect, `chainChanged` listener registered
- [ ] EVM: `_listenersAttached` guard prevents duplicate listeners
- [ ] Solana: `connect()` calls the provider's connect method and sets `publicKey`
- [ ] `disconnect()` calls `setDisconnected()` and resets flags
- [ ] Exported from `src/adapters/index.ts`
- [ ] Added to `wallets` array in `App.tsx`
- [ ] Version bumped and package republished
