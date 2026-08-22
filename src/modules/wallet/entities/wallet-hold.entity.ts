import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Declared here too (not just in the migration) so `synchronize: true` in
// development doesn't treat this as an "unknown" constraint and drop it on
// the next boot — mirrors the same convention used on WalletTransaction.
@Entity('wallet_holds')
@Unique('UQ_wallet_holds_ride_request_driver', ['rideRequestId', 'driverId'])
export class WalletHold {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  @Index()
  driverId!: string;

  @Column({ name: 'ride_request_id', type: 'uuid' })
  rideRequestId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  // 'active' | 'released' | 'captured'
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
