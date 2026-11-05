import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller.js';

@Module({
  controllers: [AuthController],
})
export class AppModule {}
