import type { VercelResponse } from "@vercel/node";

export function success(res: VercelResponse, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function error(res: VercelResponse, message: string, status = 400) {
  return res.status(status).json({ success: false, error: message });
}
