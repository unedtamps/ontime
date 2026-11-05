import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, type GatewayUser } from '../guards/current-user.decorator.js';
import { GatewayHeadersGuard, Roles } from '../guards/gateway-headers.guard.js';
import { AttendanceService } from './attendance.service.js';
import { CheckInDto, UpdateDescriptionDto } from './dto.js';
import { UploadDirService } from './upload-dir.service.js';

@Controller()
@UseGuards(GatewayHeadersGuard)
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly uploadDir: UploadDirService,
  ) {}

  @Post('attendance')
  @Roles('EMPLOYEE')
  @UseInterceptors(FileInterceptor('photo'))
  async checkIn(
    @CurrentUser() user: GatewayUser,
    @Body() dto: CheckInDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Photo proof is required');
    return this.attendance.checkIn(
      user.userId,
      dto.description ?? null,
      file.filename,
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
      },
    );
  }
  @Patch('attendance/:id/description')
  @Roles('EMPLOYEE')
  updateDescription(
    @CurrentUser() user: GatewayUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDescriptionDto,
  ) {
    return this.attendance.updateDescription(id, user.userId, dto.description);
  }

  @Patch('attendance/:id/checkout')
  @Roles('EMPLOYEE')
  checkOut(@CurrentUser() user: GatewayUser, @Param('id', ParseIntPipe) id: number) {
    return this.attendance.checkOut(id, user.userId);
  }

  @Get('attendance')
  @Roles('MASTER')
  listAll() {
    return this.attendance.listAll();
  }

  @Get('attendance/me')
  @Roles('EMPLOYEE')
  listMine(@CurrentUser() user: GatewayUser) {
    return this.attendance.listMine(user.userId);
  }

  @Get('attendance/photo/:id')
  @Roles('EMPLOYEE', 'MASTER')
  async photo(
    @CurrentUser() user: GatewayUser,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const record = await this.attendance.photoOwnership(
      id,
      user.userId,
      user.role,
    );
    res.sendFile(this.uploadDir.pathFor(record.photoPath));
  }
}
