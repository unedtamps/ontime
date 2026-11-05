import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsConsumerService } from './kafka/events-consumer.service.js';
import { MailerService } from './mail/mailer.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' })],
  providers: [MailerService, EventsConsumerService],
})
export class AppModule {}
