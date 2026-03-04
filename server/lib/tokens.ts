import { randomBytes } from "crypto";
import { supabase } from "./supabase";

const TOKEN_EXPIRY_MINUTES = 10;

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function validateToken(
  sessionId: string,
  token: string,
): Promise<{ valid: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("sessions")
    .select("notification_token, notification_sent_at, status")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    return { valid: false, error: "Session not found." };
  }

  if (data.notification_token !== token) {
    return { valid: false, error: "Invalid token." };
  }

  if (data.status !== "notified") {
    return { valid: false, error: `Session is already ${data.status}.` };
  }

  const sentAt = new Date(data.notification_sent_at).getTime();
  const expiresAt = sentAt + TOKEN_EXPIRY_MINUTES * 60 * 1000;

  if (Date.now() > expiresAt) {
    return { valid: false, error: "Token has expired." };
  }

  return { valid: true, error: null };
}
