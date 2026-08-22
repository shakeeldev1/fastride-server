import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallet_topups')
export class WalletTopUp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', length: 20, default: 'jazzcash' })
  provider!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
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

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
