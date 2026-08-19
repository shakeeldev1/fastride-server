import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ride_request_id', type: 'uuid' })
  @Index()
  rideRequestId!: string;

  @Column({ name: 'rider_id', type: 'uuid' })
  @Index()
  riderId!: string;

  @Column({ type: 'varchar', length: 20, default: 'jazzcash' })
  provider!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 10, default: 'PKR' })
  currency!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ name: 'txn_ref_no', type: 'varchar', length: 50, unique: true })
  txnRefNo!: string;

  @Column({ name: 'bill_reference', type: 'varchar', length: 50, nullable: true })
  billReference!: string | null;

  @Column({ name: 'jazzcash_response_code', type: 'varchar', length: 10, nullable: true })
  jazzcashResponseCode!: string | null;

  @Column({ name: 'jazzcash_response_message', type: 'varchar', length: 255, nullable: true })
  jazzcashResponseMessage!: string | null;

  @Column({ name: 'jazzcash_retrieval_reference_no', type: 'varchar', length: 50, nullable: true })
  jazzcashRetrievalReferenceNo!: string | null;

  @Column({ name: 'jazzcash_auth_code', type: 'varchar', length: 50, nullable: true })
  jazzcashAuthCode!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rawCallbackPayload!: Record<string, unknown> | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  // Computed and stored in application code (mirrors how otp_expires_at is
  // handled) rather than derived from createdAt at read time — comparing a
  // DB-generated now() timestamp column against a freshly computed
  // Date.now() is unreliable across timezones with the pg driver's default
  // "timestamp without time zone" parsing.
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
