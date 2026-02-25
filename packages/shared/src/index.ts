// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  Exercise,
  Difficulty,
  ExercisePosition,
  MuscleGroup,
  CommonMistake,
  FormCriteria,
  AngleRange,
} from './types/exercise';

export type {
  Session,
  SlotNumber,
  SessionType,
  SessionStatus,
  SessionExercise,
  ComposedWorkout,
  ComposedExercise,
  MeditationConfig,
  BreathingPattern,
} from './types/session';

export type { MoodEntry, MoodLabel, MoodValue } from './types/mood';
export { MOOD_MAP, MOOD_LABELS } from './types/mood';

export type {
  UserProfile,
  NotificationChannel,
  AvailabilityBlock,
  DailySchedule,
  ProposedSlot,
  WorkspaceCalibration,
} from './types/schedule';

export type {
  Feedback,
  FeedbackCategory,
  FeedbackStatus,
} from './types/feedback';

export type {
  TimedEvent,
  EventType,
  ExerciseEventFile,
} from './types/events';

export type {
  Landmark,
  PoseLandmarks,
  LandmarkName,
} from './types/pose';
export { LANDMARK_INDEX } from './types/pose';

export type {
  FormScore,
  AngleDeviation,
  DeviationSeverity,
  FormFeedback,
} from './types/form';

// ─── Repository Interfaces ──────────────────────────────────────────────────
export type {
  AuthService,
  AuthResult,
  AuthSession,
  AuthError,
  Unsubscribe,
} from './repositories/interfaces/AuthService';

export type { WorkoutRepository, ExerciseResult } from './repositories/interfaces/WorkoutRepository';
export type { SessionRepository } from './repositories/interfaces/SessionRepository';
export type { ExerciseRepository } from './repositories/interfaces/ExerciseRepository';
export type { MoodRepository } from './repositories/interfaces/MoodRepository';
export type { FeedbackRepository } from './repositories/interfaces/FeedbackRepository';
export type { ScheduleRepository } from './repositories/interfaces/ScheduleRepository';
export type {
  RotationRepository,
  RotationEntry,
} from './repositories/interfaces/RotationRepository';

// ─── AI Interfaces ──────────────────────────────────────────────────────────
export type {
  PoseEstimator,
  VideoFrame,
} from './ai/pose/PoseEstimator';
