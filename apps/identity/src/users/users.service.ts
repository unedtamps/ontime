import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  KAFKA_TOPICS,
  type UserCreatedEvent,
  type UserDeletedEvent,
  type UserSnapshot,
  type UserUpdatedEvent,
} from '@repo/types';
import { KafkaProducerService } from '../kafka/producer.service.js';
import { CreateUserDto, UpdateUserDto } from './dto.js';
import { generatePassword } from './password-generator.js';
import { UserEntity } from './user.entity.js';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
    private readonly producer: KafkaProducerService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedMaster();
  }

  private async seedMaster() {
    const existing = await this.repo.findOne({ where: { role: 'MASTER' } });
    if (existing) return;
    const email = this.config.get<string>('IDENTITY_MASTER_EMAIL') ?? 'master@ontime.local';
    const password = this.config.get<string>('IDENTITY_MASTER_PASSWORD') ?? 'MasterPass1';
    await this.repo.save(
      this.repo.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        fullName: 'Master',
        role: 'MASTER',
        department: null,
        position: null,
        active: 1,
      }),
    );
    this.logger.log(`Seeded master account ${email}`);
  }

  snapshot(user: UserEntity): UserSnapshot {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
      position: user.position,
    };
  }

  async verify(email: string, password: string): Promise<UserSnapshot | null> {
    const user = await this.repo.findOne({ where: { email } });
    if (!user || user.active !== 1) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? this.snapshot(user) : null;
  }

  async list(): Promise<UserSnapshot[]> {
    const users = await this.repo.find({ order: { id: 'ASC' } });
    return users.map((u) => this.snapshot(u));
  }

  async byId(id: number): Promise<UserSnapshot> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.snapshot(user);
  }

  async create(dto: CreateUserDto): Promise<UserSnapshot> {
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');
    const password = generatePassword();
    const saved = await this.repo.save(
      this.repo.create({
        email: dto.email,
        passwordHash: await bcrypt.hash(password, 10),
        fullName: dto.fullName,
        role: 'EMPLOYEE',
        department: dto.department ?? null,
        position: dto.position ?? null,
        active: 1,
      }),
    );
    const event: UserCreatedEvent = {
      type: 'user.created',
      payload: { ...this.snapshot(saved), password },
      occurredAt: new Date().toISOString(),
    };
    await this.producer.publish(KAFKA_TOPICS.IDENTITY_EVENTS, String(saved.id), event);
    return this.snapshot(saved);
  }

  async update(id: number, dto: UpdateUserDto): Promise<UserSnapshot> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.position !== undefined) user.position = dto.position;
    if (dto.active !== undefined) user.active = dto.active ? 1 : 0;
    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    const saved = await this.repo.save(user);
    const event: UserUpdatedEvent = {
      type: 'user.updated',
      payload: this.snapshot(saved),
      occurredAt: new Date().toISOString(),
    };
    await this.producer.publish(KAFKA_TOPICS.IDENTITY_EVENTS, String(saved.id), event);
    return this.snapshot(saved);
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.repo.save(user);
    this.logger.log(`Password changed for user ${userId}`);
  }

  async remove(id: number): Promise<void> {    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'EMPLOYEE') {
      throw new BadRequestException('Only employee accounts can be deleted');
    }
    await this.repo.remove(user);
    const event: UserDeletedEvent = {
      type: 'user.deleted',
      payload: { id: user.id, email: user.email, fullName: user.fullName },
      occurredAt: new Date().toISOString(),
    };
    await this.producer.publish(KAFKA_TOPICS.IDENTITY_EVENTS, String(user.id), event);
  }
}
