/**
 * Camera Service — Web Implementation
 *
 * Wraps getUserMedia for pose estimation camera access.
 * Frames are processed in memory only — never recorded or transmitted.
 * Native equivalent (camera.native.ts) will use Expo Camera in Phase 4.
 */

export interface CameraConfig {
  width: number;
  height: number;
  facingMode: "user" | "environment";
}

export interface CameraStream {
  videoElement: HTMLVideoElement;
  stream: MediaStream;
  /** Stops all tracks, releases camera hardware, and cleans up the video element */
  stop: () => void;
}

const DEFAULT_CONFIG: CameraConfig = {
  width: 640,
  height: 480,
  facingMode: "user",
};

/**
 * Starts the camera and resolves once the first frame is available.
 *
 * Throws on permission denial (NotAllowedError), missing camera
 * (NotFoundError), or camera in use by another app (NotReadableError).
 */
export async function startCamera(
  config: Partial<CameraConfig> = {},
): Promise<CameraStream> {
  const finalConfig: CameraConfig = { ...DEFAULT_CONFIG, ...config };

  /* 'ideal' constraints let the browser fall back gracefully if unsupported */
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: finalConfig.width },
      height: { ideal: finalConfig.height },
      facingMode: finalConfig.facingMode,
    },
    audio: false,
  });

  const videoElement = document.createElement("video");
  videoElement.setAttribute("autoplay", "");
  videoElement.setAttribute("playsinline", "");
  videoElement.setAttribute("muted", "");
  videoElement.srcObject = stream;

  /* Wait for the first frame so videoWidth/videoHeight are available */
  await new Promise<void>((resolve) => {
    videoElement.onloadeddata = () => resolve();
  });

  const stop = () => {
    stream.getTracks().forEach((track) => track.stop());
    videoElement.pause();
    videoElement.srcObject = null;
  };

  return { videoElement, stream, stop };
}

/** Checks API availability — does not check permission status */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}
