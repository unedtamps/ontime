export type UserRole = 'MASTER' | 'EMPLOYEE';

export const KAFKA_TOPICS = {
  IDENTITY_EVENTS: 'identity.events',
  ATTENDENCE_EVENTS: 'attendence.events',
} as const;

export interface UserSnapshot {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  department: string | null;
  position: string | null;
}

export interface UserDeletedPayload {
  id: number;
  email: string;
  fullName: string;
}

export interface UserCreatedPayload extends UserSnapshot {
  password: string;
}

export interface AttendanceCreatedPayload {
  id: number;
  userId: number;
  workDate: string;
  description: string | null;
  photoFilename: string;
  photoPath: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
}

export interface AttendanceUpdatedPayload {
  id: number;
  userId: number;
  workDate: string;
  description: string | null;
}

export interface AttendanceCheckedOutPayload {
  id: number;
  userId: number;
  workDate: string;
  checkedOutAt: string;
}

export type IdentityEventType = 'user.created' | 'user.updated' | 'user.deleted';

export type AttendenceEventType =
  | 'attendance.created'
  | 'attendance.updated'
  | 'attendance.checked_out';

export interface DomainEvent<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
  occurredAt: string;
}

export type UserCreatedEvent = DomainEvent<'user.created', UserCreatedPayload>;

export type UserUpdatedEvent = DomainEvent<'user.updated', UserSnapshot>;

export type UserDeletedEvent = DomainEvent<'user.deleted', UserDeletedPayload>;

export type AttendanceCreatedEvent = DomainEvent<
  'attendance.created',
  AttendanceCreatedPayload
>;

export type AttendanceUpdatedEvent = DomainEvent<
  'attendance.updated',
  AttendanceUpdatedPayload
>;

export type AttendanceCheckedOutEvent = DomainEvent<
  'attendance.checked_out',
  AttendanceCheckedOutPayload
>;

export type IdentityEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent;

export type AttendenceEvent =
  | AttendanceCreatedEvent
  | AttendanceUpdatedEvent
  | AttendanceCheckedOutEvent;
