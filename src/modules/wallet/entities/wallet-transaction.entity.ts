import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Declared here (not just in the migration) so `synchronize: true` in
// development doesn't treat this as an "unknown" constraint and drop it on
// the next boot. Name matches the migration's constraint name so TypeORM
// recognizes them as the same constraint rather than trying to replace it.
@Entity('wallet_transactions')
@Unique('UQ_wallet_transactions_ride_request_type', ['rideRequestId', 'type'])
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', length: 30 })
  type!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount!: string;

  @Column({ name: 'balance_after', type: 'numeric', precision: 12, scale: 2 })
  balanceAfter!: string;

  @Column({ name: 'ride_request_id', type: 'uuid', nullable: true })
  @Index()
  rideRequestId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status!: string;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 255, nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
