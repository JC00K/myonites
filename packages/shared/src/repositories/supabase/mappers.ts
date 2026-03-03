/**
 * Database Row Mappers
 *
 * Converts between Supabase snake_case rows and app camelCase types.
 * Every repository uses these to keep mapping logic in one place.
 */

import type { Exercise } from "../../types/exercise";
import type { Session } from "../../types/session";
import type { MoodEntry } from "../../types/mood";
import type { Feedback } from "../../types/feedback";
import type { DailySchedule, UserProfile } from "../../types/schedule";
import type { RotationEntry } from "../interfaces/RotationRepository";

/* Generic row types matching Supabase column names */

export interface ExerciseRow {
  id: string;
  name: string;
  description: string;
  purpose: string;
  muscle_groups: string[];
  difficulty: string;
  position: string;
  video_url: string;
  video_duration_seconds: number;
  caption_url: string | null;
  event_file_url: string | null;
  form_criteria: unknown;
  common_mistakes: unknown;
  pro_tips: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  schedule_id: string | null;
  slot_number: number;
  session_type: string;
  status: string;
  graded: boolean;
  scheduled_time: string;
  started_at: string | null;
  completed_at: string | null;
  deferred_from: string | null;
  skip_reason: string | null;
  notification_token: string | null;
  notification_sent_at: string | null;
  created_at: string;
}

export interface MoodEntryRow {
  id: string;
  user_id: string;
  session_id: string | null;
  label: string;
  numeric_value: number;
  created_at: string;
}

export interface FeedbackRow {
  id: string;
  user_id: string;
  session_id: string | null;
  category: string;
  content: string;
  status: string;
  agent_ticket_id: string | null;
  agent_pr_url: string | null;
  agent_branch: string | null;
  agent_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfileRow {
  id: string;
  display_name: string;
  work_window_start: string;
  work_window_end: string;
  default_availability: unknown;
  workspace_calibration: unknown;
  notification_channel: string;
  notification_email: string | null;
  notification_phone: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface DailyScheduleRow {
  id: string;
  user_id: string;
  date: string;
  availability_blocks: unknown;
  proposed_times: unknown;
  confirmed_at: string | null;
}

export interface RotationQueueRow {
  id: string;
  user_id: string;
  exercise_id: string;
  status: string;
  last_used_at: string | null;
  times_used_today: number;
}

export interface SessionSequenceRow {
  id: string;
  user_id: string;
  sequence_hash: string;
  used_at: string;
}

/* Row → App type mappers */

export function mapExerciseRow(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    purpose: row.purpose,
    muscleGroups: row.muscle_groups as Exercise["muscleGroups"],
    difficulty: row.difficulty as Exercise["difficulty"],
    position: row.position as Exercise["position"],
    videoUrl: row.video_url,
    videoDurationSeconds: row.video_duration_seconds,
    captionUrl: row.caption_url,
    eventFileUrl: row.event_file_url,
    formCriteria: row.form_criteria as Exercise["formCriteria"],
    commonMistakes: row.common_mistakes as Exercise["commonMistakes"],
    proTips: row.pro_tips,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    scheduleId: row.schedule_id,
    slotNumber: row.slot_number as Session["slotNumber"],
    sessionType: row.session_type as Session["sessionType"],
    status: row.status as Session["status"],
    graded: row.graded,
    scheduledTime: row.scheduled_time,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    deferredFrom: row.deferred_from,
    skipReason: row.skip_reason,
    notificationToken: row.notification_token,
    notificationSentAt: row.notification_sent_at,
    createdAt: row.created_at,
  };
}

export function mapMoodEntryRow(row: MoodEntryRow): MoodEntry {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    label: row.label as MoodEntry["label"],
    numericValue: row.numeric_value as MoodEntry["numericValue"],
    createdAt: row.created_at,
  };
}

export function mapFeedbackRow(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    category: row.category as Feedback["category"],
    content: row.content,
    status: row.status as Feedback["status"],
    agentTicketId: row.agent_ticket_id,
    agentPrUrl: row.agent_pr_url,
    agentBranch: row.agent_branch,
    agentNotes: row.agent_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUserProfileRow(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    workWindowStart: row.work_window_start,
    workWindowEnd: row.work_window_end,
    defaultAvailability:
      row.default_availability as UserProfile["defaultAvailability"],
    workspaceCalibration:
      row.workspace_calibration as UserProfile["workspaceCalibration"],
    notificationChannel:
      row.notification_channel as UserProfile["notificationChannel"],
    notificationEmail: row.notification_email,
    notificationPhone: row.notification_phone,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDailyScheduleRow(row: DailyScheduleRow): DailySchedule {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    availabilityBlocks:
      row.availability_blocks as DailySchedule["availabilityBlocks"],
    proposedTimes: row.proposed_times as DailySchedule["proposedTimes"],
    confirmedAt: row.confirmed_at,
  };
}

export function mapRotationQueueRow(row: RotationQueueRow): RotationEntry {
  return {
    id: row.id,
    userId: row.user_id,
    exerciseId: row.exercise_id,
    status: row.status as RotationEntry["status"],
    lastUsedAt: row.last_used_at,
    timesUsedToday: row.times_used_today,
  };
}
