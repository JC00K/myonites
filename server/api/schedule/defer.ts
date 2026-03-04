import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { success, error } from "../../lib/response";
import { supabase } from "../../lib/supabase";
import { createSessionRepository } from "@myonites/shared";

const schema = z.object({
  sessionId: z.string().uuid(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return error(res, "Method not allowed.", 405);
  }

  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return error(res, "Invalid request. Requires sessionId.");
  }

  const { sessionId } = parsed.data;

  try {
    const sessionRepo = createSessionRepository(supabase);
    const session = await sessionRepo.getById(sessionId);

    if (!session) {
      return error(res, "Session not found.", 404);
    }

    if (session.status !== "notified") {
      return error(res, `Cannot defer session with status: ${session.status}.`);
    }

    await supabase
      .from("sessions")
      .update({
        status: "deferred",
        deferred_from: session.scheduledTime,
        notification_token: null,
      })
      .eq("id", sessionId);

    return success(res, { sessionId, status: "deferred" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to defer session.";
    return error(res, message, 500);
  }
}
