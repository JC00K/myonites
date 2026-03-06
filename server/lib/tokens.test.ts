import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase", () => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  return {
    supabase: { from: mockFrom },
    __mocks: { mockFrom, mockSelect, mockEq, mockSingle },
  };
});

import { generateToken, validateToken } from "./tokens";
import { supabase } from "./supabase";

function getMocks() {
  const mod = vi.mocked(supabase);
  const mockFrom = mod.from as ReturnType<typeof vi.fn>;
  const mockSingle = vi.fn();
  const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
  return { mockFrom, mockSelect, mockEq, mockSingle };
}

describe("generateToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateToken();

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it("generates unique tokens on each call", () => {
    const token1 = generateToken();
    const token2 = generateToken();

    expect(token1).not.toBe(token2);
  });
});

describe("validateToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid for a correct token on a notified session", async () => {
    const { mockSingle } = getMocks();
    mockSingle.mockResolvedValue({
      data: {
        notification_token: "valid-token",
        notification_sent_at: new Date().toISOString(),
        status: "notified",
      },
      error: null,
    });

    const result = await validateToken("session-1", "valid-token");

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it("returns invalid when session is not found", async () => {
    const { mockSingle } = getMocks();
    mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const result = await validateToken("nonexistent", "token");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Session not found");
  });

  it("returns invalid when token does not match", async () => {
    const { mockSingle } = getMocks();
    mockSingle.mockResolvedValue({
      data: {
        notification_token: "correct-token",
        notification_sent_at: new Date().toISOString(),
        status: "notified",
      },
      error: null,
    });

    const result = await validateToken("session-1", "wrong-token");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid token");
  });

  it("returns invalid when session is not in notified status", async () => {
    const { mockSingle } = getMocks();
    mockSingle.mockResolvedValue({
      data: {
        notification_token: "valid-token",
        notification_sent_at: new Date().toISOString(),
        status: "confirmed",
      },
      error: null,
    });

    const result = await validateToken("session-1", "valid-token");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("already confirmed");
  });

  it("returns invalid when token has expired", async () => {
    const { mockSingle } = getMocks();
    const elevenMinutesAgo = new Date(
      Date.now() - 11 * 60 * 1000,
    ).toISOString();

    mockSingle.mockResolvedValue({
      data: {
        notification_token: "valid-token",
        notification_sent_at: elevenMinutesAgo,
        status: "notified",
      },
      error: null,
    });

    const result = await validateToken("session-1", "valid-token");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("accepts a token just within the 10-minute window", async () => {
    const { mockSingle } = getMocks();
    const nineMinutesAgo = new Date(Date.now() - 9 * 60 * 1000).toISOString();

    mockSingle.mockResolvedValue({
      data: {
        notification_token: "valid-token",
        notification_sent_at: nineMinutesAgo,
        status: "notified",
      },
      error: null,
    });

    const result = await validateToken("session-1", "valid-token");

    expect(result.valid).toBe(true);
  });
});
