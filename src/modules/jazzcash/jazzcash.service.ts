import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { getJazzCashConfig, JazzCashConfig } from '../../config/jazzcash.config';

export interface BuildHostedCheckoutParams {
  txnRefNo: string;
  amount: number;
  billReference: string;
  description: string;
  cnic: string;
}

export interface HostedCheckoutRequest {
  checkoutUrl: string;
  fields: Record<string, string>;
}

@Injectable()
export class JazzCashService {
  private readonly logger = new Logger(JazzCashService.name);
  private readonly config: JazzCashConfig;

  constructor() {
    this.config = getJazzCashConfig();
  }

  private formatDateTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');

    return (
      date.getFullYear().toString() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  }

  generateSecureHash(fields: Record<string, string>): string {
    const sortedKeys = Object.keys(fields)
      .filter(
        (key) =>
          key !== 'pp_SecureHash' &&
          (key.startsWith('pp_') || key.startsWith('ppmpf_')) &&
          fields[key] !== undefined &&
          fields[key] !== null &&
          String(fields[key]).trim() !== '',
      )
      .sort();

    const hashString = [this.config.integritySalt, ...sortedKeys.map((key) => fields[key])].join(
      '&',
    );

    return crypto.createHmac('sha256', this.config.integritySalt).update(hashString).digest('hex');
  }

  verifySecureHash(fields: Record<string, string>): boolean {
    const receivedHash = fields['pp_SecureHash'];

    if (!receivedHash) {
      return false;
    }

    const expectedHash = this.generateSecureHash(fields);
    const receivedBuffer = Buffer.from(receivedHash.toLowerCase(), 'utf8');
    const expectedBuffer = Buffer.from(expectedHash.toLowerCase(), 'utf8');

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  buildHostedCheckoutRequest(params: BuildHostedCheckoutParams): HostedCheckoutRequest {
    const now = new Date();
    const expiry = new Date(now.getTime() + this.config.txnExpiryMinutes * 60 * 1000);

    const amountInPaisa = Math.round(params.amount * 100).toString();

    const fields: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: '',
      pp_Language: 'EN',
      pp_MerchantID: this.config.merchantId,
      pp_SubMerchantID: '',
      pp_Password: this.config.password,
      pp_BankID: '',
      pp_ProductID: '',
      pp_TxnRefNo: params.txnRefNo,
      pp_Amount: amountInPaisa,
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: this.formatDateTime(now),
      pp_BillReference: params.billReference,
      pp_Description: params.description,
      pp_TxnExpiryDateTime: this.formatDateTime(expiry),
      pp_ReturnURL: this.config.returnUrl,
      pp_CNIC: params.cnic,
    };

    fields.pp_SecureHash = this.generateSecureHash(fields);

    return {
      checkoutUrl: this.config.hostedCheckoutUrl,
      fields,
    };
  }

  async inquireTransaction(txnRefNo: string): Promise<Record<string, any>> {
    const fields: Record<string, string> = {
      pp_MerchantID: this.config.merchantId,
      pp_Password: this.config.password,
      pp_TxnRefNo: txnRefNo,
    };

    fields.pp_SecureHash = this.generateSecureHash(fields);

    try {
      const response = await fetch(this.config.inquiryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });

      const data = await response.json();
      return data as Record<string, any>;
    } catch (error) {
      this.logger.error(`JazzCash inquiry failed for ${txnRefNo}: ${(error as Error).message}`);
      throw error;
    }
  }

  isSuccessResponseCode(responseCode: string | undefined | null): boolean {
    return responseCode === '000';
  }

  generateTxnRefNo(): string {
    const random = crypto.randomInt(100000, 999999);
    return `T${Date.now()}${random}`;
  }
}
