import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('driver_ride_alerts')
@Index(['rideRequestId', 'driverId'], { unique: true })
export class DriverRideAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ride_request_id', type: 'uuid' })
  rideRequestId!: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId!: string;

  @Column({ type: 'varchar', length: 20 })
  vehicleType!: string;

  @Column({ type: 'varchar', length: 100 })
  pickupArea!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 20, default: 'sent' })
  inAppStatus!: string;

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  systemStatus!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  emailStatus!: string;

  @Column({ type: 'text', nullable: true })
  emailError!: string | null;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
