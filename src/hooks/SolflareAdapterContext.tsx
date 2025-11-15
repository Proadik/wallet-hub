import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { SolflareWalletAdapter } from '../adapters';
import { shortenPublicKey } from '../utils';
import { WalletError, type WalletErrorResponse, type SignMessageOptions } from '../types';

interface SolflareAdapterContextValue {
  adapter: SolflareWalletAdapter;
  connecting: boolean;
  connected: boolean;
  publicKey: string | null;
  shortenedPublicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (options: SignMessageOptions) => Promise<Uint8Array>;
  signMessageAndEncodeToBase58: (message: string) => Promise<string>;
  error: WalletError | null;
  errorResponse: WalletErrorResponse | null;
}

const SolflareAdapterContext = createContext<SolflareAdapterContextValue | null>(null);

interface SolflareAdapterProviderProps {
  children: ReactNode;
}

/**
 * Provider component for Solflare wallet adapter context.
 * @param children - React children components
 */
export function SolflareAdapterProvider({ children }: SolflareAdapterProviderProps) {
  const [adapter] = useState(() => new SolflareWalletAdapter());
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

    return () => {
      adapter.off('connect', handleConnect);
      adapter.off('disconnect', handleDisconnect);
      adapter.off('error', handleError);
    };
  }, [adapter]);

  /**
   * Connects to the Solflare wallet.
   * @throws {WalletError} If connection fails
   */
  const connect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await adapter.connect();
    } catch (err) {
      setConnecting(false);
      throw err;
    }
  };

  /**
   * Disconnects from the Solflare wallet.
   * @throws {WalletError} If disconnection fails
   */
  const disconnect = async () => {
    try {
      await adapter.disconnect();
    } catch (err) {
      throw err;
    }
  };

  /**
   * Signs a message using Solflare wallet.
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

  const shortenedPublicKey = useMemo(() => shortenPublicKey(publicKey), [publicKey]);

  const errorResponse = useMemo<WalletErrorResponse | null>(() => {
    if (error instanceof WalletError) {
      return error.toJSON();
    }
    return null;
  }, [error]);

  const value: SolflareAdapterContextValue = {
    adapter,
    connecting,
    connected,
    publicKey,
    shortenedPublicKey,
    connect,
    disconnect,
    signMessage,
    signMessageAndEncodeToBase58,
    error: error instanceof WalletError ? error : null,
    errorResponse,
  };

  return (
    <SolflareAdapterContext.Provider value={value}>
      {children}
    </SolflareAdapterContext.Provider>
  );
}

/**
 * Hook to access the Solflare wallet adapter context.
 * @returns SolflareAdapterContextValue with Solflare adapter state and methods
 * @throws {Error} If used outside of SolflareAdapterProvider
 */
export function useSolflareAdapter(): SolflareAdapterContextValue {
  const context = useContext(SolflareAdapterContext);
  if (!context) {
    throw new Error('useSolflareAdapter must be used within a SolflareAdapterProvider');
  }
  return context;
}


