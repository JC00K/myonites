import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { validateToken } from "../../lib/tokens";
import { success, error } from "../../lib/response";
import { supabase } from "../../lib/supabase";
import { createSessionRepository } from "@myonites/shared";

const schema = z.object({
  sessionId: z.string().uuid(),
  token: z.string().min(1),
  reason: z.string().optional(),
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

  const { sessionId, token, reason } = parsed.data;

  const tokenResult = await validateToken(sessionId, token);
  if (!tokenResult.valid) {
    return error(res, tokenResult.error ?? "Invalid token.", 403);
  }

  try {
    const sessionRepo = createSessionRepository(supabase);

    await sessionRepo.updateStatus(sessionId, "skipped");

    if (reason) {
      await supabase
        .from("sessions")
        .update({ skip_reason: reason })
        .eq("id", sessionId);
    }

    /* Invalidate the token */
    await supabase
      .from("sessions")
      .update({ notification_token: null })
      .eq("id", sessionId);

    return success(res, { sessionId, status: "skipped" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to skip session.";
    return error(res, message, 500);
  }
}
