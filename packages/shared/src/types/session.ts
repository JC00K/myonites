/**
 * Represents a single workout session (one of 6 daily slots).
 * Maps to the `sessions` table in Supabase.
 */
export interface Session {
  id: string;
  userId: string;
  scheduleId: string | null;
  slotNumber: SlotNumber;
  sessionType: SessionType;
  status: SessionStatus;
  graded: boolean;
  scheduledTime: string;
  startedAt: string | null;
  completedAt: string | null;
  deferredFrom: string | null;
  skipReason: string | null;
  notificationToken: string | null;
  notificationSentAt: string | null;
  createdAt: string;
}

export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type SessionType = 'physical' | 'mental';

export type SessionStatus =
  | 'scheduled'
  | 'notified'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'deferred'
  | 'missed';

/**
 * A single exercise within a session, with its order and results.
 * Maps to the `session_exercises` table.
 */
export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  orderIndex: number;
  formScore: number | null;
  repCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * The composed workout returned when a user confirms a session.
 * This is the payload the app receives to start a workout.
 */
export interface ComposedWorkout {
  session: Session;
  exercises: ComposedExercise[];
  meditationConfig: MeditationConfig;
}

export interface ComposedExercise {
  exercise: import('./exercise').Exercise;
  orderIndex: number;
  videoUrl: string;
  captionUrl: string | null;
  eventFileUrl: string | null;
}

export interface MeditationConfig {
  durationSeconds: number;
  breathingPattern: BreathingPattern;
  ambientTrack: string;
  reflectionPrompt: string | null;
}

export interface BreathingPattern {
  inhaleSeconds: number;
  holdSeconds: number;
  exhaleSeconds: number;
  cycles: number;
}
