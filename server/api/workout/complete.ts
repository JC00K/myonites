import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { success, error } from "../../lib/response";
import { supabase } from "../../lib/supabase";
import type { MoodEntry } from "@myonites/shared";
import {
  createSessionRepository,
  createMoodRepository,
  createFeedbackRepository,
  createWorkoutRepository,
} from "@myonites/shared";

const exerciseResultSchema = z.object({
  sessionExerciseId: z.string().uuid(),
  formScore: z.number().min(0).max(100).nullable(),
  repCount: z.number().int().nullable(),
  formScores: z.array(
    z.object({
      score: z.number(),
      deviations: z.array(z.any()),
      concessionApplied: z.boolean(),
      timestamp: z.number(),
    }),
  ),
});

const schema = z.object({
  sessionId: z.string().uuid(),
  exerciseResults: z.array(exerciseResultSchema),
  mood: z
    .object({
      label: z.string(),
      numericValue: z.number().int().min(1).max(7),
    })
    .optional(),
  feedback: z
    .object({
      category: z.enum(["exercise", "feature", "bug", "general"]),
      content: z.string().min(1),
    })
    .optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return error(res, "Method not allowed.", 405);
  }

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return error(res, `Invalid request: ${parsed.error.message}`);
  }

  const { sessionId, exerciseResults, mood, feedback } = parsed.data;

  try {
    const sessionRepo = createSessionRepository(supabase);
    const workoutRepo = createWorkoutRepository(supabase);

    const session = await sessionRepo.getById(sessionId);
    if (!session) {
      return error(res, "Session not found.", 404);
    }

    for (const result of exerciseResults) {
      await workoutRepo.recordExerciseResult(result.sessionExerciseId, {
        formScore: result.formScore,
        repCount: result.repCount,
        formScores: result.formScores,
      });
    }

    await workoutRepo.completeSession(sessionId);

    if (mood) {
      const moodRepo = createMoodRepository(supabase);
      await moodRepo.create({
        userId: session.userId,
        sessionId,
        label: mood.label as MoodEntry["label"],
        numericValue: mood.numericValue as MoodEntry["numericValue"],
      });
    }

    if (feedback) {
      const feedbackRepo = createFeedbackRepository(supabase);
      await feedbackRepo.create({
        userId: session.userId,
        sessionId,
        category: feedback.category,
        content: feedback.content,
        agentTicketId: null,
        agentPrUrl: null,
        agentBranch: null,
        agentNotes: null,
      });
    }

    return success(res, { sessionId, status: "completed" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to complete workout.";
    return error(res, message, 500);
  }
}
