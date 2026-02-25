import type { Session, SessionStatus } from '../../types/session';

/**
 * Repository for session CRUD and status transitions.
 */
export interface SessionRepository {
  getById(id: string): Promise<Session | null>;
  getBySchedule(scheduleId: string): Promise<Session[]>;
  getTodaySessions(userId: string): Promise<Session[]>;
  updateStatus(id: string, status: SessionStatus): Promise<void>;
  create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session>;
}
