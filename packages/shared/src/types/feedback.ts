/**
 * User feedback submitted after workouts.
 * Maps to the `feedback` table.
 * Includes agent pipeline lifecycle fields.
 */
export interface Feedback {
  id: string;
  userId: string;
  sessionId: string | null;
  category: FeedbackCategory;
  content: string;
  status: FeedbackStatus;
  agentTicketId: string | null;
  agentPrUrl: string | null;
  agentBranch: string | null;
  agentNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackCategory = 'exercise' | 'feature' | 'bug' | 'general';

/**
 * Feedback lifecycle:
 *   new → categorized → approved → in_progress → pr_created → merged
 *   At any point: → dismissed (you close) or → rejected (PR fails)
 */
export type FeedbackStatus =
  | 'new'
  | 'categorized'
  | 'approved'
  | 'in_progress'
  | 'pr_created'
  | 'merged'
  | 'dismissed'
  | 'rejected';
