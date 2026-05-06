import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ride_requests')
export class RideRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'rider_id', type: 'uuid' })
  riderId!: string;

  @Column({ type: 'varchar', length: 200 })
  pickupLocation!: string;

  @Column({ type: 'varchar', length: 100 })
  pickupArea!: string;

  @Column({ type: 'varchar', length: 200 })
  dropoffLocation!: string;

  @Column({ type: 'varchar', length: 20 })
  vehicleType!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  offeredPrice!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  pickupLatitude!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  pickupLongitude!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  dropoffLatitude!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  dropoffLongitude!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'open' })
  status!: string;

  @Column({ name: 'selected_driver_id', type: 'uuid', nullable: true })
  selectedDriverId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  selectedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
