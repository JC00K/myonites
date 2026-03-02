/**
 * Pose Estimation Prototype Screen
 *
 * Development-only screen that validates the camera-to-landmarks pipeline.
 * Will be replaced by the workout screen in Phase 3.
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
import { createPoseEstimator } from "../../services/pose/pose.web";
import type { PoseEstimator } from "../../services/pose/pose.web";
import { drawSkeleton, drawFPS } from "../../services/pose/drawLandmarks";

type ScreenState = "idle" | "loading" | "running" | "error";

interface PosePrototypeScreenProps {
  onBack: () => void;
}

export function PosePrototypeScreen({ onBack }: PosePrototypeScreenProps) {
  /* Refs for per-frame values — avoid triggering re-renders at 60fps */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const estimatorRef = useRef<PoseEstimator | null>(null);
  const stopCameraRef = useRef<(() => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);

  /* State for UI changes that need re-renders */
  const [screenState, setScreenState] = useState<ScreenState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [displayFps, setDisplayFps] = useState<number>(0);

  /**
   * Release all resources. Order matters:
   * animation loop → estimator → camera → video element → canvas
   */
  const cleanup = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (estimatorRef.current) {
      estimatorRef.current.dispose();
      estimatorRef.current = null;
    }

    if (stopCameraRef.current) {
      stopCameraRef.current();
      stopCameraRef.current = null;
    }

    if (videoRef.current && videoRef.current.parentNode) {
      videoRef.current.parentNode.removeChild(videoRef.current);
      videoRef.current = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, []);

  /**
   * Initialize camera and pose estimator, attach video to DOM,
   * then start the frame processing loop.
   */
  const startSession = useCallback(async () => {
    setScreenState("loading");
    setErrorMessage("");

    try {
      if (!isCameraSupported()) {
        throw new Error(
          "Camera is not supported in this browser. " +
            "Make sure you are using HTTPS (or localhost) and a modern browser.",
        );
      }

      const camera = await startCamera({ width: 640, height: 480 });
      videoRef.current = camera.videoElement;
      stopCameraRef.current = camera.stop;

      const estimator = createPoseEstimator({
        delegate: "GPU",
        numPoses: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        minPresenceConfidence: 0.5,
      });
      await estimator.init();
      estimatorRef.current = estimator;

      /* Attach video behind the canvas in the DOM stacking order */
      if (containerRef.current && videoRef.current) {
        const video = videoRef.current;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.transform = "scaleX(-1)";
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";
        containerRef.current.insertBefore(video, canvasRef.current);
      }

      /* Canvas must match video dimensions for accurate landmark positioning */
      if (canvasRef.current && videoRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }

      setScreenState("running");
      lastFrameTimeRef.current = performance.now();

      /* Frame processing loop: detect pose → draw skeleton → update FPS */
      const processFrame = (timestamp: number) => {
        if (!estimatorRef.current || !videoRef.current || !canvasRef.current) {
          return;
        }

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;

        const poseResult = estimatorRef.current.detectPose(
          videoRef.current,
          performance.now(),
        );

        drawSkeleton(ctx, poseResult ? poseResult.normalizedLandmarks : null);

        /* FPS with exponential smoothing (0.9/0.1) to prevent flickering */
        const deltaMs = timestamp - lastFrameTimeRef.current;
        lastFrameTimeRef.current = timestamp;

        if (deltaMs > 0) {
          const instantFps = 1000 / deltaMs;
          fpsRef.current = fpsRef.current * 0.9 + instantFps * 0.1;
        }

        drawFPS(ctx, fpsRef.current);

        animationFrameRef.current = requestAnimationFrame(processFrame);
      };

      animationFrameRef.current = requestAnimationFrame(processFrame);
    } catch (error) {
      cleanup();
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      setErrorMessage(message);
      setScreenState("error");
    }
  }, [cleanup]);

  /* Push FPS to React state every 500ms for the stats panel */
  useEffect(() => {
    if (screenState !== "running") return;

    const interval = setInterval(() => {
      setDisplayFps(Math.round(fpsRef.current));
    }, 500);

    return () => clearInterval(interval);
  }, [screenState]);

  /* Clean up all resources on unmount */
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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

      {/* Video + canvas container. Always mounted, hidden when not running. */}
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
          <TouchableOpacity
            style={[
              styles.stopButton,
              { backgroundColor: "#6c757d", marginTop: 8 },
            ]}
            onPress={() => {
              cleanup();
              onBack();
            }}>
            <Text style={styles.stopButtonText}>Back to Home</Text>
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
