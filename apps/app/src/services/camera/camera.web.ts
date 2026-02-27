/**
 * Camera Service — Web Implementation
 *
 * This module wraps the browser's getUserMedia API to provide camera access
 * for pose estimation during graded workouts.
 *
 * How it fits into the app:
 * - The workout screen calls `startCamera()` to begin capturing video
 * - Each frame from the video stream is fed to the PoseEstimator
 * - The PoseEstimator extracts 33 body landmarks from each frame
 * - When the exercise ends or the user leaves, `stopCamera()` cleans up
 *
 * Platform split:
 * - This file (camera.web.ts) is bundled for web builds
 * - camera.native.ts will handle iOS/Android via Expo Camera
 * - Both export the same interface, so the rest of the app doesn't care
 *   which platform it's running on
 *
 * Privacy:
 * - Video frames are ONLY used for in-memory pose detection
 * - Frames are never recorded, stored, or transmitted
 * - Only the 33 numerical landmark coordinates are retained
 */

/**
 * Configuration options for the camera stream.
 * These are passed to getUserMedia to control video quality.
 */
export interface CameraConfig {
  /**
   * Preferred camera width in pixels.
   * Higher = more accurate pose detection, but slower processing.
   * 640 is the sweet spot for balancing accuracy and performance.
   */
  width: number;

  /**
   * Preferred camera height in pixels.
   * 480 pairs with 640 for a standard 4:3 aspect ratio.
   */
  height: number;

  /**
   * Which camera to use.
   * 'user' = front-facing (selfie) camera — what we want for workout form.
   * 'environment' = rear camera — not useful for self-monitoring.
   */
  facingMode: "user" | "environment";
}

/**
 * Default camera settings optimized for pose estimation.
 *
 * Why 640x480:
 * - MediaPipe internally resizes frames anyway, so sending 1080p is wasted work
 * - 640x480 gives enough detail for accurate landmark detection
 * - Lower resolution = faster frame processing = higher FPS
 *
 * Why 'user' facing:
 * - Users face the screen during workouts to see the exercise video
 * - The front camera captures their body for form analysis
 */
const DEFAULT_CONFIG: CameraConfig = {
  width: 640,
  height: 480,
  facingMode: "user",
};

/**
 * The result of starting the camera.
 * Contains everything needed to use the camera stream and clean it up later.
 */
export interface CameraStream {
  /**
   * The HTML video element displaying the live camera feed.
   * This is also what gets passed to MediaPipe for frame analysis.
   * The PoseEstimator calls detectPose(videoElement) on each frame.
   */
  videoElement: HTMLVideoElement;

  /**
   * The raw MediaStream from getUserMedia.
   * Stored so we can stop all tracks when the camera is no longer needed.
   * Each track represents a hardware resource (the camera itself),
   * and must be explicitly stopped to release the camera.
   */
  stream: MediaStream;

  /**
   * Call this to stop the camera and release all resources.
   * This stops every media track (releases the camera hardware),
   * pauses the video element, and clears its source.
   *
   * IMPORTANT: Always call this when leaving the workout screen
   * or transitioning to a non-graded segment. Failing to stop
   * leaves the camera LED on and wastes battery/resources.
   */
  stop: () => void;
}

/**
 * Starts the camera and returns a ready-to-use video element.
 *
 * Flow:
 * 1. Request camera permission via getUserMedia
 *    - Browser shows the permission prompt on first call
 *    - Subsequent calls reuse the existing permission
 * 2. Create a <video> element and attach the stream to it
 * 3. Wait for the video to be ready (loadeddata event)
 * 4. Return the video element, stream, and stop function
 *
 * Error cases:
 * - User denies camera permission → throws with 'NotAllowedError'
 * - No camera available → throws with 'NotFoundError'
 * - Camera already in use by another app → throws with 'NotReadableError'
 *
 * @param config - Optional camera settings. Defaults to 640x480 front camera.
 * @returns A CameraStream with the video element and cleanup function.
 */
export async function startCamera(
  config: Partial<CameraConfig> = {},
): Promise<CameraStream> {
  /**
   * Merge provided config with defaults.
   * This lets callers override just one setting, e.g. { width: 1280 },
   * without needing to specify everything.
   */
  const finalConfig: CameraConfig = { ...DEFAULT_CONFIG, ...config };

  /**
   * Request camera access from the browser.
   *
   * The constraints object tells the browser what kind of stream we want:
   * - video: true with specific dimensions and facing mode
   * - audio: false because we never need microphone for pose estimation
   *
   * 'ideal' means the browser will try to match these dimensions
   * but may return a different resolution if the camera doesn't support it.
   * This is preferable to 'exact' which would throw an error if unavailable.
   */
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: finalConfig.width },
      height: { ideal: finalConfig.height },
      facingMode: finalConfig.facingMode,
    },
    audio: false,
  });

  /**
   * Create a video element to display and process the camera feed.
   *
   * This element serves two purposes:
   * 1. Visual: shown in the workout UI so the user can see themselves
   * 2. Data source: passed to MediaPipe's detectPose() for landmark extraction
   *
   * Attributes:
   * - autoplay: start playing as soon as the stream is attached
   * - playsInline: prevent iOS from going fullscreen (critical for overlay UI)
   * - muted: no audio output (we're not capturing audio)
   * - srcObject: the live camera stream (not a URL, but the actual MediaStream)
   */
  const videoElement = document.createElement("video");
  videoElement.setAttribute("autoplay", "");
  videoElement.setAttribute("playsinline", "");
  videoElement.setAttribute("muted", "");
  videoElement.srcObject = stream;

  /**
   * Wait for the video to be ready before returning.
   *
   * The 'loadeddata' event fires when enough data has been loaded
   * to display the first frame. At this point:
   * - videoElement.videoWidth and videoElement.videoHeight are set
   * - The video can be drawn to a canvas
   * - MediaPipe can start processing frames
   *
   * Without this wait, the video dimensions would be 0 and
   * MediaPipe would receive empty frames.
   */
  await new Promise<void>((resolve) => {
    videoElement.onloadeddata = () => {
      resolve();
    };
  });

  /**
   * Build the stop function that cleanly releases all resources.
   *
   * Why we need explicit cleanup:
   * - MediaStream tracks hold a reference to the camera hardware
   * - Even if the video element is removed from the DOM, the tracks keep running
   * - The camera LED stays on and the camera is locked from other apps
   * - Each track.stop() releases one hardware resource
   *
   * We also pause the video and clear srcObject to ensure the browser
   * fully releases the video decoder resources.
   */
  const stop = () => {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    videoElement.pause();
    videoElement.srcObject = null;
  };

  return {
    videoElement,
    stream,
    stop,
  };
}

/**
 * Checks whether the browser supports camera access.
 *
 * This should be called before attempting to start the camera,
 * so the UI can show an appropriate message instead of an error.
 *
 * Returns false in:
 * - Browsers without getUserMedia (very old browsers)
 * - Non-secure contexts (HTTP instead of HTTPS, except localhost)
 * - Server-side rendering (no navigator object)
 *
 * Note: This only checks API availability, not whether the user
 * has granted permission. Permission is requested when startCamera() is called.
 */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}
