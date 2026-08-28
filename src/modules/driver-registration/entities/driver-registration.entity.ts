import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('driver_registrations')
export class DriverRegistration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @Column({ type: 'varchar', length: 255 })
  personalPictureUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  personalPicturePublicId!: string;

  @Column({ type: 'varchar', length: 100 })
  licenseNumber!: string;

  @Column({ type: 'date' })
  expirationDate!: string;

  @Column({ type: 'varchar', length: 255 })
  frontSideOfLicenseUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  frontSideOfLicensePublicId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  selfieWithDriverLicenseUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  selfieWithDriverLicensePublicId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  idNumber!: string;

  @Column({ type: 'varchar', length: 255 })
  cnicFrontUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  cnicFrontPublicId!: string;

  @Column({ type: 'varchar', length: 255 })
  cnicBackUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  cnicBackPublicId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photoOfVehicleUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photoOfVehiclePublicId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vehicleRegistrationCertificateUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  vehicleRegistrationCertificatePublicId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  backsideOfVehicleInformationUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  backsideOfVehicleInformationPublicId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  policeCertificateUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  policeCertificatePublicId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vehicleBrand!: string | null;

  @Column({ type: 'varchar', length: 20 })
  vehicleType!: string;

  @Column({ type: 'varchar', length: 100 })
  operatingArea!: string;

  @Column({ type: 'varchar', length: 100 })
  vehicleModel!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehicleColor!: string | null;

  @Column({ type: 'varchar', length: 30 })
  numberPlate!: string;

  @Column({ type: 'int' })
  productionYear!: number;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}