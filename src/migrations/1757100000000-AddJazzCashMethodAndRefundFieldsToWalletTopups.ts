import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJazzCashMethodAndRefundFieldsToWalletTopups1757100000000
  implements MigrationInterface
{
  name = 'AddJazzCashMethodAndRefundFieldsToWalletTopups1757100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" ADD COLUMN IF NOT EXISTS "method" character varying(10) NOT NULL DEFAULT 'card'`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" ADD COLUMN IF NOT EXISTS "mobile_number" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" ADD COLUMN IF NOT EXISTS "refund_status" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" ADD COLUMN IF NOT EXISTS "refunded_amount" numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" ADD COLUMN IF NOT EXISTS "jazzcash_refund_response_code" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" ADD COLUMN IF NOT EXISTS "jazzcash_refund_response_message" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet_topups" DROP COLUMN IF EXISTS "refunded_at"`);
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" DROP COLUMN IF EXISTS "jazzcash_refund_response_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_topups" DROP COLUMN IF EXISTS "jazzcash_refund_response_code"`,
    );
    await queryRunner.query(`ALTER TABLE "wallet_topups" DROP COLUMN IF EXISTS "refunded_amount"`);
    await queryRunner.query(`ALTER TABLE "wallet_topups" DROP COLUMN IF EXISTS "refund_status"`);
    await queryRunner.query(`ALTER TABLE "wallet_topups" DROP COLUMN IF EXISTS "mobile_number"`);
    await queryRunner.query(`ALTER TABLE "wallet_topups" DROP COLUMN IF EXISTS "method"`);
  }
}
