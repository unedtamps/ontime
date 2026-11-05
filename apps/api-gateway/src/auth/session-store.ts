import { randomUUID } from 'node:crypto';
import type { UserRole } from '@repo/types';

export const SESSION_COOKIE = 'ontime_session';
export const SESSION_TTL_MS = 15 * 60 * 1000;

export interface Session {
  userId: number;
  role: UserRole;
  email: string;
  fullName: string;
  expiresAt: number;
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  start() {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
  }

  stop() {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  create(user: Omit<Session, 'expiresAt'>): string {
    const sid = randomUUID();
    this.sessions.set(sid, { ...user, expiresAt: Date.now() + SESSION_TTL_MS });
    return sid;
  }

  get(sid: string): Session | null {
    const session = this.sessions.get(sid);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sid);
      return null;
    }
    return session;
  }

  destroy(sid: string) {
    this.sessions.delete(sid);
  }

  private sweep() {
    const now = Date.now();
    for (const [sid, session] of this.sessions) {
      if (now > session.expiresAt) this.sessions.delete(sid);
    }
  }
}

export const sessionStore = new SessionStore();
