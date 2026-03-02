/**
 * Supabase Feedback Repository
 *
 * User feedback with agent pipeline lifecycle tracking.
 * Status transitions and agent field updates are separate
 * operations since they're triggered by different systems.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackRepository } from "../interfaces/FeedbackRepository";
import type { Feedback, FeedbackStatus } from "../../types/feedback";
import { mapFeedbackRow } from "./mappers";
import type { FeedbackRow } from "./mappers";

export function createFeedbackRepository(
  supabase: SupabaseClient,
): FeedbackRepository {
  async function create(
    feedback: Omit<Feedback, "id" | "createdAt" | "updatedAt" | "status">,
  ): Promise<Feedback> {
    const { data, error } = await supabase
      .from("feedback")
      .insert({
        user_id: feedback.userId,
        session_id: feedback.sessionId,
        category: feedback.category,
        content: feedback.content,
        agent_ticket_id: feedback.agentTicketId,
        agent_pr_url: feedback.agentPrUrl,
        agent_branch: feedback.agentBranch,
        agent_notes: feedback.agentNotes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create feedback: ${error.message}`);

    return mapFeedbackRow(data as FeedbackRow);
  }

  async function getById(id: string): Promise<Feedback | null> {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch feedback: ${error.message}`);
    }

    return mapFeedbackRow(data as FeedbackRow);
  }

  async function getByUser(userId: string): Promise<Feedback[]> {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error)
      throw new Error(`Failed to fetch user feedback: ${error.message}`);

    return (data as FeedbackRow[]).map(mapFeedbackRow);
  }

  async function getByStatus(status: FeedbackStatus): Promise<Feedback[]> {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("status", status)
      .order("created_at");

    if (error)
      throw new Error(`Failed to fetch feedback by status: ${error.message}`);

    return (data as FeedbackRow[]).map(mapFeedbackRow);
  }

  async function updateStatus(
    id: string,
    status: FeedbackStatus,
  ): Promise<void> {
    const { error } = await supabase
      .from("feedback")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error)
      throw new Error(`Failed to update feedback status: ${error.message}`);
  }

  async function updateAgentFields(
    id: string,
    fields: Partial<
      Pick<
        Feedback,
        "agentTicketId" | "agentPrUrl" | "agentBranch" | "agentNotes"
      >
    >,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (fields.agentTicketId !== undefined)
      updates.agent_ticket_id = fields.agentTicketId;
    if (fields.agentPrUrl !== undefined)
      updates.agent_pr_url = fields.agentPrUrl;
    if (fields.agentBranch !== undefined)
      updates.agent_branch = fields.agentBranch;
    if (fields.agentNotes !== undefined)
      updates.agent_notes = fields.agentNotes;

    const { error } = await supabase
      .from("feedback")
      .update(updates)
      .eq("id", id);

    if (error)
      throw new Error(`Failed to update agent fields: ${error.message}`);
  }

  return {
    create,
    getById,
    getByUser,
    getByStatus,
    updateStatus,
    updateAgentFields,
  };
}
