import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { TrustWalletAdapter } from '../adapters';
import { shortenPublicKey } from '../utils';
import { WalletError, WalletErrorResponse, SignMessageOptions } from '../types';

interface TrustWalletAdapterContextValue {
  adapter: TrustWalletAdapter;
  connecting: boolean;
  connected: boolean;
  publicKey: string | null;
  shortenedPublicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (options: SignMessageOptions) => Promise<Uint8Array>;
  signMessageAndEncodeToBase58: (message: string) => Promise<string>;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  error: WalletError | null;
  errorResponse: WalletErrorResponse | null;
}

const TrustWalletAdapterContext = createContext<TrustWalletAdapterContextValue | null>(null);

interface TrustWalletAdapterProviderProps {
  children: ReactNode;
}

/**
 * Provider component for Trust Wallet adapter context.
 * @param children - React children components
 */
export function TrustWalletAdapterProvider({ children }: TrustWalletAdapterProviderProps) {
  const [adapter] = useState(() => new TrustWalletAdapter());
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
   * Connects to the Trust Wallet.
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
   * Disconnects from the Trust Wallet.
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
   * Signs a message using Trust Wallet.
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
   * Sends a request to the Trust Wallet provider.
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

  const value: TrustWalletAdapterContextValue = {
    adapter,
    connecting,
    connected,
    publicKey,
    shortenedPublicKey,
    connect,
    disconnect,
    signMessage,
    signMessageAndEncodeToBase58,
    request,
    error: error instanceof WalletError ? error : null,
    errorResponse,
  };

  return (
    <TrustWalletAdapterContext.Provider value={value}>
      {children}
    </TrustWalletAdapterContext.Provider>
  );
}

/**
 * Hook to access the Trust Wallet adapter context.
 * @returns TrustWalletAdapterContextValue with Trust Wallet adapter state and methods
 * @throws {Error} If used outside of TrustWalletAdapterProvider
 */
export function useTrustWalletAdapter(): TrustWalletAdapterContextValue {
  const context = useContext(TrustWalletAdapterContext);
  if (!context) {
    throw new Error('useTrustWalletAdapter must be used within a TrustWalletAdapterProvider');
  }
  return context;
}

