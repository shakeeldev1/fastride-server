import * as dotenv from 'dotenv';

dotenv.config();

export interface JazzCashConfig {
  merchantId: string;
  password: string;
  integritySalt: string;
  merchantMPIN: string;
  isProduction: boolean;

  /** MWallet REST API v2.0 (with CNIC) — direct server-to-server mobile account debit. */
  mWalletUrl: string;
  /** Card Payment Page Redirection v1.1 — browser POST/redirect checkout. */
  cardCheckoutUrl: string;
  /** Status Inquiry API v2.0. */
  statusInquiryUrl: string;
  /** MWallet Refund API v1.1. */
  mWalletRefundUrl: string;
  /** Card Refund API v2.0. */
  cardRefundUrl: string;

  /** pp_ReturnURL — browser return URL for the Card Page Redirection flow. Must never change once shared with JazzCash. */
  returnUrl: string;
  /** REST IPN listener URL — must be registered in the JazzCash merchant portal (Integration > Credentials). */
  ipnUrl: string;
  frontendSuccessUrl: string;
  frontendFailureUrl: string;

  /**
   * Minutes a locally-created pending top-up stays reusable before we mint a
   * fresh pp_TxnRefNo for a retried initiate. Unrelated to pp_TxnExpiryDateTime,
   * which JazzCash mandates as a fixed "transaction date + 1 day" and which the
   * service computes directly rather than reading from this config.
   */
  txnExpiryMinutes: number;
}

// Per JazzCash's official 2026 REST guides, the payment-orchestrator endpoints
// below are identical for sandbox and production — routing is determined by
// the merchant credentials used, not the URL — so these are not branched on
// JAZZCASH_ENV. Env overrides are still exposed in case that ever changes.
const MWALLET_URL =
  'https://onlinepayments.jazzcash.com.pk/payment-orchestrator/api/v2/rest/payments/m-wallet';

const CARD_CHECKOUT_URL =
  'https://onlinepayments.jazzcash.com.pk/payment-orchestrator/CustomerPortal/transactionmanagement/merchantform';

const STATUS_INQUIRY_URL =
  'https://onlinepayments.jazzcash.com.pk/payment-orchestrator/api/v2/rest/payments/status/inquiry';

const MWALLET_REFUND_URL =
  'https://onlinepayments.jazzcash.com.pk/payment-orchestrator/api/v1/rest/payments/m-wallet/refund';

const CARD_REFUND_URL =
  'https://onlinepayments.jazzcash.com.pk/payment-orchestrator/api/v1/rest/payments/mpgs/v2.0/authorize/refund';

export function getJazzCashConfig(): JazzCashConfig {
  const isProduction = (process.env.JAZZCASH_ENV || 'sandbox').toLowerCase() === 'production';

  return {
    merchantId: process.env.JAZZCASH_MERCHANT_ID || '',
    password: process.env.JAZZCASH_PASSWORD || '',
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || '',
    merchantMPIN: process.env.JAZZCASH_MERCHANT_MPIN || '',
    isProduction,

    mWalletUrl: process.env.JAZZCASH_MWALLET_URL || MWALLET_URL,
    cardCheckoutUrl: process.env.JAZZCASH_CARD_CHECKOUT_URL || CARD_CHECKOUT_URL,
    statusInquiryUrl: process.env.JAZZCASH_STATUS_INQUIRY_URL || STATUS_INQUIRY_URL,
    mWalletRefundUrl: process.env.JAZZCASH_MWALLET_REFUND_URL || MWALLET_REFUND_URL,
    cardRefundUrl: process.env.JAZZCASH_CARD_REFUND_URL || CARD_REFUND_URL,

    returnUrl:
      process.env.JAZZCASH_RETURN_URL ||
      'http://localhost:3001/api/wallet/topup/jazzcash/callback',
    ipnUrl: process.env.JAZZCASH_IPN_URL || 'http://localhost:3001/api/wallet/topup/jazzcash/ipn',
    frontendSuccessUrl:
      process.env.JAZZCASH_FRONTEND_SUCCESS_URL || 'https://fastridelive.com/payment/success',
    frontendFailureUrl:
      process.env.JAZZCASH_FRONTEND_FAILURE_URL || 'https://fastridelive.com/payment/failure',

    txnExpiryMinutes: Number(process.env.JAZZCASH_TXN_EXPIRY_MINUTES) || 1440,
  };
}
