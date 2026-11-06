import { createProxyMiddleware } from 'http-proxy-middleware';
import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@repo/types';
import { SESSION_COOKIE, sessionStore, type Session } from '../auth/session-store.js';

export interface ProxyRule {
  method: string;
  pattern: RegExp;
  roles: UserRole[];
}

const IDENTITY_TARGET = process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3002';
const ATTENDENCE_TARGET = process.env.ATTENDENCE_SERVICE_URL ?? 'http://localhost:3003';

const USER_RULES: ProxyRule[] = [
  { method: 'GET', pattern: /^\/users$/, roles: ['MASTER'] },
  { method: 'POST', pattern: /^\/users$/, roles: ['MASTER'] },
  { method: 'PATCH', pattern: /^\/users\/\d+$/, roles: ['MASTER'] },
  { method: 'DELETE', pattern: /^\/users\/\d+$/, roles: ['MASTER'] },
  { method: 'PATCH', pattern: /^\/auth\/password$/, roles: ['MASTER', 'EMPLOYEE'] },
];

const ATTENDANCE_RULES: ProxyRule[] = [
  { method: 'POST', pattern: /^\/attendance$/, roles: ['EMPLOYEE'] },
  { method: 'GET', pattern: /^\/attendance$/, roles: ['MASTER'] },
  { method: 'GET', pattern: /^\/attendance\/me$/, roles: ['EMPLOYEE'] },
  { method: 'GET', pattern: /^\/attendance\/today$/, roles: ['EMPLOYEE', 'MASTER'] },
  { method: 'PATCH', pattern: /^\/attendance\/\d+\/description$/, roles: ['EMPLOYEE'] },
  { method: 'PATCH', pattern: /^\/attendance\/\d+\/checkout$/, roles: ['EMPLOYEE'] },
  { method: 'GET', pattern: /^\/attendance\/photo\/\d+$/, roles: ['EMPLOYEE', 'MASTER'] },
];

const identityProxy = createProxyMiddleware({
  target: IDENTITY_TARGET,
  on: { proxyReq: setSessionHeaders },
});

const attendenceProxy = createProxyMiddleware({
  target: ATTENDENCE_TARGET,
  on: { proxyReq: setSessionHeaders },
});

function setSessionHeaders(proxyReq: import('http').ClientRequest, req: Request) {
  const session = (req as Request & { gatewaySession?: Session }).gatewaySession;
  if (!session) return;
  proxyReq.setHeader('x-user-id', String(session.userId));
  proxyReq.setHeader('x-user-role', session.role);
  proxyReq.setHeader('x-user-email', session.email);
}

export function createGatewayProxyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.originalUrl.split('?')[0];
    const isUsers = path === '/users' || path.startsWith('/users/');
    const isAttendance = path === '/attendance' || path.startsWith('/attendance/');
    const isPasswordChange = path === '/auth/password';
    if (!isUsers && !isAttendance && !isPasswordChange) {
      next();
      return;
    }

    const sid = (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? '';
    const session = sessionStore.get(sid);
    if (!session) {
      res.status(401).json({ statusCode: 401, message: 'Authentication required' });
      return;
    }

    const rules = isUsers || isPasswordChange ? USER_RULES : ATTENDANCE_RULES;
    const method = req.method.toUpperCase();
    const rule = rules.find((r) => r.method === method && r.pattern.test(path));
    if (!rule) {
      res.status(404).json({ statusCode: 404, message: 'Route not found' });
      return;
    }
    if (!rule.roles.includes(session.role)) {
      res.status(403).json({ statusCode: 403, message: 'Insufficient role' });
      return;
    }

    (req as Request & { gatewaySession?: Session }).gatewaySession = session;
    delete req.headers['x-user-id'];
    delete req.headers['x-user-role'];
    delete req.headers['x-user-email'];

    const proxy = isAttendance ? attendenceProxy : identityProxy;
    proxy(req, res, next);
  };
}
