export interface WalletErrorResponse {
  success: false;
  reason: string;
  code: string;
}

export const WalletErrorCode = {
  USER_REJECTED: 'user_rejected',
  WALLET_NOT_DETECTED: 'wallet_not_detected',
  WALLET_NOT_CONNECTED: 'wallet_not_connected',
  TRANSACTION_FAILED: 'transaction_failed',
  SIGNING_FAILED: 'signing_failed',
  UNKNOWN_ERROR: 'unknown_error',
} as const;
export type WalletErrorCode = (typeof WalletErrorCode)[keyof typeof WalletErrorCode];

export class WalletError extends Error {
  public readonly code: string;
  public readonly reason: string;
  public readonly success: false = false;

  constructor(reason: string, code: string) {
    super(reason);
    this.name = 'WalletError';
    this.reason = reason;
    this.code = code;
  }

  toJSON(): WalletErrorResponse {
    return {
      success: false,
      reason: this.reason,
      code: this.code,
    };
  }
}

