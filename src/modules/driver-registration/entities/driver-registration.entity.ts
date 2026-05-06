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

  @Column({ type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'date' })
  dateOfBirth!: string;

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

  @Column({ type: 'varchar', length: 255 })
  selfieWithDriverLicenseUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  selfieWithDriverLicensePublicId!: string;

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

  @Column({ type: 'varchar', length: 255 })
  photoOfVehicleUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  photoOfVehiclePublicId!: string;

  @Column({ type: 'varchar', length: 255 })
  vehicleRegistrationCertificateUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  vehicleRegistrationCertificatePublicId!: string;

  @Column({ type: 'varchar', length: 255 })
  backsideOfVehicleInformationUrl!: string;

  @Column({ type: 'varchar', length: 500 })
  backsideOfVehicleInformationPublicId!: string;

  @Column({ type: 'varchar', length: 100 })
  vehicleBrand!: string;

  @Column({ type: 'varchar', length: 20 })
  vehicleType!: string;

  @Column({ type: 'varchar', length: 100 })
  operatingArea!: string;

  @Column({ type: 'varchar', length: 100 })
  vehicleModel!: string;

  @Column({ type: 'varchar', length: 50 })
  vehicleColor!: string;

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