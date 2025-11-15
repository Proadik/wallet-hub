import { WalletAdapter, WalletReadyState, WalletAdapterEvents, SendTransactionOptions, SignMessageOptions } from './types';

/**
 * Abstract base class for wallet adapters.
 * Provides common functionality for connecting, disconnecting, and event handling.
 */
export abstract class BaseAdapter implements WalletAdapter, WalletAdapterEvents {
  abstract name: string;
  abstract url: string;
  abstract icon: string;
  abstract get readyState(): WalletReadyState;
  
  publicKey: string | null = null;
  connecting: boolean = false;
  connected: boolean = false;

  protected listeners: Map<string, Set<Function>> = new Map();

  /**
   * Connects to the wallet.
   * @throws {WalletError} If connection fails
   */
  abstract connect(): Promise<void>;
  
  /**
   * Disconnects from the wallet.
   * @throws {WalletError} If disconnection fails
   */
  abstract disconnect(): Promise<void>;
  
  /**
   * Sends a transaction to the network.
   * @param options - Transaction options
   * @returns Transaction signature
   * @throws {Error} If not implemented or transaction fails
   */
  sendTransaction?(options: SendTransactionOptions): Promise<string> {
    throw new Error('sendTransaction not implemented');
  }
  
  /**
   * Signs a message using the wallet.
   * @param options - Message signing options
   * @returns Signature as Uint8Array
   * @throws {Error} If not implemented or signing fails
   */
  signMessage?(options: SignMessageOptions): Promise<Uint8Array> {
    throw new Error('signMessage not implemented');
  }

  /**
   * Registers an event listener.
   * @param event - Event name ('connect', 'disconnect', or 'error')
   * @param callback - Callback function to handle the event
   */
  on(event: 'connect', callback: (publicKey: string) => void): void;
  on(event: 'disconnect', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Removes an event listener.
   * @param event - Event name
   * @param callback - Callback function to remove
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emits an event to all registered listeners.
   * @param event - Event name
   * @param args - Arguments to pass to listeners
   */
  protected emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Sets the adapter state to connected.
   * @param publicKey - The public key of the connected wallet
   */
  protected setConnected(publicKey: string): void {
    this.publicKey = publicKey;
    this.connected = true;
    this.connecting = false;
    this.emit('connect', publicKey);
  }

  /**
   * Sets the adapter state to disconnected.
   */
  protected setDisconnected(): void {
    this.publicKey = null;
    this.connected = false;
    this.connecting = false;
    this.emit('disconnect');
  }

  /**
   * Sets an error state and emits an error event.
   * @param error - The error that occurred
   */
  protected setError(error: Error): void {
    this.connecting = false;
    this.emit('error', error);
  }
}
