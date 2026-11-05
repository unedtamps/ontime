import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AttendanceController } from './attendance/attendance.controller.js';
import { AttendanceEntity } from './attendance/attendance.entity.js';
import { AttendanceService } from './attendance/attendance.service.js';
import { WatermarkService } from './attendance/watermark.service.js';
import { extForMime, UploadDirService } from './attendance/upload-dir.service.js';
import { UploadDirModule } from './attendance/upload-dir.module.js';
import { KafkaModule } from './kafka/kafka.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    UploadDirModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'oracle' as const,
        username: config.get<string>('DB_ATTENDENCE_USER') ?? 'ATTENDENCE',
        password: config.get<string>('DB_ATTENDENCE_PASSWORD') ?? 'AttendencePass1',
        connectString: `${config.get<string>('DB_ATTENDENCE_HOST') ?? 'localhost'}:${config.get<string>('DB_ATTENDENCE_HOST_PORT') ?? '1523'}/FREEPDB1`,
        entities: [AttendanceEntity],
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([AttendanceEntity]),
    MulterModule.registerAsync({
      inject: [UploadDirService],
      useFactory: (uploadDir: UploadDirService) => ({
        storage: diskStorage({
          destination: uploadDir.dir,
          filename: (_req, file, cb) => {
            const userId = (_req.headers['x-user-id'] ?? 'unknown').toString();
            cb(null, `${userId}-${Date.now()}${extForMime(file.mimetype)}`);
          },
        }),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
        },
      }),
    }),
    KafkaModule,
  ],
  providers: [AttendanceService, WatermarkService],
  controllers: [AttendanceController],
})
export class AppModule {}
