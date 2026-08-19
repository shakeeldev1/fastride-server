import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentExpiresAt1755100200000 implements MigrationInterface {
  name = 'AddPaymentExpiresAt1755100200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "expires_at"`);
  }
}
