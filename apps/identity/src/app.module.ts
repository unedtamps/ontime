import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from './kafka/kafka.module.js';
import { UserEntity } from './users/user.entity.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'oracle' as const,
        username: config.get<string>('DB_IDENTITY_USER') ?? 'IDENTITY',
        password: config.get<string>('DB_IDENTITY_PASSWORD') ?? 'IdentityPass1',
        connectString: `${config.get<string>('DB_IDENTITY_HOST') ?? 'localhost'}:${config.get<string>('DB_IDENTITY_HOST_PORT') ?? '1521'}/FREEPDB1`,
        entities: [UserEntity],
        synchronize: true,
      }),
    }),
    KafkaModule,
    UsersModule,
  ],
})
export class AppModule {}
