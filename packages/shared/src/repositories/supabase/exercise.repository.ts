/**
 * Supabase Exercise Repository
 *
 * Read-only access to the exercise library. Exercises are seeded
 * by the admin — users never create or modify them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseRepository } from "../interfaces/ExerciseRepository";
import type { Exercise, MuscleGroup, Difficulty } from "../../types/exercise";
import { mapExerciseRow } from "./mappers";
import type { ExerciseRow } from "./mappers";

export function createExerciseRepository(
  supabase: SupabaseClient,
): ExerciseRepository {
  async function getById(id: string): Promise<Exercise | null> {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch exercise: ${error.message}`);
    }

    return mapExerciseRow(data as ExerciseRow);
  }

  async function getAll(): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .order("name");

    if (error) throw new Error(`Failed to fetch exercises: ${error.message}`);

    return (data as ExerciseRow[]).map(mapExerciseRow);
  }

  async function getActive(): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error)
      throw new Error(`Failed to fetch active exercises: ${error.message}`);

    return (data as ExerciseRow[]).map(mapExerciseRow);
  }

  async function getByMuscleGroup(group: MuscleGroup): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .contains("muscle_groups", [group])
      .eq("is_active", true)
      .order("name");

    if (error)
      throw new Error(
        `Failed to fetch exercises by muscle group: ${error.message}`,
      );

    return (data as ExerciseRow[]).map(mapExerciseRow);
  }

  async function getByDifficulty(difficulty: Difficulty): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("difficulty", difficulty)
      .eq("is_active", true)
      .order("name");

    if (error)
      throw new Error(
        `Failed to fetch exercises by difficulty: ${error.message}`,
      );

    return (data as ExerciseRow[]).map(mapExerciseRow);
  }

  return { getById, getAll, getActive, getByMuscleGroup, getByDifficulty };
}
