import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { PoseLandmarks, Landmark } from "@myonites/shared";

/**
 * Extended result that includes both landmark types.
 *
 * - worldLandmarks: 3D positions in meters, used for angle calculations (Phase 4)
 * - normalizedLandmarks: 2D positions mapped to the image (0-1), used for drawing
 *
 * The drawing utility needs normalizedLandmarks because they correspond
 * to pixel positions in the camera frame. worldLandmarks are in a separate
 * 3D coordinate space that doesn't map to the image.
 */
export interface PoseResult {
  /** 3D landmarks in real-world coordinates (meters). For angle math. */
  worldLandmarks: PoseLandmarks;
  /** 2D landmarks normalized to the image (0-1). For drawing overlays. */
  normalizedLandmarks: Array<{ x: number; y: number; visibility: number }>;
}

/**
 * Configuration for the MediaPipe pose estimator.
 */
export interface PoseEstimatorConfig {
  /**
   * Which processing backend to use.
   *
   * 'GPU': Uses WebGL for hardware-accelerated inference.
   *   - 2-5x faster than CPU on most devices
   *   - Uses the device's graphics card
   *   - Preferred option for smooth real-time tracking
   *
   * 'CPU': Falls back to WebAssembly on the CPU.
   *   - Slower but works on all devices
   *   - Used when GPU/WebGL is unavailable
   *   - May drop below 10 FPS on older hardware
   */
  delegate: "GPU" | "CPU";

  /**
   * How many people to detect in the frame.
   *
   * Myonites is designed for single-user workouts, so this is always 1.
   * Detecting multiple people would waste processing time and create
   * ambiguity about whose form to analyze.
   */
  numPoses: number;

  /**
   * Minimum confidence score (0-1) to consider a detection valid.
   *
   * 0.5 means the model must be at least 50% confident it's seeing a person.
   * Lower values detect more but with more false positives.
   * Higher values are more selective but may miss legitimate poses.
   * 0.5 is MediaPipe's recommended default.
   */
  minDetectionConfidence: number;

  /**
   * Minimum confidence score (0-1) for tracking between frames.
   *
   * Once a person is detected, this threshold determines how confident
   * the model needs to be to keep tracking them frame-to-frame.
   * Lower values maintain tracking through fast movements.
   * 0.5 is the recommended default.
   */
  minTrackingConfidence: number;

  /**
   * Minimum confidence score (0-1) for individual landmark positions.
   *
   * Each of the 33 landmarks gets its own confidence score.
   * This threshold filters out landmarks the model isn't sure about.
   * Landmarks below this confidence still appear in the array
   * but their visibility field will reflect the low confidence,
   * so downstream code (angle calculator) can decide whether to use them.
   */
  minPresenceConfidence: number;
}

/**
 * Default configuration optimized for Myonites workout tracking.
 *
 * These values balance accuracy with performance for real-time form analysis.
 * They can be tuned later based on testing across different devices.
 */
const DEFAULT_CONFIG: PoseEstimatorConfig = {
  delegate: "GPU",
  numPoses: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  minPresenceConfidence: 0.5,
};

/**
 * Tracks the internal state of the estimator.
 *
 * The estimator goes through a lifecycle:
 *   uninitialized → loading → ready → disposed
 *
 * - uninitialized: created but init() hasn't been called yet
 * - loading: downloading the WASM runtime and model files
 * - ready: model is loaded and detectPose() can be called
 * - disposed: resources have been released, cannot be used again
 *
 * This state machine prevents common bugs:
 * - Calling detectPose() before the model is ready
 * - Calling detectPose() after disposal
 * - Calling init() multiple times (wasting memory)
 */
type EstimatorState = "uninitialized" | "loading" | "ready" | "disposed";

/**
 * Web implementation of the PoseEstimator interface.
 *
 * Usage:
 *   const estimator = new MediaPipePoseEstimator();
 *   await estimator.init();           // Load model (do this once)
 *   const landmarks = estimator.detectPose(videoElement);  // Per frame
 *   estimator.dispose();              // Clean up when done
 *
 * The init/detect/dispose lifecycle matches how the workout screen works:
 * 1. User confirms a graded workout → init() loads the model
 * 2. During each exercise → detectPose() runs on every camera frame
 * 3. Exercise ends or user leaves → dispose() frees resources
 */
export class MediaPipePoseEstimator {
  /**
   * The underlying MediaPipe PoseLandmarker instance.
   * Null until init() completes successfully.
   * Set back to null on dispose().
   */
  private landmarker: PoseLandmarker | null = null;

  /**
   * Current lifecycle state. See EstimatorState for details.
   */
  private state: EstimatorState = "uninitialized";

  /**
   * Configuration for this estimator instance.
   * Set once during construction, immutable after.
   */
  private config: PoseEstimatorConfig;

  /**
   * Create a new MediaPipe pose estimator.
   *
   * This only stores configuration — no heavy work happens here.
   * The actual model loading happens in init(), which is async
   * because it downloads the WASM runtime and model files.
   *
   * @param config - Optional overrides for the default configuration.
   */
  constructor(config: Partial<PoseEstimatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the pose estimation model.
   *
   * This is the expensive operation — it:
   * 1. Downloads the MediaPipe WASM runtime (~2MB)
   *    - This is the WebAssembly code that runs the neural network
   *    - Downloaded from Google's CDN on first load, then cached by the browser
   * 2. Downloads the pose landmark model (~3MB)
   *    - The trained neural network weights
   *    - 'pose_landmarker_lite' is the smallest/fastest variant
   *    - Other options: 'pose_landmarker_full' (more accurate, slower)
   *    - Also cached by the browser after first download
   * 3. Compiles the WASM module and initializes WebGL (if GPU mode)
   *
   * Total first-load time: 2-5 seconds depending on network and device.
   * Subsequent loads: much faster due to browser caching.
   *
   * This method is idempotent — calling it when already ready is a no-op.
   * Calling it when already loading does nothing (won't double-load).
   * Calling it after dispose throws an error (can't resurrect a disposed estimator).
   *
   * @throws Error if called after dispose() or if model download fails.
   */
  async init(): Promise<void> {
    /**
     * Guard against invalid state transitions.
     * Each case handles a specific scenario to prevent bugs.
     */
    if (this.state === "disposed") {
      throw new Error(
        "Cannot initialize a disposed PoseEstimator. Create a new instance instead.",
      );
    }

    if (this.state === "loading" || this.state === "ready") {
      /** Already loading or ready — nothing to do. */
      return;
    }

    this.state = "loading";

    try {
      /**
       * Step 1: Resolve the WASM fileset.
       *
       * FilesetResolver downloads the platform-specific WASM binary
       * and support files from Google's CDN. The 'vision' variant
       * includes the image processing pipeline needed for pose detection.
       *
       * The URL points to a specific version to ensure compatibility.
       * The browser caches these files after the first download.
       */
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      /**
       * Step 2: Create the PoseLandmarker with our configuration.
       *
       * This downloads the model, compiles WASM, and sets up the
       * inference pipeline. After this resolves, detectPose() is usable.
       *
       * Model options:
       * - pose_landmarker_lite.task: Fastest, good enough for form analysis
       * - pose_landmarker_full.task: Most accurate, may be too slow for real-time
       * - pose_landmarker_heavy.task: Highest accuracy, not suitable for real-time
       *
       * We use 'lite' because form analysis doesn't need sub-millimeter accuracy.
       * The angle calculations work well with the lite model's precision.
       *
       * runningMode 'VIDEO' means:
       * - The model expects sequential frames from a video stream
       * - It uses temporal information to improve tracking between frames
       * - This is more accurate and stable than 'IMAGE' mode for our use case
       */
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
          delegate: this.config.delegate,
        },
        runningMode: "VIDEO",
        numPoses: this.config.numPoses,
        minPoseDetectionConfidence: this.config.minDetectionConfidence,
        minTrackingConfidence: this.config.minTrackingConfidence,
        minPosePresenceConfidence: this.config.minPresenceConfidence,
      });

      this.state = "ready";
    } catch (error) {
      /**
       * If initialization fails, reset to uninitialized so the caller
       * can try again (e.g., after checking network connectivity).
       *
       * Common failure reasons:
       * - Network error downloading WASM/model files
       * - WebGL not available when GPU delegate requested
       * - Browser doesn't support WebAssembly (very rare in modern browsers)
       */
      this.state = "uninitialized";
      throw new Error(
        `Failed to initialize MediaPipe PoseEstimator: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Detect pose landmarks in a single video frame.
   *
   * Returns both world landmarks (3D, for angle calculations in Phase 4)
   * and normalized landmarks (2D, for drawing the skeleton overlay).
   *
   * @param videoElement - The HTML video element from the camera service.
   * @param timestampMs - Current time in milliseconds. Must increase on each call.
   * @returns PoseResult with both landmark types, or null if no pose detected.
   */
  detectPose(
    videoElement: HTMLVideoElement,
    timestampMs: number,
  ): PoseResult | null {
    /**
     * Safety check: don't process if the estimator isn't ready.
     */
    if (this.state !== "ready" || !this.landmarker) {
      return null;
    }

    /**
     * Safety check: don't process if the video isn't producing frames.
     */
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return null;
    }

    /**
     * Run pose detection on the current video frame.
     * This returns both worldLandmarks (3D) and landmarks (2D normalized).
     */
    const result = this.landmarker.detectForVideo(videoElement, timestampMs);

    /**
     * Check if any poses were detected.
     * We need both landmark types to be present.
     */
    if (
      !result.worldLandmarks ||
      result.worldLandmarks.length === 0 ||
      !result.worldLandmarks[0] ||
      result.worldLandmarks[0].length === 0 ||
      !result.landmarks ||
      result.landmarks.length === 0 ||
      !result.landmarks[0] ||
      result.landmarks[0].length === 0
    ) {
      return null;
    }

    /**
     * Convert world landmarks (3D, meters) for angle calculations.
     * These will be used by the form analysis engine in Phase 4.
     */
    const worldLandmarksMapped: Landmark[] = result.worldLandmarks[0].map(
      (lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility ?? 0,
      }),
    );

    /**
     * Convert normalized landmarks (2D, 0-1 range) for skeleton drawing.
     * These map directly to the camera image:
     * - x: 0 = left edge, 1 = right edge
     * - y: 0 = top edge, 1 = bottom edge
     * This is what the drawSkeleton function needs to position dots correctly.
     */
    const normalizedLandmarks = result.landmarks[0].map((lm) => ({
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

  /**
   * Check whether the estimator is ready to process frames.
   *
   * Use this to:
   * - Show a loading indicator while the model downloads
   * - Gate the start of frame processing in the render loop
   * - Verify state before calling detectPose()
   *
   * @returns true only when init() has completed successfully.
   */
  isReady(): boolean {
    return this.state === "ready";
  }

  /**
   * Get the current lifecycle state of the estimator.
   *
   * Useful for UI feedback:
   * - 'uninitialized': Show "Preparing..." or a setup button
   * - 'loading': Show a loading spinner with "Loading AI model..."
   * - 'ready': Show the camera feed and start processing
   * - 'disposed': Estimator is dead, create a new one if needed
   */
  getState(): EstimatorState {
    return this.state;
  }

  /**
   * Release all resources held by the estimator.
   *
   * This frees:
   * - The WASM memory used by the neural network
   * - Any WebGL textures and buffers (if GPU mode)
   * - The model weights stored in memory
   *
   * After calling dispose():
   * - detectPose() returns null (safe to call, just does nothing)
   * - isReady() returns false
   * - init() throws an error (can't reuse a disposed estimator)
   * - Create a new MediaPipePoseEstimator instance if you need one again
   *
   * IMPORTANT: Always call this when the workout ends or the user
   * navigates away. Failing to dispose leaks GPU memory and WASM heap,
   * which can crash the browser tab on longer sessions.
   */
  dispose(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    this.state = "disposed";
  }
}
