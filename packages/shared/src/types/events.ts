/**
 * A single timed event during an exercise.
 * Events are stored as JSON files per exercise in content/exercises/.
 * The EventPlayer reads the timeline and renders events by type.
 */
export interface TimedEvent {
  eventId: string;
  /** Milliseconds relative to exercise start */
  timestampStart: number;
  /** Null = instant event (no duration) */
  timestampEnd: number | null;
  /** The text content to display */
  content: string;
  type: EventType;
  /**
   * Optional trigger condition.
   * If set, event is fired by form analysis rather than by time.
   * Examples: "good_streak_3", "elbow_deviation_high"
   */
  trigger: string | null;
}

export type EventType =
  | 'caption'
  | 'instruction'
  | 'tip'
  | 'encouragement'
  | 'correction'
  | 'transition'
  | 'meditation';

/**
 * A complete event file for one exercise.
 * Loaded from content/exercises/[exercise-name].json.
 */
export interface ExerciseEventFile {
  exerciseId: string;
  exerciseName: string;
  events: TimedEvent[];
}
