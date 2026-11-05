import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import type { Request, Response } from 'express';
import { SESSION_COOKIE, sessionStore } from './session-store.js';
import { LoginDto } from './login.dto.js';

const IDENTITY_URL = process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3002';

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    let user: { id: number; role: 'MASTER' | 'EMPLOYEE'; email: string; fullName: string };
    try {
      const response = await axios.post(`${IDENTITY_URL}/internal/auth/verify`, {
        email: dto.email,
        password: dto.password,
      });
      user = response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw error;
    }
    const sid = sessionStore.create({
      userId: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    });
    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    return { id: user.id, role: user.role, email: user.email, fullName: user.fullName };
  }

  @Get('me')
  me(@Req() req: Request) {
    const sid = (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? '';
    const session = sessionStore.get(sid);
    if (!session) throw new UnauthorizedException('Authentication required');
    return {
      id: session.userId,
      role: session.role,
      email: session.email,
      fullName: session.fullName,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sid = (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? '';
    sessionStore.destroy(sid);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }
}
