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

  // Ledger-specific errors
  if (errorMessage.includes('No device selected') || errorMessage.includes('Unable to claim interface')) {
    return new WalletError('Ledger device not found. Connect your Ledger and try again.', WalletErrorCode.WALLET_NOT_DETECTED);
  }
  if (errorMessage.includes('0x6700') || errorMessage.includes('0x6e00') || errorMessage.includes('CLA_NOT_SUPPORTED')) {
    return new WalletError('Wrong app open on Ledger. Open the Solana or Ethereum app and try again.', WalletErrorCode.WALLET_NOT_DETECTED);
  }
  if (errorMessage.includes('0x6511') || errorMessage.includes('INS_NOT_SUPPORTED')) {
    return new WalletError('Ledger app does not support this operation. Update the app and try again.', WalletErrorCode.UNKNOWN_ERROR);
  }
  if (errorMessage.includes('0x6985') || errorMessage.includes('Conditions of use not satisfied') || errorMessage.includes('denied by the user')) {
    return new WalletError('Request rejected on Ledger device.', WalletErrorCode.USER_REJECTED);
  }
  if (errorMessage.includes('Locked device') || errorMessage.includes('0x5515')) {
    return new WalletError('Ledger is locked. Unlock your device and try again.', WalletErrorCode.WALLET_NOT_DETECTED);
  }

  // Must come before the generic 4001 check — MetaMask's Solana snap reuses
  // code 4001 for "no Solana account configured", which is not a user rejection.
  if (
    errorMessage.includes('at least one account') ||
    errorMessage.includes('has at least one account')
  ) {
    return new WalletError(
      'No Solana account in MetaMask. Open MetaMask → Settings → Solana and add an account.',
      WalletErrorCode.WALLET_NOT_DETECTED,
    );
  }

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

  const lower = errorMessage.toLowerCase();

  if (
    lower.includes('wallet not detected') ||
    lower.includes('wallet not installed') ||
    lower.includes('wallet not found')
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

