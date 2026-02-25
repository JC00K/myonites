import type { ComposedWorkout } from "../../types/session";
import type { FormScore } from "../../types/form";

/**
 * Repository for workout lifecycle operations.
 * Compose on confirm, record results on complete.
 */
export interface WorkoutRepository {
  /** Generate a workout when user confirms a session */
  composeWorkout(sessionId: string): Promise<ComposedWorkout>;

  /** Record exercise results after workout completes */
  recordExerciseResult(
    sessionExerciseId: string,
    result: ExerciseResult,
  ): Promise<void>;

  /** Finalize a completed session */
  completeSession(sessionId: string): Promise<void>;
}

export interface ExerciseResult {
  formScore: number | null;
  repCount: number | null;
  formScores: FormScore[];
}
