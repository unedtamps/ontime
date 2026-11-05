import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'ATTENDANCES' })
export class AttendanceEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'USER_ID', type: 'number' })
  userId!: number;

  @Column({ name: 'WORK_DATE', length: 10 })
  workDate!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description!: string | null;

  @Column({ name: 'PHOTO_PATH', length: 255 })
  photoPath!: string;

  @Column({ name: 'CHECKED_OUT_AT', type: 'timestamp', nullable: true })
  checkOutAt!: Date | null;

  @Column({ name: 'LATITUDE', type: 'number', precision: 10, scale: 6, nullable: true })
  latitude!: number | null;

  @Column({ name: 'LONGITUDE', type: 'number', precision: 10, scale: 6, nullable: true })
  longitude!: number | null;

  @Column({ name: 'LOCATION_ACCURACY', type: 'number', precision: 10, scale: 2, nullable: true })
  locationAccuracy!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
