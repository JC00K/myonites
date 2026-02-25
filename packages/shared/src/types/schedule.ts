/**
 * User's profile including work window and notification preferences.
 * Maps to the `user_profiles` table.
 */
export interface UserProfile {
  id: string;
  displayName: string;
  workWindowStart: string; // TIME format "HH:MM"
  workWindowEnd: string;
  defaultAvailability: AvailabilityBlock[] | null;
  workspaceCalibration: WorkspaceCalibration | null;
  notificationChannel: NotificationChannel;
  notificationEmail: string | null;
  notificationPhone: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationChannel = 'email' | 'sms';

/**
 * A block of time within the work window where the user is available.
 * Users define these via the availability slider UI.
 */
export interface AvailabilityBlock {
  /** Start time in HH:MM format */
  start: string;
  /** End time in HH:MM format */
  end: string;
}

/**
 * A daily schedule with proposed workout times.
 * Maps to the `daily_schedules` table.
 */
export interface DailySchedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  availabilityBlocks: AvailabilityBlock[];
  proposedTimes: ProposedSlot[];
  confirmedAt: string | null;
}

/**
 * A single proposed workout slot within the day.
 * 6th slot is always type: 'mental'.
 */
export interface ProposedSlot {
  slotNumber: import('./session').SlotNumber;
  time: string; // ISO 8601 timestamp
  sessionType: import('./session').SessionType;
}

/**
 * Calibration data for workspace concessions in form scoring.
 * Accounts for seated vs standing, range of motion limitations, etc.
 */
export interface WorkspaceCalibration {
  position: import('./exercise').ExercisePosition;
  rangeOfMotionFactor: number; // 0.0-1.0, 1.0 = full range
  calibratedAt: string;
}
