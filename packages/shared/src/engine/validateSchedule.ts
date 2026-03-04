/**
 * Schedule Validation
 *
 * Validates manual adjustments to proposed schedules.
 * Enforces minimum gap and availability block constraints.
 */

import type { AvailabilityBlock, ProposedSlot } from "../types/schedule";
import { timeToMinutes } from "./scheduling";

const MIN_GAP_MINUTES = 20;
const SESSION_DURATION_MINUTES = 7;

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Parse time from an ISO timestamp to minutes since midnight.
 */
function isoToMinutes(iso: string): number {
  const timePart = iso.split("T")[1];
  if (!timePart) return 0;
  const parts = timePart.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/**
 * Check if a proposed time falls within any availability block.
 */
function isWithinAvailability(
  timeMinutes: number,
  blocks: AvailabilityBlock[],
): boolean {
  return blocks.some((block) => {
    const start = timeToMinutes(block.start);
    const end = timeToMinutes(block.end);
    return (
      timeMinutes >= start && timeMinutes + SESSION_DURATION_MINUTES <= end
    );
  });
}

/**
 * Validate moving a single slot to a new time.
 *
 * Checks:
 *   1. New time falls within an availability block
 *   2. Minimum 20-minute gap from all other slots
 */
export function validateSlotMove(
  slotToMove: number,
  newTimeISO: string,
  allSlots: ProposedSlot[],
  availabilityBlocks: AvailabilityBlock[],
): ValidationResult {
  const newMinutes = isoToMinutes(newTimeISO);

  if (!isWithinAvailability(newMinutes, availabilityBlocks)) {
    return {
      valid: false,
      error:
        "Workouts can only be scheduled within your available time blocks.",
    };
  }

  const otherSlots = allSlots.filter((s) => s.slotNumber !== slotToMove);

  for (const slot of otherSlots) {
    const slotMinutes = isoToMinutes(slot.time);
    const gap = Math.abs(newMinutes - slotMinutes);

    if (gap < MIN_GAP_MINUTES) {
      return {
        valid: false,
        error: `Cannot schedule workouts within ${MIN_GAP_MINUTES} minutes of each other.`,
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Validate an entire schedule (all 6 slots).
 * Used when confirming a schedule after manual adjustments.
 */
export function validateFullSchedule(
  slots: ProposedSlot[],
  availabilityBlocks: AvailabilityBlock[],
): ValidationResult {
  const sorted = [...slots].sort(
    (a, b) => isoToMinutes(a.time) - isoToMinutes(b.time),
  );

  for (const slot of sorted) {
    const minutes = isoToMinutes(slot.time);

    if (!isWithinAvailability(minutes, availabilityBlocks)) {
      return {
        valid: false,
        error: `Slot ${slot.slotNumber} falls outside your available time blocks.`,
      };
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prevSlot = sorted[i - 1];
    const currSlot = sorted[i];
    if (!prevSlot || !currSlot) continue;
    const prev = isoToMinutes(prevSlot.time);
    const curr = isoToMinutes(currSlot.time);
    const gap = curr - prev;
    if (gap < MIN_GAP_MINUTES) {
      return {
        valid: false,
        error: `Cannot schedule workouts within ${MIN_GAP_MINUTES} minutes of each other.`,
      };
    }
  }

  return { valid: true, error: null };
}
