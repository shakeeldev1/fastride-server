import * as dotenv from 'dotenv';

dotenv.config();

export interface JazzCashConfig {
  merchantId: string;
  password: string;
  integritySalt: string;
  isProduction: boolean;
  hostedCheckoutUrl: string;
  inquiryUrl: string;
  returnUrl: string;
  frontendSuccessUrl: string;
  frontendFailureUrl: string;
  txnExpiryMinutes: number;
}

const SANDBOX_HCP_URL =
  'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';
const PRODUCTION_HCP_URL =
  'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';

const SANDBOX_INQUIRY_URL =
  'https://sandbox.jazzcash.com.pk/ApplicationAPI/API/PaymentInquiry/Inquire';
const PRODUCTION_INQUIRY_URL =
  'https://payments.jazzcash.com.pk/ApplicationAPI/API/PaymentInquiry/Inquire';

export function getJazzCashConfig(): JazzCashConfig {
  const isProduction = (process.env.JAZZCASH_ENV || 'sandbox').toLowerCase() === 'production';

  return {
    merchantId: process.env.JAZZCASH_MERCHANT_ID || '',
    password: process.env.JAZZCASH_PASSWORD || '',
    integritySalt: process.env.JAZZCASH_INTEGRITY_SALT || '',
    isProduction,
    hostedCheckoutUrl: isProduction ? PRODUCTION_HCP_URL : SANDBOX_HCP_URL,
    inquiryUrl: isProduction ? PRODUCTION_INQUIRY_URL : SANDBOX_INQUIRY_URL,
    returnUrl:
      process.env.JAZZCASH_RETURN_URL || 'http://localhost:3000/api/payments/jazzcash/callback',
    frontendSuccessUrl:
      process.env.JAZZCASH_FRONTEND_SUCCESS_URL || 'https://fastridelive.com/payment/success',
    frontendFailureUrl:
      process.env.JAZZCASH_FRONTEND_FAILURE_URL || 'https://fastridelive.com/payment/failure',
    txnExpiryMinutes: Number(process.env.JAZZCASH_TXN_EXPIRY_MINUTES) || 60,
  };
}
