/**
 * Scheduling Engine
 *
 * Distributes 6 workout slots across a user's available time.
 * Pure function — no database or platform dependencies.
 *
 * Rules:
 *   - First 2 hours of work window are workout-free
 *   - Slot 6 (mental) placed 30-45 min before shift end
 *   - Slots 1-5 distributed evenly across remaining time
 *   - Minimum 20 minutes between any two slots
 *   - If insufficient time, reports how many slots can fit
 */

import type { AvailabilityBlock, ProposedSlot } from "../types/schedule";
import type { SessionType } from "../types/session";

export interface ScheduleProposal {
  slots: ProposedSlot[];
  warnings: string[];
}

export interface SchedulingInput {
  workWindowStart: string;
  workWindowEnd: string;
  availabilityBlocks: AvailabilityBlock[];
  date: string;
}

const TOTAL_SLOTS = 6;
const BUFFER_RATIO = 0.125;
const MIN_GAP_MINUTES = 20;
const SESSION_DURATION_MINUTES = 7;
const MENTAL_SLOT_BUFFER_MIN = 30;
const MENTAL_SLOT_BUFFER_MAX = 45;

/** Convert "HH:MM" to minutes since midnight */
export function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/** Convert minutes since midnight to "HH:MM" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Convert minutes since midnight + date/timezone to ISO timestamp */
function minutesToISO(minutes: number, date: string): string {
  const time = minutesToTime(minutes);
  return `${date}T${time}:00`;
}

/**
 * Clip availability blocks to only include time after the 2-hour buffer
 * and within the work window. Returns blocks in minutes since midnight.
 */
export function getSchedulableBlocks(
  workStart: number,
  workEnd: number,
  blocks: AvailabilityBlock[],
): { start: number; end: number }[] {
  const shiftLength = workEnd - workStart;
  const bufferMinutes = Math.round(shiftLength * BUFFER_RATIO);
  const bufferEnd = workStart + bufferMinutes;

  return blocks
    .map((block) => {
      const start = Math.max(timeToMinutes(block.start), bufferEnd);
      const end = Math.min(timeToMinutes(block.end), workEnd);
      return { start, end };
    })
    .filter((block) => block.end - block.start >= SESSION_DURATION_MINUTES)
    .sort((a, b) => a.start - b.start);
}

/**
 * Calculate total available minutes across all schedulable blocks.
 */
function totalAvailableMinutes(
  blocks: { start: number; end: number }[],
): number {
  return blocks.reduce((sum, block) => sum + (block.end - block.start), 0);
}

/**
 * Find which block a given minute falls into, or null if it's in a gap.
 */
function findBlock(
  minute: number,
  blocks: { start: number; end: number }[],
): { start: number; end: number } | null {
  return (
    blocks.find(
      (b) => minute >= b.start && minute <= b.end - SESSION_DURATION_MINUTES,
    ) ?? null
  );
}

/**
 * Snap a time to the nearest valid position within availability blocks.
 * Searches forward first, then backward.
 */
function snapToAvailable(
  targetMinute: number,
  blocks: { start: number; end: number }[],
): number | null {
  const containing = findBlock(targetMinute, blocks);
  if (containing) return targetMinute;

  let nearestForward: number | null = null;
  let nearestBackward: number | null = null;

  for (const block of blocks) {
    if (
      block.start >= targetMinute &&
      block.end - block.start >= SESSION_DURATION_MINUTES
    ) {
      nearestForward = block.start;
      break;
    }
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (!block) continue;
    const latestStart = block.end - SESSION_DURATION_MINUTES;
    if (
      latestStart <= targetMinute &&
      block.end - block.start >= SESSION_DURATION_MINUTES
    ) {
      nearestBackward = Math.min(targetMinute, latestStart);
      break;
    }
  }

  if (nearestForward === null && nearestBackward === null) return null;
  if (nearestForward === null) return nearestBackward;
  if (nearestBackward === null) return nearestForward;

  return targetMinute - nearestBackward <= nearestForward - targetMinute
    ? nearestBackward
    : nearestForward;
}

/**
 * Place the mental session (slot 6) 30-45 minutes before shift end.
 * Finds the latest position within the last available block that
 * falls in the 30-45 min buffer zone.
 */
function placeMentalSlot(
  workEnd: number,
  blocks: { start: number; end: number }[],
): number | null {
  const idealStart = workEnd - MENTAL_SLOT_BUFFER_MAX;
  const latestStart = workEnd - MENTAL_SLOT_BUFFER_MIN;

  /* Try to place within the ideal range */
  for (let minute = latestStart; minute >= idealStart; minute--) {
    if (findBlock(minute, blocks)) return minute;
  }

  /* Fall back to snapping to nearest available spot near end of day */
  return snapToAvailable(latestStart, blocks);
}

/**
 * Distribute slots 1-5 evenly across schedulable time,
 * excluding the time occupied by the mental slot.
 */
function distributePhysicalSlots(
  blocks: { start: number; end: number }[],
  mentalSlotTime: number,
  count: number,
): number[] {
  /* Calculate total schedulable minutes excluding mental slot zone */
  const availableStart = blocks[0]?.start ?? 0;
  const availableEnd = mentalSlotTime - MIN_GAP_MINUTES;

  if (availableEnd <= availableStart) return [];

  const totalMinutes = availableEnd - availableStart;
  const gap = totalMinutes / (count + 1);

  const slots: number[] = [];

  for (let i = 1; i <= count; i++) {
    const idealMinute = Math.round(availableStart + gap * i);
    const snapped = snapToAvailable(idealMinute, blocks);

    if (snapped === null) continue;

    /* Ensure minimum gap from previously placed slots */
    const tooClose = slots.some(
      (existing) => Math.abs(snapped - existing) < MIN_GAP_MINUTES,
    );

    if (tooClose) {
      /* Try shifting forward or backward to find valid placement */
      const shifted = findValidPlacement(snapped, slots, blocks);
      if (shifted !== null) slots.push(shifted);
    } else {
      slots.push(snapped);
    }
  }

  return slots.sort((a, b) => a - b);
}

/**
 * When a proposed time is too close to existing slots,
 * search nearby for a valid placement.
 */
function findValidPlacement(
  target: number,
  existingSlots: number[],
  blocks: { start: number; end: number }[],
): number | null {
  for (let offset = 1; offset <= 60; offset++) {
    for (const direction of [1, -1]) {
      const candidate = target + offset * direction;
      const inBlock = findBlock(candidate, blocks);

      if (!inBlock) continue;

      const valid = existingSlots.every(
        (existing) => Math.abs(candidate - existing) >= MIN_GAP_MINUTES,
      );

      if (valid) return candidate;
    }
  }
  return null;
}

/**
 * Main scheduling function.
 *
 * Takes the user's work window and availability, returns
 * a proposed schedule with 6 slots (or fewer with warnings).
 */
export function proposeSchedule(input: SchedulingInput): ScheduleProposal {
  const warnings: string[] = [];

  const workStart = timeToMinutes(input.workWindowStart);
  const workEnd = timeToMinutes(input.workWindowEnd);

  if (workEnd <= workStart) {
    return { slots: [], warnings: ["Work window end must be after start."] };
  }

  const schedulableBlocks = getSchedulableBlocks(
    workStart,
    workEnd,
    input.availabilityBlocks,
  );

  if (schedulableBlocks.length === 0) {
    return {
      slots: [],
      warnings: ["No available time after the 2-hour startup buffer."],
    };
  }

  const totalMinutes = totalAvailableMinutes(schedulableBlocks);
  const minimumRequired =
    TOTAL_SLOTS * (SESSION_DURATION_MINUTES + MIN_GAP_MINUTES);

  if (totalMinutes < minimumRequired) {
    const maxSlots = Math.floor(
      totalMinutes / (SESSION_DURATION_MINUTES + MIN_GAP_MINUTES),
    );
    warnings.push(
      `Only ${totalMinutes} minutes available. Can fit ${maxSlots} of ${TOTAL_SLOTS} sessions.`,
    );

    if (maxSlots === 0) {
      return { slots: [], warnings };
    }
  }

  /* Place the mental session first (slot 6) */
  const mentalTime = placeMentalSlot(workEnd, schedulableBlocks);

  if (mentalTime === null) {
    return {
      slots: [],
      warnings: ["Cannot place the mental session near end of day."],
    };
  }

  /* Determine how many physical slots to place */
  const physicalCount = Math.min(
    TOTAL_SLOTS - 1,
    totalMinutes < minimumRequired
      ? Math.floor(
          totalMinutes / (SESSION_DURATION_MINUTES + MIN_GAP_MINUTES),
        ) - 1
      : TOTAL_SLOTS - 1,
  );

  /* Distribute physical slots */
  const physicalTimes = distributePhysicalSlots(
    schedulableBlocks,
    mentalTime,
    physicalCount,
  );

  if (physicalTimes.length < physicalCount) {
    warnings.push(
      `Could only fit ${physicalTimes.length + 1} of ${TOTAL_SLOTS} sessions.`,
    );
  }

  /* Build the final slot list */
  const allTimes = [...physicalTimes, mentalTime].sort((a, b) => a - b);

  const slots: ProposedSlot[] = allTimes.map((time, index) => {
    const isMental = time === mentalTime;
    const slotNumber = (index + 1) as ProposedSlot["slotNumber"];
    const sessionType: SessionType = isMental ? "mental" : "physical";

    return {
      slotNumber,
      time: minutesToISO(time, input.date),
      sessionType,
    };
  });

  return { slots, warnings };
}
