import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetPasswordFieldsToUsers1684524000000 implements MigrationInterface {
  name = 'AddResetPasswordFieldsToUsers1684524000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_token" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_expires_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_token"`,
    );
  }
}
