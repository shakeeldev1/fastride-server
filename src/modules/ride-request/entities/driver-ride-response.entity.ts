import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('driver_ride_responses')
@Index(['rideRequestId', 'driverId'], { unique: true })
export class DriverRideResponse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ride_request_id', type: 'uuid' })
  rideRequestId!: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId!: string;

  @Column({ type: 'varchar', length: 20 })
  decision!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  counterOfferPrice!: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  message!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
