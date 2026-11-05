import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  AttendenceEvent,
  IdentityEvent,
  UserSnapshot,
} from '@repo/types';
import { MailerService } from '../mail/mailer.service.js';

const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3002';

@Injectable()
export class EventsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsConsumerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  async onModuleInit() {
    const { Kafka } = await import('kafkajs');
    const brokers = (
      (this.config.get<string>('KAFKA_BROKERS') as string | undefined) ??
      'localhost:9092'
    ).split(',');
    const kafka = new Kafka({ clientId: 'notification-service', brokers });
    const consumer = kafka.consumer({ groupId: 'notification-service' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'identity.events', fromBeginning: true });
    await consumer.subscribe({ topic: 'attendence.events', fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const raw = message.value?.toString() ?? '';
          const event = JSON.parse(raw);
          if (topic === 'identity.events') {
            await this.handleIdentityEvent(event as IdentityEvent);
          } else {
            await this.handleAttendenceEvent(event as AttendenceEvent);
          }
        } catch (error) {
          this.logger.error(
            `Failed to process message from ${topic}: ${String(error)}`,
          );
        }
      },
    });
    this.logger.log(`Subscribed to identity.events and attendence.events`);
  }

  async onModuleDestroy(): Promise<void> {}

  private async resolveUser(userId: number): Promise<UserSnapshot | null> {
    try {
      const { data } = await axios.get<UserSnapshot>(
        `${IDENTITY_URL}/internal/users/${userId}`,
      );
      return data;
    } catch {
      this.logger.warn(`Could not resolve user ${userId}`);
      return null;
    }
  }

  private async handleIdentityEvent(event: IdentityEvent) {
    switch (event.type) {
      case 'user.created': {
        const u = event.payload;
        await this.mailer.send(
          u.email,
          'Your Ontime account was created',
          [
            `Hello ${u.fullName},`,
            '',
            `Your Ontime account has been created with the role ${u.role === 'MASTER' ? 'Master' : 'Employee'}.`,
            u.department ? `Department: ${u.department}` : null,
            u.position ? `Position: ${u.position}` : null,
            '',
            'Your sign-in details:',
            `Email: ${u.email}`,
            `Password: ${u.password}`,
            '',
            'Sign in and change your password when you get the chance.',
            '',
            'Ontime',
          ]
            .filter((line): line is string => line !== null)
            .join('\n'),
        );
        break;
      }
      case 'user.updated': {
        const u = event.payload;
        await this.mailer.send(
          u.email,
          'Your Ontime profile was updated',
          [
            `Hello ${u.fullName},`,
            '',
            'Your profile details were updated by your master.',
            u.department ? `Department: ${u.department}` : null,
            u.position ? `Position: ${u.position}` : null,
            '',
            'Ontime',
          ]
            .filter((line): line is string => line !== null)
            .join('\n'),
        );
        break;
      }
      case 'user.deleted': {
        const u = event.payload;
        await this.mailer.send(
          u.email,
          'Your Ontime account was deleted',
          [
            `Hello ${u.fullName},`,
            '',
            'Your Ontime account has been deleted by your master.',
            '',
            'Ontime',
          ].join('\n'),
        );
        break;
      }
    }
  }

  private async handleAttendenceEvent(event: AttendenceEvent) {
    const user = await this.resolveUser(event.payload.userId);
    if (!user) return;
    switch (event.type) {
      case 'attendance.created': {
        const p = event.payload;
        await this.mailer.send(
          user.email,
          `Your attendance on ${p.workDate} was recorded`,
          [
            `Hello ${user.fullName},`,
            '',
            `Your attendance on ${p.workDate} has been recorded.`,
            p.description ? `Planned work: ${p.description}` : null,
            'Your photo proof is attached.',
            '',
            'Ontime',
          ]
            .filter((line): line is string => line !== null)
            .join('\n'),
          { filename: p.photoFilename, path: p.photoPath },
        );
        break;
      }
      case 'attendance.updated': {
        const p = event.payload;
        await this.mailer.send(
          user.email,
          `Your attendance on ${p.workDate} was updated`,
          [
            `Hello ${user.fullName},`,
            '',
            `The description for your attendance on ${p.workDate} was updated.`,
            `New description: ${p.description ?? '(empty)'}`,
            '',
            'Ontime',
          ].join('\n'),
        );
        break;
      }
      case 'attendance.checked_out': {
        const p = event.payload;
        const time = new Date(p.checkedOutAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        await this.mailer.send(
          user.email,
          `Your check-out on ${p.workDate} was recorded`,
          [
            `Hello ${user.fullName},`,
            '',
            `Your check-out on ${p.workDate} has been recorded at ${time}.`,
            '',
            'Ontime',
          ].join('\n'),
        );
        break;
      }
    }
  }
}
