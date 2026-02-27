import { describe, it, expect } from "vitest";
import { MOOD_MAP, MOOD_LABELS } from "./mood";
import type { MoodLabel, MoodValue } from "./mood";

describe("Mood Types", () => {
  describe("MOOD_MAP", () => {
    it("maps all 7 mood labels to numeric values", () => {
      expect(Object.keys(MOOD_MAP)).toHaveLength(7);
    });

    it("assigns values from 1 (lowest) to 7 (highest)", () => {
      const values = Object.values(MOOD_MAP);
      expect(Math.min(...values)).toBe(1);
      expect(Math.max(...values)).toBe(7);
    });

    it("maps Energized to the highest value (7)", () => {
      expect(MOOD_MAP.Energized).toBe(7);
    });

    it("maps Stressed to the lowest value (1)", () => {
      expect(MOOD_MAP.Stressed).toBe(1);
    });

    it("has unique numeric values for each label", () => {
      const values = Object.values(MOOD_MAP);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it("maps each label to the correct value", () => {
      const expected: Record<MoodLabel, MoodValue> = {
        Energized: 7,
        Focused: 6,
        Calm: 5,
        Neutral: 4,
        Tired: 3,
        Anxious: 2,
        Stressed: 1,
      };
      expect(MOOD_MAP).toEqual(expected);
    });
  });

  describe("MOOD_LABELS", () => {
    it("contains all 7 labels", () => {
      expect(MOOD_LABELS).toHaveLength(7);
    });

    it("is ordered from highest energy to lowest", () => {
      for (let i = 0; i < MOOD_LABELS.length - 1; i++) {
        const current = MOOD_MAP[MOOD_LABELS[i]!];
        const next = MOOD_MAP[MOOD_LABELS[i + 1]!];
        expect(current).toBeGreaterThan(next);
      }
    });

    it("contains every key from MOOD_MAP", () => {
      const mapKeys = Object.keys(MOOD_MAP) as MoodLabel[];
      for (const key of mapKeys) {
        expect(MOOD_LABELS).toContain(key);
      }
    });
  });
});
