/**
 * Supabase Session Repository
 *
 * CRUD for workout sessions. Handles status transitions
 * and today's session queries with timezone-aware date filtering.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionRepository } from "../interfaces/SessionRepository";
import type { Session, SessionStatus } from "../../types/session";
import { mapSessionRow } from "./mappers";
import type { SessionRow } from "./mappers";

export function createSessionRepository(
  supabase: SupabaseClient,
): SessionRepository {
  async function getById(id: string): Promise<Session | null> {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    return mapSessionRow(data as SessionRow);
  }

  async function getBySchedule(scheduleId: string): Promise<Session[]> {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("schedule_id", scheduleId)
      .order("slot_number");

    if (error)
      throw new Error(`Failed to fetch sessions by schedule: ${error.message}`);

    return (data as SessionRow[]).map(mapSessionRow);
  }

  async function getTodaySessions(userId: string): Promise<Session[]> {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).toISOString();
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    ).toISOString();

    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("scheduled_time", startOfDay)
      .lt("scheduled_time", endOfDay)
      .order("slot_number");

    if (error)
      throw new Error(`Failed to fetch today's sessions: ${error.message}`);

    return (data as SessionRow[]).map(mapSessionRow);
  }

  async function updateStatus(
    id: string,
    status: SessionStatus,
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };

    /* Auto-set timestamps for key status transitions */
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from("sessions")
      .update(updates)
      .eq("id", id);

    if (error)
      throw new Error(`Failed to update session status: ${error.message}`);
  }

  async function create(
    session: Omit<Session, "id" | "createdAt">,
  ): Promise<Session> {
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: session.userId,
        schedule_id: session.scheduleId,
        slot_number: session.slotNumber,
        session_type: session.sessionType,
        status: session.status,
        graded: session.graded,
        scheduled_time: session.scheduledTime,
        started_at: session.startedAt,
        completed_at: session.completedAt,
        deferred_from: session.deferredFrom,
        skip_reason: session.skipReason,
        notification_token: session.notificationToken,
        notification_sent_at: session.notificationSentAt,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create session: ${error.message}`);

    return mapSessionRow(data as SessionRow);
  }

  return { getById, getBySchedule, getTodaySessions, updateStatus, create };
}
