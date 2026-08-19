import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentsTable1755000000000 implements MigrationInterface {
  name = 'CreatePaymentsTable1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ride_request_id" uuid NOT NULL,
        "rider_id" uuid NOT NULL,
        "provider" character varying(20) NOT NULL DEFAULT 'jazzcash',
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'PKR',
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "txn_ref_no" character varying(50) NOT NULL,
        "bill_reference" character varying(50),
        "jazzcash_response_code" character varying(10),
        "jazzcash_response_message" character varying(255),
        "jazzcash_retrieval_reference_no" character varying(50),
        "jazzcash_auth_code" character varying(50),
        "rawCallbackPayload" jsonb,
        "paid_at" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_txn_ref_no" UNIQUE ("txn_ref_no")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_ride_request_id" ON "payments" ("ride_request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_rider_id" ON "payments" ("rider_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
  }
}
