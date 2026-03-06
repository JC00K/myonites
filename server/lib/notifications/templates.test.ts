import { describe, it, expect } from "vitest";
import {
  workoutNotificationEmail,
  buildConfirmUrl,
  buildSkipUrl,
} from "./templates";
import type { NotificationData } from "./types";

describe("buildConfirmUrl", () => {
  it("constructs a URL with sessionId and token", () => {
    const url = buildConfirmUrl("session-123", "token-abc");

    expect(url).toContain("sessionId=session-123");
    expect(url).toContain("token=token-abc");
    expect(url).toContain("/api/schedule/confirm");
  });
});

describe("buildSkipUrl", () => {
  it("constructs a URL with sessionId and token", () => {
    const url = buildSkipUrl("session-123", "token-abc");

    expect(url).toContain("sessionId=session-123");
    expect(url).toContain("token=token-abc");
    expect(url).toContain("/api/schedule/skip");
  });
});

describe("workoutNotificationEmail", () => {
  const baseData: NotificationData = {
    sessionId: "session-1",
    token: "token-abc",
    slotNumber: 3,
    scheduledTime: "2026-03-09T14:05:00Z",
    sessionType: "physical",
    muscleGroupsCovered: ["shoulders", "neck"],
  };

  it("includes the slot number in the subject", () => {
    const { subject } = workoutNotificationEmail(baseData);

    expect(subject).toContain("Workout 3/6");
  });

  it("uses Mental Wellness label for mental sessions", () => {
    const data: NotificationData = { ...baseData, sessionType: "mental" };
    const { subject } = workoutNotificationEmail(data);

    expect(subject).toContain("Mental Wellness");
    expect(subject).not.toContain("Workout");
  });

  it("includes confirm and skip URLs in the HTML", () => {
    const { html } = workoutNotificationEmail(baseData);

    expect(html).toContain("/api/schedule/confirm");
    expect(html).toContain("/api/schedule/skip");
    expect(html).toContain("session-1");
    expect(html).toContain("token-abc");
  });

  it("includes confirm and skip URLs in the plain text", () => {
    const { text } = workoutNotificationEmail(baseData);

    expect(text).toContain("/api/schedule/confirm");
    expect(text).toContain("/api/schedule/skip");
  });

  it("lists covered muscle groups", () => {
    const { html, text } = workoutNotificationEmail(baseData);

    expect(html).toContain("shoulders");
    expect(html).toContain("neck");
    expect(text).toContain("shoulders");
  });

  it("shows first workout message when no groups covered", () => {
    const data: NotificationData = { ...baseData, muscleGroupsCovered: [] };
    const { html, text } = workoutNotificationEmail(data);

    expect(html).toContain("First workout of the day");
    expect(text).toContain("First workout of the day");
  });

  it("includes expiry and defer notice", () => {
    const { html } = workoutNotificationEmail(baseData);

    expect(html).toContain("1 minute");
    expect(html).toContain("10 minutes");
  });
});
