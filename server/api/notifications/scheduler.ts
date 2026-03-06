/**
 * Notification Scheduler (Cron Endpoint)
 *
 * Called by Vercel Cron every minute. Finds sessions
 * scheduled within the next 5 minutes that haven't been
 * notified yet, and sends notification emails.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { success, error } from "../../lib/response";
import { supabase } from "../../lib/supabase";
import { sendSessionNotification } from "../../lib/notifications/send";

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  /* Verify cron secret to prevent unauthorized triggers */
  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return error(res, "Unauthorized.", 401);
  }

  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    /* Find sessions due for notification */
    const { data: sessions, error: queryError } = await supabase
      .from("sessions")
      .select("id, user_id, slot_number, scheduled_time, session_type")
      .eq("status", "scheduled")
      .gte("scheduled_time", now.toISOString())
      .lte("scheduled_time", fiveMinutesFromNow.toISOString());

    if (queryError) {
      return error(res, `Query failed: ${queryError.message}`, 500);
    }

    if (!sessions || sessions.length === 0) {
      return success(res, { notified: 0 });
    }

    const results = [];

    for (const session of sessions) {
      /* Get user's notification email */
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("notification_email")
        .eq("id", session.user_id)
        .single();

      if (!profile?.notification_email) {
        results.push({
          sessionId: session.id,
          status: "skipped",
          reason: "no email",
        });
        continue;
      }

      /* Get today's covered muscle groups from completed sessions */
      const { data: completedExercises } = await supabase
        .from("session_exercises")
        .select("exercises(muscle_groups)")
        .eq("session_id", session.id);

      const muscleGroups: string[] = [];
      if (completedExercises) {
        for (const entry of completedExercises) {
          const exercises = entry.exercises as unknown;
          if (
            exercises &&
            typeof exercises === "object" &&
            "muscle_groups" in exercises &&
            Array.isArray(
              (exercises as { muscle_groups: string[] }).muscle_groups,
            )
          ) {
            muscleGroups.push(
              ...(exercises as { muscle_groups: string[] }).muscle_groups,
            );
          }
        }
      }

      const uniqueGroups = [...new Set(muscleGroups)];

      const result = await sendSessionNotification(
        session.id,
        profile.notification_email,
        session.slot_number,
        session.scheduled_time,
        session.session_type,
        uniqueGroups,
      );

      results.push({ sessionId: session.id, ...result });
    }

    return success(res, { notified: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scheduler failed.";
    return error(res, message, 500);
  }
}
