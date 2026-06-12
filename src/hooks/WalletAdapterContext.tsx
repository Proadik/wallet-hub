import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { BaseAdapter } from '../BaseAdapter';
import { shortenPublicKey, detectWalletEnvironment } from '../utils';
import type {
  SignMessageOptions,
  WalletEnvironment,
} from '../types';
import {
  WalletError,
  WalletErrorCode,
} from '../types';

interface EvmSlot {
  wallets: BaseAdapter[];
  active: BaseAdapter | null;
  select: (wallet: BaseAdapter) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  publicKey: string | null;
  shortenedPublicKey: string | null;
  chainId: string | null;
  connected: boolean;
  connecting: boolean;
  isMetaMask: boolean;
  isTrust: boolean;
  error: WalletError | null;
  sendTransaction: (tx: Record<string, any>) => Promise<string>;
  signMessage: (options: SignMessageOptions) => Promise<Uint8Array>;
  signMessageAndEncodeToBase58: (message: string) => Promise<string>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

interface SolanaSlot {
  wallets: BaseAdapter[];
  active: BaseAdapter | null;
  select: (wallet: BaseAdapter) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  publicKey: string | null;
  shortenedPublicKey: string | null;
  connected: boolean;
  connecting: boolean;
  isPhantom: boolean;
  isSolflare: boolean;
  isTrust: boolean;
  error: WalletError | null;
  sendTransaction: (tx: any) => Promise<string>;
  signMessage: (options: SignMessageOptions) => Promise<Uint8Array>;
  signMessageAndEncodeToBase58: (message: string) => Promise<string>;
}

interface WalletAdapterContextValue {
  evm: EvmSlot;
  solana: SolanaSlot;
  environment: WalletEnvironment;
}

const WalletAdapterContext = createContext<WalletAdapterContextValue | null>(null);

interface WalletAdapterProviderProps {
  wallets: BaseAdapter[];
  children: ReactNode;
}

export function WalletAdapterProvider({ wallets, children }: WalletAdapterProviderProps) {
  const evmWallets = useMemo(() => wallets.filter(w => w.chain === 'evm'), [wallets]);
  const solanaWallets = useMemo(() => wallets.filter(w => w.chain === 'solana'), [wallets]);
  const environment = useMemo(() => detectWalletEnvironment(), []);

  // EVM state
  const [evmActive, setEvmActive] = useState<BaseAdapter | null>(null);
  const [evmPublicKey, setEvmPublicKey] = useState<string | null>(null);
  const [evmChainId, setEvmChainId] = useState<string | null>(null);
  const [evmConnected, setEvmConnected] = useState(false);
  const [evmConnecting, setEvmConnecting] = useState(false);
  const [evmError, setEvmError] = useState<WalletError | null>(null);

  // Solana state
  const [solanaActive, setSolanaActive] = useState<BaseAdapter | null>(null);
  const [solanaPublicKey, setSolanaPublicKey] = useState<string | null>(null);
  const [solanaConnected, setSolanaConnected] = useState(false);
  const [solanaConnecting, setSolanaConnecting] = useState(false);
  const [solanaError, setSolanaError] = useState<WalletError | null>(null);

  // Stable handler refs — React state setters are stable so these never need recreation
  const evmHandlers = useRef({
    connect: (pk: string) => { setEvmPublicKey(pk); setEvmConnected(true); setEvmConnecting(false); setEvmError(null); },
    disconnect: () => { setEvmPublicKey(null); setEvmConnected(false); setEvmConnecting(false); setEvmChainId(null); setEvmError(null); },
    error: (err: Error) => { setEvmError(err instanceof WalletError ? err : null); setEvmConnecting(false); },
    chainChanged: (chainId: string) => { setEvmChainId(chainId); },
  });

  const solanaHandlers = useRef({
    connect: (pk: string) => { setSolanaPublicKey(pk); setSolanaConnected(true); setSolanaConnecting(false); setSolanaError(null); },
    disconnect: () => { setSolanaPublicKey(null); setSolanaConnected(false); setSolanaConnecting(false); setSolanaError(null); },
    error: (err: Error) => { setSolanaError(err instanceof WalletError ? err : null); setSolanaConnecting(false); },
  });

  // Rewire EVM event listeners when active wallet changes.
  useEffect(() => {
    if (!evmActive) return;
    const h = evmHandlers.current;
    evmActive.on('connect', h.connect);
    evmActive.on('disconnect', h.disconnect);
    evmActive.on('error', h.error);
    evmActive.on('chainChanged', h.chainChanged);
    setEvmPublicKey(evmActive.publicKey);
    setEvmConnected(evmActive.connected);
    setEvmChainId(evmActive.chainId);
    return () => {
      evmActive.off('connect', h.connect);
      evmActive.off('disconnect', h.disconnect);
      evmActive.off('error', h.error);
      evmActive.off('chainChanged', h.chainChanged);
    };
  }, [evmActive]);

  // Rewire Solana event listeners when active wallet changes.
  useEffect(() => {
    if (!solanaActive) return;
    const h = solanaHandlers.current;
    solanaActive.on('connect', h.connect);
    solanaActive.on('disconnect', h.disconnect);
    solanaActive.on('error', h.error);
    setSolanaPublicKey(solanaActive.publicKey);
    setSolanaConnected(solanaActive.connected);
    return () => {
      solanaActive.off('connect', h.connect);
      solanaActive.off('disconnect', h.disconnect);
      solanaActive.off('error', h.error);
    };
  }, [solanaActive]);

  // EVM actions
  const selectEvm = (wallet: BaseAdapter) => {
    if (evmActive?.connected) evmActive.disconnect().catch(() => {});
    setEvmActive(wallet);
    setEvmConnected(false);
    setEvmPublicKey(null);
    setEvmChainId(null);
    setEvmError(null);
  };

  const connectEvm = async () => {
    if (!evmActive) {
      throw new WalletError('No EVM wallet selected', WalletErrorCode.WALLET_NOT_DETECTED);
    }
    setEvmConnecting(true);
    setEvmError(null);
    try {
      await evmActive.connect();
    } catch (err) {
      setEvmConnecting(false);
      throw err;
    }
  };

  const disconnectEvm = async () => {
    if (evmActive) await evmActive.disconnect();
  };

  const evmSendTransaction = async (tx: Record<string, any>): Promise<string> => {
    if (!evmActive) throw new WalletError('No EVM wallet connected', WalletErrorCode.WALLET_NOT_CONNECTED);
    return (evmActive as any).sendTransaction(tx);
  };

  const evmSignMessage = async (options: SignMessageOptions): Promise<Uint8Array> => {
    if (!evmActive) throw new WalletError('No EVM wallet connected', WalletErrorCode.WALLET_NOT_CONNECTED);
    return evmActive.signMessage!(options);
  };

  const evmSignMessageAndEncodeToBase58 = async (message: string): Promise<string> => {
    if (!evmActive) throw new WalletError('No EVM wallet connected', WalletErrorCode.WALLET_NOT_CONNECTED);
    return (evmActive as any).signMessageAndEncodeToBase58(message);
  };

  const evmRequest = async (args: { method: string; params?: any[] }): Promise<any> => {
    if (!evmActive) throw new WalletError('No EVM wallet connected', WalletErrorCode.WALLET_NOT_CONNECTED);
    return (evmActive as any).request(args);
  };

  // Solana actions
  const selectSolana = (wallet: BaseAdapter) => {
    if (solanaActive?.connected) solanaActive.disconnect().catch(() => {});
    setSolanaActive(wallet);
    setSolanaConnected(false);
    setSolanaPublicKey(null);
    setSolanaError(null);
  };

  const connectSolana = async () => {
    if (!solanaActive) {
      throw new WalletError('No Solana wallet selected', WalletErrorCode.WALLET_NOT_DETECTED);
    }
    setSolanaConnecting(true);
    setSolanaError(null);
    try {
      await solanaActive.connect();
    } catch (err) {
      setSolanaConnecting(false);
      throw err;
    }
  };

  const disconnectSolana = async () => {
    if (solanaActive) await solanaActive.disconnect();
  };

  const solanaSendTransaction = async (tx: any): Promise<string> => {
    if (!solanaActive) throw new WalletError('No Solana wallet connected', WalletErrorCode.WALLET_NOT_CONNECTED);
    return (solanaActive as any).sendTransaction(tx);
  };

  const solanaSignMessage = async (options: SignMessageOptions): Promise<Uint8Array> => {
    if (!solanaActive) throw new WalletError('No Solana wallet connected', WalletErrorCode.WALLET_NOT_CONNECTED);
    return solanaActive.signMessage!(options);
  };

  const solanaSignMessageAndEncodeToBase58 = async (message: string): Promise<string> => {
    if (!solanaActive) throw new WalletError('No Solana wallet connected', WalletErrorCode.WALLET_NOT_CONNECTED);
    return (solanaActive as any).signMessageAndEncodeToBase58(message);
  };

  const evmShortenedPublicKey = useMemo(() => shortenPublicKey(evmPublicKey), [evmPublicKey]);
  const solanaShortenedPublicKey = useMemo(() => shortenPublicKey(solanaPublicKey), [solanaPublicKey]);

  const value: WalletAdapterContextValue = {
    evm: {
      wallets: evmWallets,
      active: evmActive,
      select: selectEvm,
      connect: connectEvm,
      disconnect: disconnectEvm,
      publicKey: evmPublicKey,
      shortenedPublicKey: evmShortenedPublicKey,
      chainId: evmChainId,
      connected: evmConnected,
      connecting: evmConnecting,
      isMetaMask: evmActive?.name === 'MetaMask',
      isTrust: evmActive?.name === 'Trust Wallet',
      error: evmError,
      sendTransaction: evmSendTransaction,
      signMessage: evmSignMessage,
      signMessageAndEncodeToBase58: evmSignMessageAndEncodeToBase58,
      request: evmRequest,
    },
    solana: {
      wallets: solanaWallets,
      active: solanaActive,
      select: selectSolana,
      connect: connectSolana,
      disconnect: disconnectSolana,
      publicKey: solanaPublicKey,
      shortenedPublicKey: solanaShortenedPublicKey,
      connected: solanaConnected,
      connecting: solanaConnecting,
      isPhantom: solanaActive?.name === 'Phantom',
      isSolflare: solanaActive?.name === 'Solflare',
      isTrust: solanaActive?.name === 'Trust Wallet',
      error: solanaError,
      sendTransaction: solanaSendTransaction,
      signMessage: solanaSignMessage,
      signMessageAndEncodeToBase58: solanaSignMessageAndEncodeToBase58,
    },
    environment,
  };

  return (
    <WalletAdapterContext.Provider value={value}>
      {children}
    </WalletAdapterContext.Provider>
  );
}

export function useWalletAdapter(): WalletAdapterContextValue {
  const context = useContext(WalletAdapterContext);
  if (!context) {
    throw new Error('useWalletAdapter must be used within a WalletAdapterProvider');
  }
  return context;
}
