import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyDriverRegistration1756100000000 implements MigrationInterface {
  name = 'SimplifyDriverRegistration1756100000000';

  private readonly nowOptionalColumns = [
    'firstName',
    'lastName',
    'dateOfBirth',
    'selfieWithDriverLicenseUrl',
    'selfieWithDriverLicensePublicId',
    'photoOfVehicleUrl',
    'photoOfVehiclePublicId',
    'vehicleRegistrationCertificateUrl',
    'vehicleRegistrationCertificatePublicId',
    'backsideOfVehicleInformationUrl',
    'backsideOfVehicleInformationPublicId',
    'vehicleBrand',
    'vehicleColor',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.nowOptionalColumns) {
      await queryRunner.query(
        `ALTER TABLE "driver_registrations" ALTER COLUMN "${column}" DROP NOT NULL`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "driver_registrations" ADD COLUMN IF NOT EXISTS "policeCertificateUrl" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_registrations" ADD COLUMN IF NOT EXISTS "policeCertificatePublicId" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "driver_registrations" DROP COLUMN IF EXISTS "policeCertificatePublicId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "driver_registrations" DROP COLUMN IF EXISTS "policeCertificateUrl"`,
    );

    // Not restoring NOT NULL here: any rows created while these were
    // optional may have nulls, which would make the rollback itself fail.
  }
}
