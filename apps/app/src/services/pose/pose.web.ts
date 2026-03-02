/**
 * MediaPipe Pose Estimator — Web Implementation
 *
 * Runs Google's MediaPipe Pose Landmarker entirely in-browser via WASM/WebGL.
 * No data leaves the device. Camera frames are processed in memory and discarded.
 *
 * Returns two landmark sets per frame:
 * - worldLandmarks (3D meters) for angle calculations in Phase 4
 * - normalizedLandmarks (2D, 0-1) for skeleton overlay rendering
 */

import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { PoseLandmarks, Landmark } from "@myonites/shared";

export interface PoseResult {
  worldLandmarks: PoseLandmarks;
  normalizedLandmarks: Array<{ x: number; y: number; visibility: number }>;
}

export interface PoseEstimatorConfig {
  delegate: "GPU" | "CPU";
  numPoses: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  minPresenceConfidence: number;
}

type EstimatorState = "uninitialized" | "loading" | "ready" | "disposed";

const DEFAULT_CONFIG: PoseEstimatorConfig = {
  delegate: "GPU",
  numPoses: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  minPresenceConfidence: 0.5,
};

export function createPoseEstimator(
  userConfig: Partial<PoseEstimatorConfig> = {},
) {
  const config: PoseEstimatorConfig = { ...DEFAULT_CONFIG, ...userConfig };
  let landmarker: PoseLandmarker | null = null;
  let state: EstimatorState = "uninitialized";

  async function init(): Promise<void> {
    if (state === "disposed") {
      throw new Error(
        "Cannot initialize a disposed PoseEstimator. Create a new instance.",
      );
    }
    if (state === "loading" || state === "ready") return;

    state = "loading";

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      /* Using 'lite' model — sufficient accuracy for form analysis, best frame rate */
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
          delegate: config.delegate,
        },
        runningMode: "VIDEO",
        numPoses: config.numPoses,
        minPoseDetectionConfidence: config.minDetectionConfidence,
        minTrackingConfidence: config.minTrackingConfidence,
        minPosePresenceConfidence: config.minPresenceConfidence,
      });

      state = "ready";
    } catch (error) {
      state = "uninitialized";
      throw new Error(
        `Failed to initialize MediaPipe: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  function detectPose(
    videoElement: HTMLVideoElement,
    timestampMs: number,
  ): PoseResult | null {
    if (state !== "ready" || !landmarker) return null;
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0)
      return null;

    const result = landmarker.detectForVideo(videoElement, timestampMs);

    const worldLandmarks = result.worldLandmarks[0];
    const normalized = result.landmarks[0];

    if (!worldLandmarks || !normalized) return null;

    const worldLandmarksMapped: Landmark[] = worldLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 0,
    }));

    const normalizedLandmarks = normalized.map((lm) => ({
      x: lm.x,
      y: lm.y,
      visibility: lm.visibility ?? 0,
    }));

    return {
      worldLandmarks: {
        landmarks: worldLandmarksMapped,
        timestamp: timestampMs,
      },
      normalizedLandmarks,
    };
  }

  function isReady(): boolean {
    return state === "ready";
  }

  function getState(): EstimatorState {
    return state;
  }

  function dispose(): void {
    if (landmarker) {
      landmarker.close();
      landmarker = null;
    }
    state = "disposed";
  }

  return { init, detectPose, isReady, getState, dispose };
}

export type PoseEstimator = ReturnType<typeof createPoseEstimator>;
