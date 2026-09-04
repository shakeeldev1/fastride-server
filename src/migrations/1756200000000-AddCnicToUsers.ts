import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCnicToUsers1756200000000 implements MigrationInterface {
  name = 'AddCnicToUsers1756200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cnic" character varying(13)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "cnic"`);
  }
}
