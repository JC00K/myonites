import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmailsSend = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

import { createResendProvider } from "./resend.provider";

describe("ResendProvider", () => {
  const provider = createResendProvider();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email and returns success with messageId", async () => {
    mockEmailsSend.mockResolvedValue({
      data: { id: "msg-123" },
      error: null,
    });

    const result = await provider.send({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg-123");
    expect(result.error).toBeNull();
  });

  it("passes the correct payload to Resend", async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: "msg-1" }, error: null });

    await provider.send({
      to: "user@test.com",
      subject: "Test Subject",
      html: "<p>Body</p>",
      text: "Body",
    });

    expect(mockEmailsSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Test Subject",
        html: "<p>Body</p>",
        text: "Body",
      }),
    );
  });

  it("returns failure when Resend returns an error", async () => {
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: "Invalid API key" },
    });

    const result = await provider.send({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.messageId).toBeNull();
    expect(result.error).toBe("Invalid API key");
  });

  it("returns failure when Resend throws an exception", async () => {
    mockEmailsSend.mockRejectedValue(new Error("Network timeout"));

    const result = await provider.send({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(false);
    expect(result.messageId).toBeNull();
    expect(result.error).toBe("Network timeout");
  });

  it("handles missing data gracefully", async () => {
    mockEmailsSend.mockResolvedValue({ data: null, error: null });

    const result = await provider.send({
      to: "user@test.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeNull();
  });
});
