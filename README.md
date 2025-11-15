# Wallet Hub

A lightweight, type-safe wallet adapter for Solana and EVM-compatible blockchains with React hooks support.

## Features

- 🦄 **Multi-chain support** - Solana and EVM chains
- 🔌 **Multiple wallets** - Phantom, Solflare, MetaMask, Trust Wallet
- ⚛️ **React hooks** - Ready-to-use hooks for React applications
- 🔄 **Unified adapter** - Manage multiple wallets with a single interface
- 📦 **Lightweight** - Minimal dependencies
- 🔒 **Type-safe** - Full TypeScript support
- 🛡️ **Error handling** - Structured error responses

## Installation

```bash
npm install wallet-hub
# or
yarn add wallet-hub
# or
pnpm add wallet-hub
```

## Quick Start

### Using React Hooks (Recommended)

```tsx
import { WalletAdapterProvider, PhantomWalletAdapter, MetaMaskAdapter } from 'wallet-hub';
import { useWalletAdapter } from 'wallet-hub';

function App() {
  const wallets = [
    new PhantomWalletAdapter(),
    new MetaMaskAdapter()
  ];

  return (
    <WalletAdapterProvider wallets={wallets}>
      <WalletComponent />
    </WalletAdapterProvider>
  );
}

function WalletComponent() {
  const {
    wallets,
    activeWallet,
    selectWallet,
    connect,
    disconnect,
    connected,
    publicKey,
    shortenedPublicKey,
    isPhantom,
    isMetaMask
  } = useWalletAdapter();

  return (
    <div>
      {wallets.map(wallet => (
        <button key={wallet.name} onClick={() => selectWallet(wallet)}>
          {wallet.name}
        </button>
      ))}
      
      {activeWallet && (
        <>
          {!connected ? (
            <button onClick={connect}>Connect</button>
          ) : (
            <>
              <p>Connected: {shortenedPublicKey}</p>
              <button onClick={disconnect}>Disconnect</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
```

### Using Individual Adapters

```tsx
import { PhantomAdapterProvider, usePhantomAdapter } from 'wallet-hub';

function PhantomComponent() {
  const { connect, disconnect, connected, publicKey, shortenedPublicKey } = usePhantomAdapter();

  return (
    <div>
      {!connected ? (
        <button onClick={connect}>Connect Phantom</button>
      ) : (
        <>
          <p>Connected: {shortenedPublicKey}</p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <PhantomAdapterProvider>
      <PhantomComponent />
    </PhantomAdapterProvider>
  );
}
```

### Direct Adapter Usage (Without React)

```typescript
import { PhantomWalletAdapter, MetaMaskAdapter } from 'wallet-hub';

// Solana - Phantom
const phantom = new PhantomWalletAdapter();
await phantom.connect();
console.log(phantom.publicKey);

phantom.on('connect', (publicKey) => {
  console.log('Connected:', publicKey);
});

phantom.on('disconnect', () => {
  console.log('Disconnected');
});

// EVM - MetaMask
const metamask = new MetaMaskAdapter();
await metamask.connect();
console.log(metamask.publicKey);
```

## Message Signing

### Sign Message (Uint8Array)

```typescript
const signature = await adapter.signMessage({
  message: new TextEncoder().encode('Hello, World!')
});
```

### Sign Message and Encode to Base58 (String)

```typescript
const signature = await adapter.signMessageAndEncodeToBase58('Hello, World!');
```

## Supported Wallets

### Solana
- ✅ **Phantom** - `PhantomWalletAdapter`
- ✅ **Solflare** - `SolflareWalletAdapter`

### EVM
- ✅ **MetaMask** - `MetaMaskAdapter`
- ✅ **Trust Wallet** - `TrustWalletAdapter`

## API Reference

### Unified Wallet Adapter

```typescript
import { WalletAdapterProvider, useWalletAdapter } from 'wallet-hub';

// Hook returns:
{
  wallets: BaseAdapter[];           // All available wallets
  activeWallet: BaseAdapter | null;  // Currently selected wallet
  selectWallet: (wallet) => void;    // Select a wallet
  connect: () => Promise<void>;       // Connect to active wallet
  disconnect: () => Promise<void>;    // Disconnect from active wallet
  signMessage: (options) => Promise<Uint8Array>;
  signMessageAndEncodeToBase58: (message: string) => Promise<string>;
  request: (args) => Promise<any>;   // EVM wallets only
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  shortenedPublicKey: string | null;
  isPhantom: boolean;
  isSolflare: boolean;
  isMetaMask: boolean;
  isTrust: boolean;
  error: WalletError | null;
  errorResponse: WalletErrorResponse | null;
}
```

### Individual Wallet Hooks

- `usePhantomAdapter()` - Phantom wallet hook
- `useSolflareAdapter()` - Solflare wallet hook
- `useEthereumAdapter()` - MetaMask wallet hook
- `useTrustWalletAdapter()` - Trust Wallet hook

## Error Handling

All errors are wrapped in `WalletError` with structured responses:

```typescript
try {
  await adapter.connect();
} catch (error) {
  if (error instanceof WalletError) {
    console.log(error.code);      // e.g., "user_rejected"
    console.log(error.reason);     // e.g., "User rejected the request"
    console.log(error.toJSON());   // { success: false, reason: "...", code: "..." }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev
```

## License

MIT
