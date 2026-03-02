/**
 * Supabase Schedule Repository
 *
 * User profile management and daily schedule operations.
 * Profile updates trigger updated_at automatically.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleRepository } from "../interfaces/ScheduleRepository";
import type { DailySchedule, UserProfile } from "../../types/schedule";
import { mapUserProfileRow, mapDailyScheduleRow } from "./mappers";
import type { UserProfileRow, DailyScheduleRow } from "./mappers";

export function createScheduleRepository(
  supabase: SupabaseClient,
): ScheduleRepository {
  async function getProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch profile: ${error.message}`);
    }

    return mapUserProfileRow(data as UserProfileRow);
  }

  async function updateProfile(
    userId: string,
    updates: Partial<Omit<UserProfile, "id" | "createdAt" | "updatedAt">>,
  ): Promise<UserProfile> {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.displayName !== undefined)
      row.display_name = updates.displayName;
    if (updates.workWindowStart !== undefined)
      row.work_window_start = updates.workWindowStart;
    if (updates.workWindowEnd !== undefined)
      row.work_window_end = updates.workWindowEnd;
    if (updates.defaultAvailability !== undefined)
      row.default_availability = updates.defaultAvailability;
    if (updates.workspaceCalibration !== undefined)
      row.workspace_calibration = updates.workspaceCalibration;
    if (updates.notificationChannel !== undefined)
      row.notification_channel = updates.notificationChannel;
    if (updates.notificationEmail !== undefined)
      row.notification_email = updates.notificationEmail;
    if (updates.notificationPhone !== undefined)
      row.notification_phone = updates.notificationPhone;
    if (updates.timezone !== undefined) row.timezone = updates.timezone;

    const { data, error } = await supabase
      .from("user_profiles")
      .update(row)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update profile: ${error.message}`);

    return mapUserProfileRow(data as UserProfileRow);
  }

  async function getSchedule(
    userId: string,
    date: string,
  ): Promise<DailySchedule | null> {
    const { data, error } = await supabase
      .from("daily_schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch schedule: ${error.message}`);
    }

    return mapDailyScheduleRow(data as DailyScheduleRow);
  }

  async function createSchedule(
    schedule: Omit<DailySchedule, "id" | "confirmedAt">,
  ): Promise<DailySchedule> {
    const { data, error } = await supabase
      .from("daily_schedules")
      .insert({
        user_id: schedule.userId,
        date: schedule.date,
        availability_blocks: schedule.availabilityBlocks,
        proposed_times: schedule.proposedTimes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create schedule: ${error.message}`);

    return mapDailyScheduleRow(data as DailyScheduleRow);
  }

  async function confirmSchedule(scheduleId: string): Promise<void> {
    const { error } = await supabase
      .from("daily_schedules")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("id", scheduleId);

    if (error) throw new Error(`Failed to confirm schedule: ${error.message}`);
  }

  return {
    getProfile,
    updateProfile,
    getSchedule,
    createSchedule,
    confirmSchedule,
  };
}
