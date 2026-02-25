import type { FormCriteria, AngleRange } from './exercise';

/**
 * Result of analyzing form for a single rep.
 */
export interface FormScore {
  /** 0-100 quality score */
  score: number;
  /** Per-angle deviation details */
  deviations: AngleDeviation[];
  /** Was workspace concession applied? */
  concessionApplied: boolean;
  timestamp: number;
}

/**
 * How far a measured angle deviated from the expected range.
 */
export interface AngleDeviation {
  joint: string;
  expectedRange: AngleRange;
  measuredAngle: number;
  /** Degrees outside acceptable range (0 = within range) */
  deviationDegrees: number;
  severity: DeviationSeverity;
}

export type DeviationSeverity = 'none' | 'minor' | 'moderate' | 'major';

/**
 * Natural-language feedback generated from form scores.
 * Displayed in post-workout summary and timed events.
 */
export interface FormFeedback {
  /** Overall summary, e.g. "Good range but head tilted forward on 3/8 reps" */
  summary: string;
  /** Positive aspects of form */
  strengths: string[];
  /** Areas needing improvement */
  improvements: string[];
  /** Average score across all reps */
  averageScore: number;
  /** Total reps analyzed */
  totalReps: number;
}

// Re-export for convenience
export type { FormCriteria, AngleRange };
