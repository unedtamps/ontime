import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import type { DomainEvent } from '@repo/types';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const brokers = (
      (this.config.get<string>('KAFKA_BROKERS') as string | undefined) ??
      'localhost:9092'
    ).split(',');
    const kafka = new Kafka({ clientId: 'identity-service', brokers });
    this.producer = kafka.producer();
    await this.producer.connect();
    this.logger.log(`Connected to Kafka brokers ${brokers.join(', ')}`);
  }

  async onModuleDestroy() {
    await this.producer?.disconnect();
  }

  async publish<TType extends string, TPayload>(
    topic: string,
    key: string,
    event: DomainEvent<TType, TPayload>,
  ) {
    if (!this.producer) throw new Error('Kafka producer not connected');
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(event) }],
    });
    this.logger.log(`Published ${event.type} to ${topic}`);
  }
}
