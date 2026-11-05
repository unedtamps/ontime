import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GatewayHeadersGuard, Roles } from '../guards/gateway-headers.guard.js';
import { CreateUserDto, ChangePasswordDto, UpdateUserDto, VerifyAuthDto } from './dto.js';
import { UsersService } from './users.service.js';

const USER_ID_HEADER = 'x-user-id';

@Controller('internal')
export class InternalAuthController {
  constructor(private readonly users: UsersService) {}

  @Post('auth/verify')
  async verify(@Body() dto: VerifyAuthDto) {
    const user = await this.users.verify(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  @Get('users/:id')
  async byId(@Param('id', ParseIntPipe) id: number) {
    return this.users.byId(id);
  }
}

@Controller('auth')
@UseGuards(GatewayHeadersGuard)
export class PasswordController {
  constructor(private readonly users: UsersService) {}

  @Patch('password')
  @Roles('MASTER', 'EMPLOYEE')
  async changePassword(
    @Headers(USER_ID_HEADER) userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.users.changePassword(
      Number(userId),
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }
}

@Controller('users')
@UseGuards(GatewayHeadersGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('MASTER')
  list() {
    return this.users.list();
  }

  @Post()
  @Roles('MASTER')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Roles('MASTER')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Roles('MASTER')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.users.remove(id);
  }
}
