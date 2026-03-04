import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { validateToken } from "../../lib/tokens";
import { success, error } from "../../lib/response";
import { supabase } from "../../lib/supabase";
import { composeWorkout } from "@myonites/shared/src/engine/workout-composer";
import {
  createExerciseRepository,
  createSessionRepository,
  createRotationRepository,
} from "@myonites/shared";

const schema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(1),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return error(res, "Method not allowed.", 405);
  }

  const params = req.method === "GET" ? req.query : req.body;
  const parsed = schema.safeParse(params);

  if (!parsed.success) {
    return error(res, "Invalid request. Requires sessionId and token.");
  }

  const { sessionId, token } = parsed.data;

  const tokenResult = await validateToken(sessionId, token);
  if (!tokenResult.valid) {
    return error(res, tokenResult.error ?? "Invalid token.", 403);
  }

  try {
    const exerciseRepo = createExerciseRepository(supabase);
    const sessionRepo = createSessionRepository(supabase);
    const rotationRepo = createRotationRepository(supabase);

    const session = await sessionRepo.getById(sessionId);
    if (!session) {
      return error(res, "Session not found.", 404);
    }

    await sessionRepo.updateStatus(sessionId, "confirmed");

    const { workout, sequenceHash } = await composeWorkout(session, {
      exerciseRepo,
      sessionRepo,
      rotationRepo,
    });

    await rotationRepo.recordSequence(session.userId, sequenceHash);

    for (const exercise of workout.exercises) {
      await rotationRepo.markUsed(session.userId, exercise.exercise.id);
    }

    /* Write session_exercises rows */
    for (const exercise of workout.exercises) {
      await supabase.from("session_exercises").insert({
        session_id: sessionId,
        exercise_id: exercise.exercise.id,
        order_index: exercise.orderIndex,
      });
    }

    /* Invalidate the token by clearing it */
    await supabase
      .from("sessions")
      .update({ notification_token: null })
      .eq("id", sessionId);

    return success(res, { workout });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to compose workout.";
    return error(res, message, 500);
  }
}
