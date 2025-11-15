import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { MetaMaskAdapter } from '../adapters';
import { shortenPublicKey } from '../utils';
import { WalletError, WalletErrorResponse, SignMessageOptions } from '../types';

interface EthereumAdapterContextValue {
  adapter: MetaMaskAdapter;
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

const EthereumAdapterContext = createContext<EthereumAdapterContextValue | null>(null);

interface EthereumAdapterProviderProps {
  children: ReactNode;
}

/**
 * Provider component for MetaMask wallet adapter context.
 * @param children - React children components
 */
export function EthereumAdapterProvider({ children }: EthereumAdapterProviderProps) {
  const [adapter] = useState(() => new MetaMaskAdapter());
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
   * Connects to the MetaMask wallet.
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
   * Disconnects from the MetaMask wallet.
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
   * Signs a message using MetaMask wallet.
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
   * Sends a request to the MetaMask provider.
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

  const value: EthereumAdapterContextValue = {
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
    <EthereumAdapterContext.Provider value={value}>
      {children}
    </EthereumAdapterContext.Provider>
  );
}

/**
 * Hook to access the MetaMask wallet adapter context.
 * @returns EthereumAdapterContextValue with MetaMask adapter state and methods
 * @throws {Error} If used outside of EthereumAdapterProvider
 */
export function useEthereumAdapter(): EthereumAdapterContextValue {
  const context = useContext(EthereumAdapterContext);
  if (!context) {
    throw new Error('useEthereumAdapter must be used within an EthereumAdapterProvider');
  }
  return context;
}

