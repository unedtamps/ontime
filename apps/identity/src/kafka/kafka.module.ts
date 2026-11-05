import { Global, Module } from '@nestjs/common';
import { KafkaProducerService } from './producer.service.js';

@Global()
@Module({
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
