/**
 * Supabase Rotation Repository
 *
 * Manages the exercise rotation queue to ensure full library
 * rotation before repeats. Tracks daily usage caps and
 * sequence uniqueness within a 7-day window.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RotationRepository,
  RotationEntry,
} from "../interfaces/RotationRepository";
import { mapRotationQueueRow } from "./mappers";
import type { RotationQueueRow } from "./mappers";

export function createRotationRepository(
  supabase: SupabaseClient,
): RotationRepository {
  async function getAvailable(userId: string): Promise<RotationEntry[]> {
    const { data, error } = await supabase
      .from("rotation_queue")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "available")
      .order("last_used_at", { ascending: true, nullsFirst: true });

    if (error)
      throw new Error(`Failed to fetch available exercises: ${error.message}`);

    return (data as RotationQueueRow[]).map(mapRotationQueueRow);
  }

  async function markUsed(userId: string, exerciseId: string): Promise<void> {
    /* Fetch current count, then increment */
    const { data: current, error: fetchError } = await supabase
      .from("rotation_queue")
      .select("times_used_today")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Failed to fetch rotation entry: ${fetchError.message}`);
    }

    const newCount = ((current?.times_used_today as number) ?? 0) + 1;

    const { error } = await supabase
      .from("rotation_queue")
      .update({
        status: "seen",
        last_used_at: new Date().toISOString(),
        times_used_today: newCount,
      })
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId);

    if (error)
      throw new Error(`Failed to mark exercise as used: ${error.message}`);
  }

  async function resetQueue(userId: string): Promise<void> {
    const { error } = await supabase
      .from("rotation_queue")
      .update({ status: "available", times_used_today: 0 })
      .eq("user_id", userId);

    if (error)
      throw new Error(`Failed to reset rotation queue: ${error.message}`);
  }

  async function getTodayUsageCount(
    userId: string,
    exerciseId: string,
  ): Promise<number> {
    const { data, error } = await supabase
      .from("rotation_queue")
      .select("times_used_today")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return 0;
      throw new Error(`Failed to fetch usage count: ${error.message}`);
    }

    return data?.times_used_today ?? 0;
  }

  async function isSequenceUnique(
    userId: string,
    sequenceHash: string,
  ): Promise<boolean> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from("session_sequences")
      .select("id")
      .eq("user_id", userId)
      .eq("sequence_hash", sequenceHash)
      .gte("used_at", sevenDaysAgo.toISOString())
      .limit(1);

    if (error)
      throw new Error(`Failed to check sequence uniqueness: ${error.message}`);

    return data.length === 0;
  }

  async function recordSequence(
    userId: string,
    sequenceHash: string,
  ): Promise<void> {
    const { error } = await supabase.from("session_sequences").insert({
      user_id: userId,
      sequence_hash: sequenceHash,
    });

    if (error) throw new Error(`Failed to record sequence: ${error.message}`);
  }

  return {
    getAvailable,
    markUsed,
    resetQueue,
    getTodayUsageCount,
    isSequenceUnique,
    recordSequence,
  };
}
