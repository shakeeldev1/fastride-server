import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletTransactionUniqueConstraint1755100100000 implements MigrationInterface {
  name = 'AddWalletTransactionUniqueConstraint1755100100000';

  // Guarantees at most one ride_earning row and one commission_debit row per
  // ride_request_id. Postgres treats every NULL as distinct for uniqueness,
  // so withdrawal / adjustment rows (ride_request_id IS NULL) are unaffected
  // and can repeat freely.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions"
       ADD CONSTRAINT "UQ_wallet_transactions_ride_request_type" UNIQUE ("ride_request_id", "type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "UQ_wallet_transactions_ride_request_type"`,
    );
  }
}
