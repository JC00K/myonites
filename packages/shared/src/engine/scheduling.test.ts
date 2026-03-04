import { describe, it, expect } from "vitest";
import {
  proposeSchedule,
  timeToMinutes,
  minutesToTime,
  getSchedulableBlocks,
} from "./scheduling";
import { validateSlotMove, validateFullSchedule } from "./validateSchedule";
import type { SchedulingInput } from "./scheduling";

/* ─── Helper Utilities ─────────────────────────────────────────────── */

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("17:30")).toBe(1050);
    expect(timeToMinutes("23:59")).toBe(1439);
  });
});

describe("minutesToTime", () => {
  it("converts minutes since midnight to HH:MM", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(1050)).toBe("17:30");
  });
});

/* ─── Schedulable Blocks ───────────────────────────────────────────── */

describe("getSchedulableBlocks", () => {
  it("clips blocks to exclude the 2-hour buffer", () => {
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "09:00", end: "17:00" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(660); // 11:00 (9:00 + 2hrs)
    expect(blocks[0]!.end).toBe(1020); // 17:00
  });

  it("removes blocks entirely within the buffer period", () => {
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "09:00", end: "10:30" },
      { start: "11:30", end: "17:00" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(690); // 11:30
  });

  it("clips blocks that partially overlap the buffer", () => {
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "10:00", end: "14:00" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(660); // 11:00
    expect(blocks[0]!.end).toBe(840); // 14:00
  });

  it("filters out blocks too short for a session", () => {
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "11:00", end: "11:05" }, // 5 min, too short
      { start: "12:00", end: "17:00" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(720); // 12:00
  });
});

/* ─── Schedule Proposal ────────────────────────────────────────────── */

describe("proposeSchedule", () => {
  const standardInput: SchedulingInput = {
    workWindowStart: "09:00",
    workWindowEnd: "17:00",
    availabilityBlocks: [{ start: "09:00", end: "17:00" }],
    date: "2026-03-09",
  };

  it("proposes 6 slots for a standard work day", () => {
    const result = proposeSchedule(standardInput);

    expect(result.slots).toHaveLength(6);
    expect(result.warnings).toHaveLength(0);
  });

  it("assigns slot numbers 1-6 in chronological order", () => {
    const result = proposeSchedule(standardInput);

    result.slots.forEach((slot, index) => {
      expect(slot.slotNumber).toBe(index + 1);
    });
  });

  it("places the mental session as the last slot", () => {
    const result = proposeSchedule(standardInput);

    const lastSlot = result.slots[result.slots.length - 1]!;
    expect(lastSlot.sessionType).toBe("mental");
  });

  it("marks all non-final slots as physical", () => {
    const result = proposeSchedule(standardInput);

    const physicalSlots = result.slots.filter(
      (s) => s.sessionType === "physical",
    );
    expect(physicalSlots).toHaveLength(5);
  });

  it("places mental session 30-45 minutes before shift end", () => {
    const result = proposeSchedule(standardInput);
    const mentalSlot = result.slots.find((s) => s.sessionType === "mental")!;
    const mentalTime = timeToMinutes(mentalSlot.time.split("T")[1]!);
    const workEnd = timeToMinutes("17:00");

    const minutesBefore = workEnd - mentalTime;
    expect(minutesBefore).toBeGreaterThanOrEqual(30);
    expect(minutesBefore).toBeLessThanOrEqual(45);
  });

  it("maintains at least 20-minute gaps between all slots", () => {
    const result = proposeSchedule(standardInput);
    const times = result.slots.map((s) => timeToMinutes(s.time.split("T")[1]!));

    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(20);
    }
  });

  it("places all slots after the 2-hour buffer", () => {
    const result = proposeSchedule(standardInput);
    const bufferEnd = timeToMinutes("09:00") + 120; // 11:00

    result.slots.forEach((slot) => {
      const slotMinutes = timeToMinutes(slot.time.split("T")[1]!);
      expect(slotMinutes).toBeGreaterThanOrEqual(bufferEnd);
    });
  });

  it("handles a gap in availability (meeting)", () => {
    const input: SchedulingInput = {
      ...standardInput,
      availabilityBlocks: [
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ],
    };

    const result = proposeSchedule(input);

    expect(result.slots.length).toBeGreaterThanOrEqual(1);

    const times = result.slots.map((s) => timeToMinutes(s.time.split("T")[1]!));

    /* No slot should fall in the 12:00-13:00 gap */
    times.forEach((t) => {
      const inGap = t >= 720 && t < 780;
      expect(inGap).toBe(false);
    });
  });

  it("returns a warning when not enough time for 6 sessions", () => {
    const input: SchedulingInput = {
      ...standardInput,
      workWindowStart: "09:00",
      workWindowEnd: "12:30",
      availabilityBlocks: [{ start: "09:00", end: "12:30" }],
    };

    const result = proposeSchedule(input);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("sessions");
  });

  it("returns empty slots when work window is invalid", () => {
    const input: SchedulingInput = {
      ...standardInput,
      workWindowStart: "17:00",
      workWindowEnd: "09:00",
    };

    const result = proposeSchedule(input);
    expect(result.slots).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it("returns empty slots when no availability after buffer", () => {
    const input: SchedulingInput = {
      ...standardInput,
      availabilityBlocks: [{ start: "09:00", end: "10:30" }],
    };

    const result = proposeSchedule(input);
    expect(result.slots).toHaveLength(0);
  });

  it("handles early shift (6:00-14:00)", () => {
    const input: SchedulingInput = {
      ...standardInput,
      workWindowStart: "06:00",
      workWindowEnd: "14:00",
      availabilityBlocks: [{ start: "06:00", end: "14:00" }],
    };

    const result = proposeSchedule(input);

    expect(result.slots.length).toBeGreaterThanOrEqual(1);

    const firstSlot = timeToMinutes(result.slots[0]!.time.split("T")[1]!);
    expect(firstSlot).toBeGreaterThanOrEqual(timeToMinutes("08:00"));
  });

  it("handles late shift (14:00-22:00)", () => {
    const input: SchedulingInput = {
      ...standardInput,
      workWindowStart: "14:00",
      workWindowEnd: "22:00",
      availabilityBlocks: [{ start: "14:00", end: "22:00" }],
    };

    const result = proposeSchedule(input);

    expect(result.slots.length).toBeGreaterThanOrEqual(1);

    const firstSlot = timeToMinutes(result.slots[0]!.time.split("T")[1]!);
    expect(firstSlot).toBeGreaterThanOrEqual(timeToMinutes("16:00"));
  });

  it("generates ISO timestamps with correct date", () => {
    const result = proposeSchedule(standardInput);

    result.slots.forEach((slot) => {
      expect(slot.time).toMatch(/^2026-03-09T\d{2}:\d{2}:00$/);
    });
  });
});

/* ─── Slot Move Validation ─────────────────────────────────────────── */

describe("validateSlotMove", () => {
  const availability = [
    { start: "11:00", end: "12:00" },
    { start: "13:00", end: "17:00" },
  ];

  const existingSlots = [
    {
      slotNumber: 1 as const,
      time: "2026-03-09T11:30:00",
      sessionType: "physical" as const,
    },
    {
      slotNumber: 2 as const,
      time: "2026-03-09T13:30:00",
      sessionType: "physical" as const,
    },
    {
      slotNumber: 3 as const,
      time: "2026-03-09T14:30:00",
      sessionType: "physical" as const,
    },
    {
      slotNumber: 4 as const,
      time: "2026-03-09T15:15:00",
      sessionType: "physical" as const,
    },
    {
      slotNumber: 5 as const,
      time: "2026-03-09T16:00:00",
      sessionType: "physical" as const,
    },
    {
      slotNumber: 6 as const,
      time: "2026-03-09T16:30:00",
      sessionType: "mental" as const,
    },
  ];

  it("allows a valid move within availability", () => {
    const result = validateSlotMove(
      1,
      "2026-03-09T11:00:00",
      existingSlots,
      availability,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a move outside availability blocks", () => {
    const result = validateSlotMove(
      1,
      "2026-03-09T12:30:00",
      existingSlots,
      availability,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("available time blocks");
  });

  it("rejects a move too close to another slot", () => {
    const result = validateSlotMove(
      1,
      "2026-03-09T13:20:00",
      existingSlots,
      availability,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("20 minutes");
  });

  it("allows a move exactly 20 minutes from another slot", () => {
    const result = validateSlotMove(
      1,
      "2026-03-09T13:10:00",
      existingSlots,
      availability,
    );
    expect(result.valid).toBe(true);
  });
});

/* ─── Full Schedule Validation ─────────────────────────────────────── */

describe("validateFullSchedule", () => {
  const availability = [{ start: "11:00", end: "17:00" }];

  it("validates a properly spaced schedule", () => {
    const slots = [
      {
        slotNumber: 1 as const,
        time: "2026-03-09T11:00:00",
        sessionType: "physical" as const,
      },
      {
        slotNumber: 2 as const,
        time: "2026-03-09T12:00:00",
        sessionType: "physical" as const,
      },
      {
        slotNumber: 3 as const,
        time: "2026-03-09T13:00:00",
        sessionType: "physical" as const,
      },
      {
        slotNumber: 4 as const,
        time: "2026-03-09T14:00:00",
        sessionType: "physical" as const,
      },
      {
        slotNumber: 5 as const,
        time: "2026-03-09T15:00:00",
        sessionType: "physical" as const,
      },
      {
        slotNumber: 6 as const,
        time: "2026-03-09T16:00:00",
        sessionType: "mental" as const,
      },
    ];

    const result = validateFullSchedule(slots, availability);
    expect(result.valid).toBe(true);
  });

  it("rejects slots outside availability", () => {
    const slots = [
      {
        slotNumber: 1 as const,
        time: "2026-03-09T10:00:00",
        sessionType: "physical" as const,
      },
      {
        slotNumber: 2 as const,
        time: "2026-03-09T12:00:00",
        sessionType: "physical" as const,
      },
    ];

    const result = validateFullSchedule(slots, availability);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("outside");
  });

  it("rejects slots too close together", () => {
    const slots = [
      {
        slotNumber: 1 as const,
        time: "2026-03-09T11:00:00",
        sessionType: "physical" as const,
      },
      {
        slotNumber: 2 as const,
        time: "2026-03-09T11:10:00",
        sessionType: "physical" as const,
      },
    ];

    const result = validateFullSchedule(slots, availability);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("20 minutes");
  });
});
