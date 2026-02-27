/**
 * Pose Estimation Prototype Screen
 *
 * This is the single most important validation screen in the entire project.
 * It proves that the camera-to-landmarks pipeline works in real time:
 *
 *   Camera feed → MediaPipe inference → Skeleton overlay
 *
 * What you're testing when you use this screen:
 * 1. Camera access works in the browser
 * 2. MediaPipe model loads successfully
 * 3. Landmarks are detected and positioned correctly on your body
 * 4. Frame rate is acceptable (target: 10+ FPS)
 * 5. Tracking is stable (skeleton doesn't jump around)
 * 6. Resource cleanup works (camera stops, model is disposed)
 *
 * This screen is NOT part of the final app — it's a development tool.
 * The workout screen in Phase 3 will replace this with a polished UI
 * that shows the exercise video alongside the camera feed.
 *
 * Architecture:
 * - Uses the camera service (camera.web.ts) for camera access
 * - Uses the MediaPipe estimator (pose.web.ts) for landmark detection
 * - Uses the drawing utility (drawLandmarks.ts) for visualization
 * - Runs a requestAnimationFrame loop to process frames continuously
 * - Cleans up all resources when the screen unmounts
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import {
  startCamera,
  isCameraSupported,
} from "../../services/camera/camera.web";
import { MediaPipePoseEstimator } from "../../services/pose/pose.web";
import { drawSkeleton, drawFPS } from "../../services/pose/drawLandmarks";

type ScreenState = "idle" | "loading" | "running" | "error";

interface PosePrototypeScreenProps {
  onBack: () => void;
}

export function PosePrototypeScreen({ onBack }: PosePrototypeScreenProps) {
  /**
   * ── Refs ──
   *
   * Refs are used instead of state for values that:
   * 1. Change every frame (60+ times per second)
   * 2. Are read inside the animation loop
   * 3. Should NOT trigger React re-renders
   *
   * If these were useState, React would try to re-render the entire
   * component 60 times per second, which would destroy performance.
   * Refs update silently and the animation loop reads them directly.
   */

  /**
   * Reference to the HTML video element showing the camera feed.
   * Created by the camera service and attached to the DOM.
   * The MediaPipe estimator reads frames directly from this element.
   */
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * Reference to the canvas element drawn on top of the video.
   * The skeleton (dots and lines) is drawn here every frame.
   * It's transparent except where landmarks are drawn, so the
   * camera feed shows through underneath.
   */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * Reference to the container div that holds the video and canvas.
   * Used to append the video element to the DOM when the camera starts.
   */
  const containerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Reference to the MediaPipe pose estimator instance.
   * Created once when the user clicks "Start Camera".
   * Disposed when the screen unmounts or the user stops the session.
   */
  const estimatorRef = useRef<MediaPipePoseEstimator | null>(null);

  /**
   * Reference to the camera stop function.
   * Called during cleanup to stop the camera stream and release hardware.
   */
  const stopCameraRef = useRef<(() => void) | null>(null);

  /**
   * Reference to the requestAnimationFrame ID.
   * Stored so we can cancel the animation loop during cleanup.
   * Without this, the loop would continue running after the component
   * unmounts, trying to access destroyed DOM elements.
   */
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Timestamp of the previous frame, used for FPS calculation.
   * Updated every frame inside the animation loop.
   */
  const lastFrameTimeRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);

  const [screenState, setScreenState] = useState<ScreenState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [displayFps, setDisplayFps] = useState<number>(0);

  /**
   * ── Cleanup Function ──
   *
   * Centralizes all resource cleanup in one place.
   * Called when:
   * - The user clicks "Stop"
   * - The component unmounts (navigating away)
   * - An error occurs during the session
   *
   * Cleanup order matters:
   * 1. Cancel the animation frame (stop processing new frames)
   * 2. Dispose the estimator (free WASM memory and WebGL resources)
   * 3. Stop the camera (release hardware, turn off camera LED)
   * 4. Remove the video element from the DOM
   * 5. Reset all refs to null (prevent stale references)
   */
  const cleanup = useCallback(() => {
    /** 1. Stop the animation loop */
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    /** 2. Dispose the pose estimator */
    if (estimatorRef.current) {
      estimatorRef.current.dispose();
      estimatorRef.current = null;
    }

    /** 3. Stop the camera stream */
    if (stopCameraRef.current) {
      stopCameraRef.current();
      stopCameraRef.current = null;
    }

    /** 4. Remove the video element from the DOM */
    if (videoRef.current && videoRef.current.parentNode) {
      videoRef.current.parentNode.removeChild(videoRef.current);
      videoRef.current = null;
    }

    /** 5. Clear the canvas */
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, []);

  /**
   * ── Start Session ──
   *
   * This is the main initialization function, triggered by the "Start Camera" button.
   * It performs the following steps in order:
   *
   * 1. Check if the browser supports camera access
   * 2. Start the camera (requests permission, creates video element)
   * 3. Initialize the MediaPipe pose estimator (downloads model)
   * 4. Attach the video element to the DOM
   * 5. Start the frame processing loop
   *
   * Each step can fail independently, and errors are caught and displayed.
   * If any step fails, cleanup is called to release any resources from
   * steps that succeeded before the failure.
   */
  const startSession = useCallback(async () => {
    setScreenState("loading");
    setErrorMessage("");

    try {
      /**
       * Step 1: Verify camera support.
       * This is a quick synchronous check — no permissions involved.
       * Fails on: very old browsers, non-HTTPS (except localhost), SSR.
       */
      if (!isCameraSupported()) {
        throw new Error(
          "Camera is not supported in this browser. " +
            "Make sure you are using HTTPS (or localhost) and a modern browser.",
        );
      }

      /**
       * Step 2: Start the camera.
       * This triggers the browser's camera permission prompt on first use.
       *
       * If the user denies permission, this throws NotAllowedError.
       * If no camera exists, this throws NotFoundError.
       *
       * On success, we get a video element already playing the camera feed
       * and a stop function to release the camera later.
       */
      const camera = await startCamera({ width: 640, height: 480 });
      videoRef.current = camera.videoElement;
      stopCameraRef.current = camera.stop;

      /**
       * Step 3: Initialize the pose estimator.
       * This downloads the MediaPipe WASM runtime and pose model.
       * Takes 2-5 seconds on first load, faster on subsequent loads
       * because the browser caches the files.
       *
       * We try GPU first. If that fails (no WebGL), the constructor
       * config can be changed to 'CPU' for a fallback.
       */
      const estimator = new MediaPipePoseEstimator({
        delegate: "GPU",
        numPoses: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPresenceConfidence: 0.5,
      });
      await estimator.init();
      estimatorRef.current = estimator;

      /**
       * Step 4: Attach the video element to the DOM.
       *
       * The video element was created by the camera service as a detached
       * DOM element. We need to add it to our container so it's visible.
       *
       * Styling:
       * - Fills the container completely (width/height 100%)
       * - objectFit 'cover' crops to fill without distortion
       * - scaleX(-1) mirrors the image (selfie mode)
       * - position absolute so the canvas can overlay on top
       */
      if (containerRef.current && videoRef.current) {
        const video = videoRef.current;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.transform = "scaleX(-1)";
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";

        /**
         * Insert the video BEFORE the canvas in the DOM.
         * This puts the video behind the canvas in visual stacking order.
         * The canvas (transparent except for the skeleton) overlays the video.
         */
        containerRef.current.insertBefore(video, canvasRef.current);
      }

      /**
       * Step 5: Size the canvas to match the video.
       *
       * The canvas must be the exact same pixel dimensions as the video
       * so the landmark positions line up correctly. If the canvas were
       * a different size, the skeleton would be offset from the body.
       */
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }

      /** Everything initialized successfully — start processing frames */
      setScreenState("running");
      lastFrameTimeRef.current = performance.now();
      startProcessingLoop();
    } catch (error) {
      /**
       * If anything failed, clean up whatever resources were allocated
       * before the failure, and show the error to the user.
       */
      cleanup();
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      setErrorMessage(message);
      setScreenState("error");
    }
  }, [cleanup]);

  /**
   * ── Frame Processing Loop ──
   *
   * This is the heart of the real-time pose detection system.
   * It runs continuously via requestAnimationFrame, processing one
   * camera frame per iteration:
   *
   *   1. Get the current video frame (automatic — video element is live)
   *   2. Run MediaPipe pose detection on the frame
   *   3. Draw the skeleton overlay on the canvas
   *   4. Update the FPS counter
   *   5. Request the next frame
   *
   * requestAnimationFrame is used instead of setInterval because:
   * - It syncs with the display refresh rate (usually 60Hz)
   * - It automatically pauses when the tab is hidden (saves resources)
   * - It provides a high-precision timestamp for FPS calculation
   * - The browser can optimize rendering when it controls the timing
   *
   * The actual FPS will be lower than 60 because MediaPipe inference
   * takes 30-100ms per frame. requestAnimationFrame won't schedule
   * the next frame until the current one finishes, so FPS naturally
   * settles at whatever the device can sustain.
   */
  const startProcessingLoop = useCallback(() => {
    /**
     * The inner loop function, called once per frame.
     *
     * @param timestamp - High-precision time in milliseconds,
     *   provided by requestAnimationFrame. Used for FPS calculation
     *   and passed to MediaPipe for temporal smoothing.
     */
    const processFrame = (timestamp: number) => {
      /** Bail out if resources have been cleaned up */
      if (!estimatorRef.current || !videoRef.current || !canvasRef.current) {
        return;
      }

      const ctx = canvasRef.current.getContext("2d");

      if (!ctx) return;

      /**
       * Run pose detection on the current video frame.
       *
       * detectPose() is synchronous — it blocks until inference completes.
       * The timestamp is passed to MediaPipe for temporal smoothing,
       * which makes landmark positions more stable between frames.
       *
       * Returns null if no person is detected in the frame.
       */

      /**
       * Run pose detection on the current video frame.
       * Returns both world landmarks (3D, for future angle math)
       * and normalized landmarks (2D, for drawing the skeleton).
       */

      const poseResult = estimatorRef.current.detectPose(
        videoRef.current,
        timestamp,
      );

      /**
       * Draw the skeleton using the normalized (2D) landmarks.
       * These map directly to the camera image coordinates,
       * so dots appear correctly on the body in the video feed.
       */
      drawSkeleton(ctx, poseResult ? poseResult.normalizedLandmarks : null);

      /**
       * Calculate and display FPS.
       *
       * Exponential smoothing formula:
       *   smoothed = (weight × previous) + ((1 - weight) × current)
       *
       * With weight = 0.9:
       *   - 90% of the value comes from the previous smoothed FPS
       *   - 10% comes from the current instantaneous FPS
       *   - This creates a stable, gradually updating number
       *   - Prevents the counter from flickering between values
       */
      const deltaMs = timestamp - lastFrameTimeRef.current;
      lastFrameTimeRef.current = timestamp;

      if (deltaMs > 0) {
        const instantFps = 1000 / deltaMs;
        fpsRef.current = fpsRef.current * 0.9 + instantFps * 0.1;
      }

      drawFPS(ctx, fpsRef.current);

      /** Schedule the next frame */
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    /** Kick off the loop with the first frame */
    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  /**
   * ── Periodic FPS State Update ──
   *
   * Updates the React state FPS display every 500ms.
   * This is separate from the per-frame FPS tracking because:
   * - The canvas FPS counter updates every frame (via drawFPS)
   * - The React state FPS only needs to update for any text-based
   *   UI elements outside the canvas (like the stats panel below)
   * - Updating React state 60 times per second would be wasteful
   */
  useEffect(() => {
    if (screenState !== "running") return;

    const interval = setInterval(() => {
      setDisplayFps(Math.round(fpsRef.current));
    }, 500);

    return () => clearInterval(interval);
  }, [screenState]);

  /**
   * ── Cleanup on Unmount ──
   *
   * When the user navigates away from this screen, ensure all resources
   * are released: cancel the animation loop, dispose the model, stop
   * the camera. Without this, the camera would stay on and WASM memory
   * would leak.
   */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * ── Non-Web Platform Guard ──
   *
   * This prototype only works on web (uses getUserMedia, canvas, etc).
   * If somehow rendered on native, show a clear message instead of crashing.
   */
  if (Platform.OS !== "web") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pose Estimation Prototype</Text>
        <Text style={styles.subtitle}>
          This prototype is web-only. Native support (TF Lite) will be added in
          Phase 4.
        </Text>
      </View>
    );
  }

  /**
   * ── Render ──
   *
   * The UI has four states, each showing different content:
   *
   * 1. idle: Start button — waiting for user to begin
   * 2. loading: Progress message — camera starting and model downloading
   * 3. running: Camera feed + skeleton overlay + stats panel
   * 4. error: Error message + retry button
   */
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pose Estimation Prototype</Text>

      {screenState === "idle" && (
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            This prototype verifies that MediaPipe can detect your body
            landmarks in real time through the camera.
          </Text>
          <Text style={styles.instructions}>
            You'll see colored dots on your joints and lines connecting them.
            Green = high confidence, yellow = moderate, red = low.
          </Text>
          <TouchableOpacity style={styles.button} onPress={startSession}>
            <Text style={styles.buttonText}>Start Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: "#6c757d", marginTop: 12 },
            ]}
            onPress={onBack}>
            <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      )}

      {screenState === "loading" && (
        <View style={styles.content}>
          <Text style={styles.subtitle}>Setting up...</Text>
          <Text style={styles.instructions}>
            Starting camera and downloading the AI model. This may take a few
            seconds on first use.
          </Text>
        </View>
      )}

      {screenState === "error" && (
        <View style={styles.content}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setScreenState("idle");
              setErrorMessage("");
            }}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/**
       * The camera + canvas container.
       *
       * This div is always in the DOM but only visible when running.
       * Keeping it mounted avoids DOM insertion/removal flicker.
       *
       * Structure:
       * - containerRef div (relative positioning, creates stacking context)
       *   - video element (absolute, fills container, behind canvas)
       *   - canvas element (absolute, fills container, in front of video)
       *
       * The video shows the camera feed.
       * The canvas draws the skeleton on top with transparent background.
       * Together they create the augmented reality overlay effect.
       */}
      <div
        ref={containerRef}
        style={{
          display: screenState === "running" ? "block" : "none",
          position: "relative",
          width: "100%",
          maxWidth: 640,
          aspectRatio: "4/3",
          backgroundColor: "#000",
          borderRadius: 12,
          overflow: "hidden",
          alignSelf: "center",
        }}>
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
            transform: "scaleX(-1)",
          }}
        />
      </div>

      {/** Stats panel — shown below the camera feed when running */}
      {screenState === "running" && (
        <View style={styles.statsPanel}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>FPS</Text>
            <Text
              style={[
                styles.statValue,
                {
                  color:
                    displayFps >= 15
                      ? "#22c55e"
                      : displayFps >= 10
                        ? "#eab308"
                        : "#ef4444",
                },
              ]}>
              {displayFps}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>
              {displayFps >= 10 ? "Tracking" : "Low FPS"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.stopButton}
            onPress={() => {
              cleanup();
              setScreenState("idle");
              setDisplayFps(0);
            }}>
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 16,
    textAlign: "center",
  },
  content: {
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#495057",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 22,
  },
  instructions: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    lineHeight: 20,
  },
  statsPanel: {
    width: "100%",
    maxWidth: 640,
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  stopButton: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  stopButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
