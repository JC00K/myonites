import type { PoseLandmarks } from '../../types/pose';

/**
 * Abstraction over pose estimation engines.
 * Implementations:
 *   - MediaPipePoseEstimator (web, via @mediapipe/tasks-vision)
 *   - TfLitePoseEstimator (mobile, via TF Lite bindings)
 */
export interface PoseEstimator {
  /** Process a single video frame and return 33 pose landmarks */
  detectPose(frame: VideoFrame): Promise<PoseLandmarks>;

  /** Whether the model is loaded and ready for inference */
  isReady(): boolean;

  /** Clean up model resources */
  dispose(): void;
}

/**
 * Platform-agnostic video frame.
 * Web: ImageBitmap or HTMLVideoElement
 * Mobile: camera frame buffer
 */
export type VideoFrame = unknown;
