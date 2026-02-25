import type { Feedback, FeedbackStatus } from "../../types/feedback";

/**
 * Repository for user feedback with agent lifecycle tracking.
 */
export interface FeedbackRepository {
  create(
    feedback: Omit<Feedback, "id" | "createdAt" | "updatedAt" | "status">,
  ): Promise<Feedback>;
  getById(id: string): Promise<Feedback | null>;
  getByUser(userId: string): Promise<Feedback[]>;
  getByStatus(status: FeedbackStatus): Promise<Feedback[]>;
  updateStatus(id: string, status: FeedbackStatus): Promise<void>;
  updateAgentFields(
    id: string,
    fields: Partial<
      Pick<
        Feedback,
        "agentTicketId" | "agentPrUrl" | "agentBranch" | "agentNotes"
      >
    >,
  ): Promise<void>;
}
