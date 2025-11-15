import { WalletError, WalletErrorCode } from '../types';

/**
 * Parses wallet errors and converts them to structured WalletError format
 * @param error - The error thrown by the wallet provider
 * @returns WalletError with structured format
 */
export function parseWalletError(error: any): WalletError {
  if (error instanceof WalletError) {
    return error;
  }

  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorCode = error?.code || error?.error?.code;

  if (
    errorMessage.includes('User rejected') ||
    errorMessage.includes('user rejected') ||
    errorMessage.includes('User rejected the request') ||
    errorCode === 4001 ||
    errorCode === 'ACTION_REJECTED' ||
    errorCode === 'USER_REJECTED'
  ) {
    return new WalletError('User rejected the request', WalletErrorCode.USER_REJECTED);
  }

  if (
    errorMessage.includes('not detected') ||
    errorMessage.includes('not installed') ||
    errorMessage.includes('not found')
  ) {
    return new WalletError('Wallet not detected', WalletErrorCode.WALLET_NOT_DETECTED);
  }

  if (
    errorMessage.includes('not connected') ||
    errorMessage.includes('Please connect')
  ) {
    return new WalletError('Wallet not connected', WalletErrorCode.WALLET_NOT_CONNECTED);
  }

  if (
    errorMessage.includes('transaction') ||
    errorMessage.includes('Transaction')
  ) {
    return new WalletError(errorMessage, WalletErrorCode.TRANSACTION_FAILED);
  }

  if (
    errorMessage.includes('sign') ||
    errorMessage.includes('Sign')
  ) {
    return new WalletError(errorMessage, WalletErrorCode.SIGNING_FAILED);
  }

  return new WalletError(errorMessage, WalletErrorCode.UNKNOWN_ERROR);
}

