import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletAndRidePaymentFields1755100000000 implements MigrationInterface {
  name = 'AddWalletAndRidePaymentFields1755100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "wallet_balance" numeric(12,2) NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "ride_requests" ADD COLUMN IF NOT EXISTS "payment_method" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ride_requests" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "wallet_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying(30) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "balance_after" numeric(12,2) NOT NULL,
        "ride_request_id" uuid,
        "description" character varying(255),
        "status" character varying(20) NOT NULL DEFAULT 'completed',
        "rejection_reason" character varying(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_transactions_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_transactions_user_id" ON "wallet_transactions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_transactions_ride_request_id" ON "wallet_transactions" ("ride_request_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transactions"`);
    await queryRunner.query(`ALTER TABLE "ride_requests" DROP COLUMN IF EXISTS "completed_at"`);
    await queryRunner.query(`ALTER TABLE "ride_requests" DROP COLUMN IF EXISTS "payment_method"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "wallet_balance"`);
  }
}
