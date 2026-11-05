import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { UserRole } from '@repo/types';

@Entity({ name: 'USERS' })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255, unique: true })
  email!: string;

  @Column({ name: 'PASSWORD_HASH', length: 255 })
  passwordHash!: string;

  @Column({ length: 255 })
  fullName!: string;

  @Column({ length: 16 })
  role!: UserRole;

  @Column({ type: 'varchar', length: 128, nullable: true })
  department!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  position!: string | null;

  @Column({ type: 'number', default: 1 })
  active!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
