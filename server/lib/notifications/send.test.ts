import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("./resend.provider", () => ({
  createResendProvider: () => ({ send: mockSend }),
}));

vi.mock("../tokens", () => ({
  generateToken: vi.fn().mockReturnValue("mock-token-123"),
}));

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

import { sendSessionNotification } from "./send";
import { supabase } from "../supabase";

function setupSupabaseMock(updateError: { message: string } | null = null) {
  const mockEqFn = vi.fn().mockResolvedValue({ error: updateError });
  const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn });
  vi.mocked(supabase.from).mockReturnValue({
    update: mockUpdateFn,
  } as unknown as ReturnType<typeof supabase.from>);
  return { mockUpdateFn, mockEqFn };
}

describe("sendSessionNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockSend.mockResolvedValue({
      success: true,
      messageId: "msg-1",
      error: null,
    });
  });

  it("stores the token on the session", async () => {
    const { mockUpdateFn, mockEqFn } = setupSupabaseMock();

    await sendSessionNotification(
      "session-1",
      "user@test.com",
      3,
      "2026-03-09T14:00:00Z",
      "physical",
      [],
    );

    expect(supabase.from).toHaveBeenCalledWith("sessions");
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_token: "mock-token-123",
        status: "notified",
      }),
    );
    expect(mockEqFn).toHaveBeenCalledWith("id", "session-1");
  });

  it("sends an email with the correct recipient", async () => {
    await sendSessionNotification(
      "session-1",
      "user@test.com",
      3,
      "2026-03-09T14:00:00Z",
      "physical",
      [],
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@test.com" }),
    );
  });

  it("includes subject, html, and text in the email payload", async () => {
    await sendSessionNotification(
      "session-1",
      "user@test.com",
      3,
      "2026-03-09T14:00:00Z",
      "physical",
      ["shoulders"],
    );

    const payload = mockSend.mock.calls[0]![0] as {
      subject: string;
      html: string;
      text: string;
    };
    expect(payload.subject).toBeTruthy();
    expect(payload.html).toContain("Confirm");
    expect(payload.text).toContain("Confirm");
  });

  it("returns failure when session update fails", async () => {
    setupSupabaseMock({ message: "DB error" });

    const result = await sendSessionNotification(
      "session-1",
      "user@test.com",
      3,
      "2026-03-09T14:00:00Z",
      "physical",
      [],
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to update session");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns failure when email send fails", async () => {
    mockSend.mockResolvedValue({
      success: false,
      messageId: null,
      error: "Send failed",
    });

    const result = await sendSessionNotification(
      "session-1",
      "user@test.com",
      3,
      "2026-03-09T14:00:00Z",
      "physical",
      [],
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Send failed");
  });

  it("returns success with messageId on successful send", async () => {
    const result = await sendSessionNotification(
      "session-1",
      "user@test.com",
      3,
      "2026-03-09T14:00:00Z",
      "physical",
      [],
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg-1");
  });
});
