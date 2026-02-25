/**
 * Represents a single exercise in the Myonites library.
 * Maps to the `exercises` table in Supabase.
 */
export interface Exercise {
  id: string;
  name: string;
  description: string;
  purpose: string;
  muscleGroups: MuscleGroup[];
  difficulty: Difficulty;
  position: ExercisePosition;
  videoUrl: string;
  videoDurationSeconds: number;
  captionUrl: string | null;
  eventFileUrl: string | null;
  formCriteria: FormCriteria;
  commonMistakes: CommonMistake[] | null;
  proTips: string[] | null;
  isActive: boolean;
  createdAt: string;
}

export type Difficulty = 'easy' | 'moderate' | 'challenging';

export type ExercisePosition = 'seated' | 'standing';

export type MuscleGroup =
  | 'neck'
  | 'shoulders'
  | 'upper_back'
  | 'lower_back'
  | 'chest'
  | 'arms'
  | 'core'
  | 'hips'
  | 'legs'
  | 'wrists';

export interface CommonMistake {
  description: string;
  correction: string;
}

export interface FormCriteria {
  /** Joint angle ranges that define correct form for this exercise */
  angleRanges: AngleRange[];
  /** How many reps expected per set */
  expectedReps: number;
  /** Percentage threshold below which form is flagged (0-100) */
  minimumScore: number;
}

export interface AngleRange {
  /** Which joint this measurement applies to (e.g., "left_elbow") */
  joint: string;
  /** Minimum acceptable angle in degrees */
  min: number;
  /** Maximum acceptable angle in degrees */
  max: number;
  /** Weight of this angle in overall scoring (0-1, all weights sum to 1) */
  weight: number;
}
