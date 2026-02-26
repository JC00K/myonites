/**
 * Camera Service — Native (iOS/Android) Implementation
 *
 * This is a placeholder for the Expo Camera implementation.
 * It will be built in Phase 4 when mobile form analysis is added.
 *
 * The native implementation will:
 * - Use expo-camera to access the device camera
 * - Provide frames to the TF Lite PoseEstimator (pose.native.ts)
 * - Export the same interface as camera.web.ts so the rest of the app
 *   doesn't know or care which platform it's running on
 *
 * For now, all methods throw a "not implemented" error. This is intentional:
 * if native code accidentally tries to use the camera before Phase 4,
 * the error will be clear about why.
 */

export interface CameraConfig {
  width: number;
  height: number;
  facingMode: "user" | "environment";
}

export interface CameraStream {
  videoElement: unknown;
  stream: unknown;
  stop: () => void;
}

export async function startCamera(): Promise<CameraStream> {
  throw new Error(
    "Native camera not yet implemented. This will use expo-camera in Phase 4.",
  );
}

export function isCameraSupported(): boolean {
  return false;
}
