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
  it("clips blocks to exclude the startup buffer (12.5% of shift)", () => {
    // 9:00-17:00 = 480 min, buffer = 60 min, schedulable from 10:00
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "09:00", end: "17:00" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(600); // 10:00 (9:00 + 1hr)
    expect(blocks[0]!.end).toBe(1020); // 17:00
  });

  it("removes blocks entirely within the buffer period", () => {
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "09:00", end: "09:30" },
      { start: "11:30", end: "17:00" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(690); // 11:30
  });

  it("clips blocks that partially overlap the buffer", () => {
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "09:30", end: "14:00" },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(600); // 10:00
    expect(blocks[0]!.end).toBe(840); // 14:00
  });

  it("filters out blocks too short for a session", () => {
    const blocks = getSchedulableBlocks(540, 1020, [
      { start: "10:00", end: "10:05" }, // 5 min, too short
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

  it("places all slots after the startup buffer", () => {
    const result = proposeSchedule(standardInput);
    const bufferEnd = timeToMinutes("09:00") + 60;

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
    const times = result.slots.map((s) => timeToMinutes(s.time.split("T")[1]!));

    times.forEach((t) => {
      const inGap = t >= 720 && t < 780;
      expect(inGap).toBe(false);
    });
  });

  it("returns a warning when not enough time for 6 sessions", () => {
    const input: SchedulingInput = {
      ...standardInput,
      workWindowStart: "09:00",
      workWindowEnd: "11:00", // Significantly shorter window to trigger warning
      availabilityBlocks: [{ start: "09:00", end: "11:00" }],
    };

    const result = proposeSchedule(input);
    expect(result.slots.length).toBeLessThan(6);
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

  it("returns empty slots when availability is entirely within the buffer", () => {
    const input: SchedulingInput = {
      ...standardInput,
      // 9-17 shift has a 60min buffer ending at 10:00.
      // Availability ending at 09:50 means zero minutes of schedulable time.
      availabilityBlocks: [{ start: "09:00", end: "09:50" }],
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
    const firstSlot = timeToMinutes(result.slots[0]!.time.split("T")[1]!);
    expect(firstSlot).toBeGreaterThanOrEqual(timeToMinutes("07:00"));
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
  });

  it("rejects a move too close to another slot", () => {
    const result = validateSlotMove(
      1,
      "2026-03-09T16:20:00",
      existingSlots,
      availability,
    );
    expect(result.valid).toBe(false);
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
        time: "2026-03-09T16:00:00",
        sessionType: "mental" as const,
      },
    ];

    const result = validateFullSchedule(slots, availability);
    expect(result.valid).toBe(true);
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
  });
});
