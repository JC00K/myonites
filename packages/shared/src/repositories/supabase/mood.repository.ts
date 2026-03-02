/**
 * Supabase Mood Repository
 *
 * Stores and queries mood check-in entries.
 * Supports date range queries and average calculations for the dashboard.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MoodRepository } from "../interfaces/MoodRepository";
import type { MoodEntry } from "../../types/mood";
import { mapMoodEntryRow } from "./mappers";
import type { MoodEntryRow } from "./mappers";

export function createMoodRepository(supabase: SupabaseClient): MoodRepository {
  async function create(
    entry: Omit<MoodEntry, "id" | "createdAt">,
  ): Promise<MoodEntry> {
    const { data, error } = await supabase
      .from("mood_entries")
      .insert({
        user_id: entry.userId,
        session_id: entry.sessionId,
        label: entry.label,
        numeric_value: entry.numericValue,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create mood entry: ${error.message}`);

    return mapMoodEntryRow(data as MoodEntryRow);
  }

  async function getBySession(sessionId: string): Promise<MoodEntry | null> {
    const { data, error } = await supabase
      .from("mood_entries")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch mood entry: ${error.message}`);
    }

    return mapMoodEntryRow(data as MoodEntryRow);
  }

  async function getByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<MoodEntry[]> {
    const { data, error } = await supabase
      .from("mood_entries")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at");

    if (error)
      throw new Error(`Failed to fetch mood entries: ${error.message}`);

    return (data as MoodEntryRow[]).map(mapMoodEntryRow);
  }

  async function getAverageByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const entries = await getByDateRange(userId, startDate, endDate);

    if (entries.length === 0) return 0;

    const sum = entries.reduce((acc, entry) => acc + entry.numericValue, 0);
    return Math.round((sum / entries.length) * 10) / 10;
  }

  return { create, getBySession, getByDateRange, getAverageByDateRange };
}
