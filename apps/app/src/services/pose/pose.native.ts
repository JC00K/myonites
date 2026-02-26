/**
 * TF Lite Pose Estimator — Native (iOS/Android) Implementation
 *
 * This is a placeholder for the TensorFlow Lite implementation
 * that will run on mobile devices in Phase 4.
 *
 * The native implementation will:
 * - Use TF Lite bindings for React Native to run pose detection on-device
 * - Accept camera frames from Expo Camera (camera.native.ts)
 * - Return the same PoseLandmarks format as the web implementation
 * - Implement the same PoseEstimator interface from @myonites/shared
 *
 * Why TF Lite instead of MediaPipe on mobile:
 * - MediaPipe's web SDK uses WASM/WebGL which don't exist in React Native
 * - TF Lite has mature React Native bindings
 * - TF Lite models run natively on mobile GPU/NPU for better performance
 * - Google provides a pose detection TF Lite model that outputs the same
 *   33 landmarks as MediaPipe, so the downstream pipeline is identical
 *
 * Privacy guarantees (same as web):
 * - Model runs 100% on-device
 * - Camera frames processed in memory only
 * - Only 33 numerical coordinates are retained
 * - No images or video ever leave the device
 */

import type { PoseLandmarks } from "@myonites/shared";

/**
 * Placeholder native pose estimator.
 *
 * All methods throw clear errors indicating this is not yet implemented.
 * This prevents silent failures if native code accidentally tries to
 * use pose estimation before Phase 4.
 */
export class TfLitePoseEstimator {
  async init(): Promise<void> {
    throw new Error(
      "TF Lite PoseEstimator not yet implemented. This will be built in Phase 4 for mobile.",
    );
  }

  detectPose(_frame: unknown, _timestampMs: number): PoseLandmarks | null {
    throw new Error(
      "TF Lite PoseEstimator not yet implemented. This will be built in Phase 4 for mobile.",
    );
  }

  isReady(): boolean {
    return false;
  }

  getState(): string {
    return "uninitialized";
  }

  dispose(): void {
    /** Nothing to clean up — model was never loaded. */
  }
}
