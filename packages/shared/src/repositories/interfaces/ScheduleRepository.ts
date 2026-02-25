import type { DailySchedule, UserProfile } from "../../types/schedule";

/**
 * Repository for daily schedules and user profiles.
 */
export interface ScheduleRepository {
  /** User profile operations */
  getProfile(userId: string): Promise<UserProfile | null>;
  updateProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, "id" | "createdAt" | "updatedAt">>,
  ): Promise<UserProfile>;

  /** Daily schedule operations */
  getSchedule(userId: string, date: string): Promise<DailySchedule | null>;
  createSchedule(
    schedule: Omit<DailySchedule, "id" | "confirmedAt">,
  ): Promise<DailySchedule>;
  confirmSchedule(scheduleId: string): Promise<void>;
}
