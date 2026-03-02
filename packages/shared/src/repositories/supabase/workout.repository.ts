/**
 * Supabase Workout Repository
 *
 * Handles workout composition on session confirmation and
 * result recording on completion. Composition is intentionally
 * minimal here — the actual exercise selection logic lives in
 * the engine/workout-composer (Phase 2). This repository handles
 * the database operations only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WorkoutRepository,
  ExerciseResult,
} from "../interfaces/WorkoutRepository";
import type { ComposedWorkout } from "../../types/session";
import { mapSessionRow, mapExerciseRow } from "./mappers";
import type { SessionRow, ExerciseRow } from "./mappers";

export function createWorkoutRepository(
  supabase: SupabaseClient,
): WorkoutRepository {
  async function composeWorkout(sessionId: string): Promise<ComposedWorkout> {
    /* Fetch the session */
    const { data: sessionData, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError)
      throw new Error(`Failed to fetch session: ${sessionError.message}`);

    const session = mapSessionRow(sessionData as SessionRow);

    /* Fetch session exercises with their exercise details */
    const { data: exerciseRows, error: exerciseError } = await supabase
      .from("session_exercises")
      .select("*, exercises(*)")
      .eq("session_id", sessionId)
      .order("order_index");

    if (exerciseError)
      throw new Error(
        `Failed to fetch session exercises: ${exerciseError.message}`,
      );

    const exercises = (exerciseRows ?? []).map(
      (row: Record<string, unknown>) => {
        const exercise = mapExerciseRow(row.exercises as ExerciseRow);
        return {
          exercise,
          orderIndex: row.order_index as number,
          videoUrl: exercise.videoUrl,
          captionUrl: exercise.captionUrl,
          eventFileUrl: exercise.eventFileUrl,
        };
      },
    );

    /* Default meditation config — will be driven by content files in Phase 3 */
    const meditationConfig = {
      durationSeconds: 120,
      breathingPattern: {
        inhaleSeconds: 4,
        holdSeconds: 4,
        exhaleSeconds: 6,
        cycles: 4,
      },
      ambientTrack: "rain",
      reflectionPrompt: null,
    };

    return { session, exercises, meditationConfig };
  }

  async function recordExerciseResult(
    sessionExerciseId: string,
    result: ExerciseResult,
  ): Promise<void> {
    const { error } = await supabase
      .from("session_exercises")
      .update({
        form_score: result.formScore,
        rep_count: result.repCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionExerciseId);

    if (error)
      throw new Error(`Failed to record exercise result: ${error.message}`);
  }

  async function completeSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (error) throw new Error(`Failed to complete session: ${error.message}`);
  }

  return { composeWorkout, recordExerciseResult, completeSession };
}
