/**
 * TF Lite Pose Estimator — Native (iOS/Android) Placeholder
 *
 * Will use TF Lite bindings for React Native in Phase 4.
 * Same 33-landmark output as the web implementation,
 * so the downstream pipeline (angle calc → scoring) is identical.
 */

import type { PoseLandmarks } from "@myonites/shared";

export interface PoseResult {
  worldLandmarks: PoseLandmarks;
  normalizedLandmarks: Array<{ x: number; y: number; visibility: number }>;
}

export function createPoseEstimator() {
  async function init(): Promise<void> {
    throw new Error("TF Lite PoseEstimator not yet implemented. Phase 4.");
  }

  function detectPose(
    _frame: unknown,
    _timestampMs: number,
  ): PoseResult | null {
    throw new Error("TF Lite PoseEstimator not yet implemented. Phase 4.");
  }

  function isReady(): boolean {
    return false;
  }

  function getState(): string {
    return "uninitialized";
  }

  function dispose(): void {
    /* Nothing to clean up */
  }

  return { init, detectPose, isReady, getState, dispose };
}

export type PoseEstimator = ReturnType<typeof createPoseEstimator>;
