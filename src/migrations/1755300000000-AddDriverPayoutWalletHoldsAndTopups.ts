import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriverPayoutWalletHoldsAndTopups1755300000000 implements MigrationInterface {
  name = 'AddDriverPayoutWalletHoldsAndTopups1755300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jazzcash_account_number" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jazzcash_account_title" character varying(100)`,
    );

    await queryRunner.query(
      `ALTER TABLE "ride_requests" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "wallet_holds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "ride_request_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_holds_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wallet_holds_ride_request_driver" ON "wallet_holds" ("ride_request_id", "driver_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_holds_driver_id" ON "wallet_holds" ("driver_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "wallet_topups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "provider" character varying(20) NOT NULL DEFAULT 'jazzcash',
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'PKR',
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "txn_ref_no" character varying(50) NOT NULL,
        "bill_reference" character varying(50),
        "jazzcash_response_code" character varying(10),
        "jazzcash_response_message" character varying(255),
        "jazzcash_retrieval_reference_no" character varying(50),
        "jazzcash_auth_code" character varying(50),
        "raw_callback_payload" jsonb,
        "paid_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_topups_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallet_topups_txn_ref_no" UNIQUE ("txn_ref_no")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_topups_user_id" ON "wallet_topups" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_topups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_holds"`);
    await queryRunner.query(`ALTER TABLE "ride_requests" DROP COLUMN IF EXISTS "cancelled_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "jazzcash_account_title"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "jazzcash_account_number"`);
  }
}
