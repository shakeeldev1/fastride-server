import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGenderToUsers1756000000000 implements MigrationInterface {
  name = 'AddGenderToUsers1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" character varying(10)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gender"`);
  }
}
