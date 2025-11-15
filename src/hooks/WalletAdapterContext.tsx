import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { UnifiedWalletAdapter } from '../adapters/UnifiedWalletAdapter';
import { BaseAdapter } from '../BaseAdapter';
import { shortenPublicKey } from '../utils';
import { WalletError, WalletErrorResponse, SignMessageOptions } from '../types';

interface WalletAdapterContextValue {
  adapter: UnifiedWalletAdapter;
  wallets: BaseAdapter[];
  activeWallet: BaseAdapter | null;
  connecting: boolean;
  connected: boolean;
  publicKey: string | null;
  shortenedPublicKey: string | null;
  isPhantom: boolean;
  isSolflare: boolean;
  isMetaMask: boolean;
  isTrust: boolean;
  selectWallet: (wallet: BaseAdapter) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (options: SignMessageOptions) => Promise<Uint8Array>;
  signMessageAndEncodeToBase58: (message: string) => Promise<string>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  error: WalletError | null;
  errorResponse: WalletErrorResponse | null;
}

const WalletAdapterContext = createContext<WalletAdapterContextValue | null>(null);

interface WalletAdapterProviderProps {
  wallets: BaseAdapter[];
  children: ReactNode;
}

/**
 * Provider component for unified wallet adapter context.
 * Manages multiple wallet adapters and allows switching between them.
 * @param wallets - Array of wallet adapters to manage
 * @param children - React children components
 */
export function WalletAdapterProvider({ wallets, children }: WalletAdapterProviderProps) {
  const [adapter] = useState(() => new UnifiedWalletAdapter(wallets));
  const [activeWallet, setActiveWallet] = useState<BaseAdapter | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<WalletError | null>(null);

  useEffect(() => {
    const handleConnect = (pk: string) => {
      setPublicKey(pk);
      setConnected(true);
      setConnecting(false);
      setError(null);
    };

    const handleDisconnect = () => {
      setPublicKey(null);
      setConnected(false);
      setConnecting(false);
      setError(null);
    };

    const handleError = (err: Error) => {
      setError(err instanceof WalletError ? err : null);
      setConnecting(false);
    };

    adapter.on('connect', handleConnect);
    adapter.on('disconnect', handleDisconnect);
    adapter.on('error', handleError);

    setConnected(adapter.connected);
    setPublicKey(adapter.publicKey);
    setActiveWallet(adapter.activeWallet);

    return () => {
      adapter.off('connect', handleConnect);
      adapter.off('disconnect', handleDisconnect);
      adapter.off('error', handleError);
    };
  }, [adapter]);

  /**
   * Selects a wallet to become the active wallet.
   * @param wallet - The wallet adapter to activate
   */
  const selectWallet = (wallet: BaseAdapter) => {
    adapter.selectWallet(wallet);
    setActiveWallet(wallet);
    setConnected(false);
    setPublicKey(null);
    setError(null);
  };

  /**
   * Connects to the active wallet.
   * @throws {WalletError} If connection fails
   */
  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await adapter.connect();
      setActiveWallet(adapter.activeWallet);
    } catch (err) {
      setConnecting(false);
      throw err;
    }
  };

  /**
   * Disconnects from the active wallet.
   * @throws {WalletError} If disconnection fails
   */
  const disconnect = async () => {
    try {
      await adapter.disconnect();
      setActiveWallet(null);
    } catch (err) {
      throw err;
    }
  };

  /**
   * Signs a message using the active wallet.
   * @param options - Message signing options
   * @returns Signature as Uint8Array
   * @throws {WalletError} If signing fails
   */
  const signMessage = async (options: SignMessageOptions): Promise<Uint8Array> => {
    return adapter.signMessage(options);
  };

  /**
   * Signs a message string and returns base58 encoded signature.
   * @param message - The message string to sign
   * @returns Base58 encoded signature string
   * @throws {WalletError} If signing fails
   */
  const signMessageAndEncodeToBase58 = async (message: string): Promise<string> => {
    return adapter.signMessageAndEncodeToBase58(message);
  };

  /**
   * Sends a request to the active wallet provider (EVM wallets only).
   * @param args - Request arguments with method and optional params
   * @returns The result of the request
   * @throws {WalletError} If request fails
   */
  const request = async (args: { method: string; params?: any[] }): Promise<any> => {
    return adapter.request(args);
  };

  const shortenedPublicKey = useMemo(() => shortenPublicKey(publicKey), [publicKey]);
  
  const errorResponse = useMemo<WalletErrorResponse | null>(() => {
    if (error instanceof WalletError) {
      return error.toJSON();
    }
    return null;
  }, [error]);

  const value: WalletAdapterContextValue = {
    adapter,
    wallets: adapter.wallets,
    activeWallet: adapter.activeWallet,
    connecting,
    connected,
    publicKey,
    shortenedPublicKey,
    isPhantom: adapter.isPhantom,
    isSolflare: adapter.isSolflare,
    isMetaMask: adapter.isMetaMask,
    isTrust: adapter.isTrust,
    selectWallet,
    connect,
    disconnect,
    signMessage,
    signMessageAndEncodeToBase58,
    request,
    error: error instanceof WalletError ? error : null,
    errorResponse,
  };

  return (
    <WalletAdapterContext.Provider value={value}>
      {children}
    </WalletAdapterContext.Provider>
  );
}

/**
 * Hook to access the unified wallet adapter context.
 * @returns WalletAdapterContextValue with wallet adapter state and methods
 * @throws {Error} If used outside of WalletAdapterProvider
 */
export function useWalletAdapter(): WalletAdapterContextValue {
  const context = useContext(WalletAdapterContext);
  if (!context) {
    throw new Error('useWalletAdapter must be used within a WalletAdapterProvider');
  }
  return context;
}

