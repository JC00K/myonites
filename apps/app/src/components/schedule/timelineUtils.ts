/**
 * Timeline Utilities
 *
 * Shared logic for the TimelinePicker across platforms.
 * Time math, snapping, merging, formatting — no platform deps.
 */

import type { AvailabilityBlock } from "@myonites/shared";

export const MIN_BLOCK_MINUTES = 15;
export const SNAP_MINUTES = 5;
export const HANDLE_HIT_PX = 24;

export function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function formatTime12(time: string): string {
  const mins = timeToMinutes(time);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${display}${period}`;
  return `${display}:${m.toString().padStart(2, "0")}${period}`;
}

export function snap(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function minutesToPercent(
  minutes: number,
  startMinutes: number,
  totalMinutes: number,
): number {
  return ((minutes - startMinutes) / totalMinutes) * 100;
}

export function pxToMinutes(
  px: number,
  containerWidth: number,
  totalMinutes: number,
): number {
  return (px / containerWidth) * totalMinutes;
}

/** Merge overlapping or touching blocks into combined ranges */
export function mergeBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  if (blocks.length <= 1) return blocks;

  const sorted = [...blocks].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start),
  );

  const merged: AvailabilityBlock[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    const lastEnd = timeToMinutes(last.end);
    const currentStart = timeToMinutes(current.start);

    if (currentStart <= lastEnd) {
      const newEnd = Math.max(lastEnd, timeToMinutes(current.end));
      merged[merged.length - 1] = {
        start: last.start,
        end: minutesToTime(newEnd),
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/** Generate hour label positions for the timeline */
export function generateHourLabels(
  startMinutes: number,
  endMinutes: number,
  totalMinutes: number,
): { label: string; percent: number }[] {
  const labels: { label: string; percent: number }[] = [];
  for (let h = Math.ceil(startMinutes / 60); h * 60 <= endMinutes; h++) {
    const minutes = h * 60;
    if (minutes >= startMinutes && minutes <= endMinutes) {
      labels.push({
        label: formatHourLabel(minutes),
        percent: minutesToPercent(minutes, startMinutes, totalMinutes),
      });
    }
  }
  return labels;
}

/** Create a new block after the last existing one */
export function createNewBlock(
  blocks: AvailabilityBlock[],
  startMinutes: number,
  endMinutes: number,
): AvailabilityBlock | null {
  const lastEnd =
    blocks.length > 0
      ? timeToMinutes(blocks[blocks.length - 1]!.end)
      : startMinutes;

  const newStart = snap(Math.max(lastEnd + 15, startMinutes));
  const newEnd = snap(Math.min(newStart + 60, endMinutes));

  if (newEnd - newStart < MIN_BLOCK_MINUTES) return null;

  return { start: minutesToTime(newStart), end: minutesToTime(newEnd) };
}

export interface TimelinePickerProps {
  workStart: string;
  workEnd: string;
  blocks: AvailabilityBlock[];
  onChange: (blocks: AvailabilityBlock[]) => void;
}
