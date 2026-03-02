import { describe, it, expect } from "vitest";
import { LANDMARK_INDEX } from "./pose";

describe("Pose Types", () => {
  describe("LANDMARK_INDEX", () => {
    it("defines exactly 33 landmarks", () => {
      expect(Object.keys(LANDMARK_INDEX)).toHaveLength(33);
    });

    it("starts at index 0 (NOSE)", () => {
      expect(LANDMARK_INDEX.NOSE).toBe(0);
    });

    it("ends at index 32 (RIGHT_FOOT_INDEX)", () => {
      expect(LANDMARK_INDEX.RIGHT_FOOT_INDEX).toBe(32);
    });

    it("has unique index values", () => {
      const values = Object.values(LANDMARK_INDEX);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it("has consecutive indices from 0 to 32", () => {
      const values = Object.values(LANDMARK_INDEX).sort((a, b) => a - b);
      for (let i = 0; i < values.length; i++) {
        expect(values[i]).toBe(i);
      }
    });

    it("contains all critical joints for form analysis", () => {
      /** These are the landmarks the angle calculator will use most */
      const criticalJoints = [
        "LEFT_SHOULDER",
        "RIGHT_SHOULDER",
        "LEFT_ELBOW",
        "RIGHT_ELBOW",
        "LEFT_WRIST",
        "RIGHT_WRIST",
        "LEFT_HIP",
        "RIGHT_HIP",
        "LEFT_KNEE",
        "RIGHT_KNEE",
        "LEFT_ANKLE",
        "RIGHT_ANKLE",
      ] as const;

      for (const joint of criticalJoints) {
        expect(LANDMARK_INDEX).toHaveProperty(joint);
        expect(typeof LANDMARK_INDEX[joint]).toBe("number");
      }
    });
  });
});
