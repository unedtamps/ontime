import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity.js';
import { InternalAuthController, PasswordController, UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [InternalAuthController, PasswordController, UsersController],
  providers: [UsersService],
})
export class UsersModule {}
