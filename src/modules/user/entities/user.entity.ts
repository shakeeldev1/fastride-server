import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 6, nullable: true })
  otp!: string;

  @Column({ type: 'timestamp', nullable: true })
  otp_expires_at!: Date;

  @Column({ type: 'boolean', default: false })
  is_email_verified!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profile_picture_url!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_picture_public_id!: string;

  @Column({ type: 'text', nullable: true })
  bio!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  address!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  city!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  state!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postal_code!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  country!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
