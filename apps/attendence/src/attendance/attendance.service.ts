import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { rename } from 'node:fs/promises';
import {
  KAFKA_TOPICS,
  type AttendanceCheckedOutEvent,
  type AttendanceCreatedEvent,
  type AttendanceUpdatedEvent,
  type UserSnapshot,
} from '@repo/types';
import { KafkaProducerService } from '../kafka/producer.service.js';
import { AttendanceEntity } from './attendance.entity.js';
import { todayWorkDate, UploadDirService } from './upload-dir.service.js';
import { WatermarkService } from './watermark.service.js';

const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3002';
const MAX_ACCURACY_METERS = 100;

export interface CheckInLocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceEntity)
    private readonly repo: Repository<AttendanceEntity>,
    private readonly producer: KafkaProducerService,
    private readonly uploadDir: UploadDirService,
    private readonly watermark: WatermarkService,
  ) {}

  private async resolveUserName(userId: number): Promise<string> {
    try {
      const { data } = await axios.get<UserSnapshot>(
        `${IDENTITY_URL}/internal/users/${userId}`,
        { timeout: 3000 },
      );
      return data.fullName;
    } catch {
      return 'Employee';
    }
  }

  async checkIn(
    userId: number,
    description: string | null,
    photoFilename: string,
    location: CheckInLocation = {},
  ): Promise<AttendanceEntity> {
    const workDate = todayWorkDate();
    const existing = await this.repo.findOne({ where: { userId, workDate } });
    if (existing) {
      throw new ConflictException('Already checked in today');
    }

    const recordedAt = new Date();
    const fullName = await this.resolveUserName(userId);
    const latitude = location.latitude ?? null;
    const longitude = location.longitude ?? null;
    const accuracy = location.accuracy ?? null;

    if (latitude === null || longitude === null) {
      throw new BadRequestException('Location is required to check in');
    }
    if (accuracy === null || accuracy > MAX_ACCURACY_METERS) {
      throw new BadRequestException(
        `Location accuracy must be ${MAX_ACCURACY_METERS} m or better`,
      );
    }

    const sourcePath = this.uploadDir.pathFor(photoFilename);
    const tempPath = this.uploadDir.pathFor(`${photoFilename}.marked`);
    const marked = await this.watermark.apply(sourcePath, tempPath, {
      fullName,
      recordedAt,
      workDate,
      latitude,
      longitude,
      locationAccuracy: accuracy,
    });
    if (marked) {
      await rename(tempPath, sourcePath);
    }

    const saved = await this.repo.save(
      this.repo.create({
        userId,
        workDate,
        description,
        photoPath: photoFilename,
        latitude,
        longitude,
        locationAccuracy: accuracy,
      }),
    );
    const event: AttendanceCreatedEvent = {
      type: 'attendance.created',
      payload: {
        id: saved.id,
        userId: saved.userId,
        workDate: saved.workDate,
        description: saved.description,
        photoFilename: saved.photoPath,
        photoPath: this.uploadDir.pathFor(saved.photoPath),
        latitude: saved.latitude,
        longitude: saved.longitude,
        locationAccuracy: saved.locationAccuracy,
      },
      occurredAt: new Date().toISOString(),
    };
    await this.producer.publish(
      KAFKA_TOPICS.ATTENDENCE_EVENTS,
      String(saved.userId),
      event,
    );
    return saved;
  }

  async updateDescription(
    id: number,
    userId: number,
    description: string,
  ): Promise<AttendanceEntity> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (record.userId !== userId) {
      throw new ForbiddenException('Not your attendance record');
    }
    record.description = description;
    const saved = await this.repo.save(record);
    const event: AttendanceUpdatedEvent = {
      type: 'attendance.updated',
      payload: {
        id: saved.id,
        userId: saved.userId,
        workDate: saved.workDate,
        description: saved.description,
      },
      occurredAt: new Date().toISOString(),
    };
    await this.producer.publish(
      KAFKA_TOPICS.ATTENDENCE_EVENTS,
      String(saved.userId),
      event,
    );
    return saved;
  }

  async checkOut(id: number, userId: number): Promise<AttendanceEntity> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (record.userId !== userId) {
      throw new ForbiddenException('Not your attendance record');
    }
    if (record.checkOutAt) {
      throw new ConflictException('Already checked out');
    }
    record.checkOutAt = new Date();
    const saved = await this.repo.save(record);
    const checkedOutAt = (saved.checkOutAt ?? new Date()).toISOString();
    const event: AttendanceCheckedOutEvent = {
      type: 'attendance.checked_out',
      payload: {
        id: saved.id,
        userId: saved.userId,
        workDate: saved.workDate,
        checkedOutAt,
      },
      occurredAt: new Date().toISOString(),
    };
    await this.producer.publish(
      KAFKA_TOPICS.ATTENDENCE_EVENTS,
      String(saved.userId),
      event,
    );
    return saved;
  }

  listAll(): Promise<AttendanceEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  listMine(userId: number): Promise<AttendanceEntity[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async photoOwnership(
    id: number,
    userId: number,
    role: string,
  ): Promise<AttendanceEntity> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Attendance record not found');
    if (role !== 'MASTER' && record.userId !== userId) {
      throw new ForbiddenException('Not your attendance record');
    }
    return record;
  }
}
