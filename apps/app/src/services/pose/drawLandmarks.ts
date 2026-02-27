/**
 * Skeleton Drawing Utility
 *
 * Draws the 33 pose landmarks and their connections onto an HTML canvas.
 * This is a visual debugging and verification tool — it overlays dots
 * on each detected joint and lines between connected joints to form
 * a "skeleton" on top of the camera feed.
 *
 * This is used ONLY in the prototype screen to verify that:
 * 1. MediaPipe is detecting a person in the frame
 * 2. The landmarks are positioned correctly on the body
 * 3. Tracking is stable (not jumping around between frames)
 * 4. Frame rate is acceptable for real-time use
 *
 * In the final workout screen (Phase 3), this will be replaced
 * by a more polished silhouette overlay. But the data flow is
 * identical — landmarks in, visual feedback out.
 *
 * How it works:
 * - Takes the PoseLandmarks (33 points) from the PoseEstimator
 * - Converts normalized coordinates (0-1) to canvas pixel positions
 * - Draws circles at each landmark position
 * - Draws lines between connected landmarks (e.g., shoulder to elbow)
 * - Color-codes by confidence: green = high, yellow = medium, red = low
 */

import { LANDMARK_INDEX } from "@myonites/shared";

/**
 * Visual styling configuration for the skeleton overlay.
 * Separated from drawing logic so it's easy to adjust the look.
 */
interface DrawConfig {
  /** Radius of the circles drawn at each landmark */
  landmarkRadius: number;

  /** Width of the lines connecting landmarks */
  connectionLineWidth: number;

  /** Color for high-confidence landmarks (visibility > 0.7) */
  highConfidenceColor: string;

  /** Color for medium-confidence landmarks (visibility 0.4-0.7) */
  mediumConfidenceColor: string;

  /** Color for low-confidence landmarks (visibility < 0.4) */
  lowConfidenceColor: string;

  /** Color for the connection lines between landmarks */
  connectionColor: string;

  /**
   * Minimum visibility score to draw a landmark.
   * Landmarks below this threshold are invisible — drawing them
   * would show misleading dots in wrong positions.
   */
  visibilityThreshold: number;
}

/**
 * Default drawing configuration.
 *
 * Why these values:
 * - 6px radius: visible without obscuring the camera feed
 * - 3px line width: clear connections without clutter
 * - 0.3 visibility threshold: shows most landmarks but hides
 *   the truly unreliable ones (e.g., occluded joints)
 * - Green/yellow/red: intuitive confidence indication
 */
const DEFAULT_DRAW_CONFIG: DrawConfig = {
  landmarkRadius: 6,
  connectionLineWidth: 3,
  highConfidenceColor: "#22c55e",
  mediumConfidenceColor: "#eab308",
  lowConfidenceColor: "#ef4444",
  connectionColor: "rgba(255, 255, 255, 0.6)",
  visibilityThreshold: 0.3,
};

/**
 * Defines which landmarks should be connected by lines.
 *
 * Each pair [a, b] means "draw a line from landmark a to landmark b".
 * Together, these pairs form the skeleton shape:
 * - Head and face connections
 * - Torso (shoulders to hips)
 * - Arms (shoulder → elbow → wrist)
 * - Legs (hip → knee → ankle)
 * - Feet (ankle → heel → toe)
 *
 * The indices come from LANDMARK_INDEX in @myonites/shared,
 * which maps to the MediaPipe Pose model's 33-point body model.
 */
const SKELETON_CONNECTIONS: [number, number][] = [
  /** Torso — the central frame of the body */
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],

  /** Left arm — shoulder down to wrist */
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_ELBOW],
  [LANDMARK_INDEX.LEFT_ELBOW, LANDMARK_INDEX.LEFT_WRIST],

  /** Right arm */
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_ELBOW],
  [LANDMARK_INDEX.RIGHT_ELBOW, LANDMARK_INDEX.RIGHT_WRIST],

  /** Left leg — hip down to ankle */
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.LEFT_KNEE],
  [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],

  /** Right leg */
  [LANDMARK_INDEX.RIGHT_HIP, LANDMARK_INDEX.RIGHT_KNEE],
  [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],

  /** Left foot — ankle to heel to toe */
  [LANDMARK_INDEX.LEFT_ANKLE, LANDMARK_INDEX.LEFT_HEEL],
  [LANDMARK_INDEX.LEFT_HEEL, LANDMARK_INDEX.LEFT_FOOT_INDEX],
  [LANDMARK_INDEX.LEFT_ANKLE, LANDMARK_INDEX.LEFT_FOOT_INDEX],

  /** Right foot */
  [LANDMARK_INDEX.RIGHT_ANKLE, LANDMARK_INDEX.RIGHT_HEEL],
  [LANDMARK_INDEX.RIGHT_HEEL, LANDMARK_INDEX.RIGHT_FOOT_INDEX],
  [LANDMARK_INDEX.RIGHT_ANKLE, LANDMARK_INDEX.RIGHT_FOOT_INDEX],

  /**
   * Face outline — connects ears through eyes and nose.
   * Not critical for form analysis, but helps verify face detection
   * and gives a clear visual indicator that tracking is working.
   */
  [LANDMARK_INDEX.LEFT_EAR, LANDMARK_INDEX.LEFT_EYE],
  [LANDMARK_INDEX.LEFT_EYE, LANDMARK_INDEX.NOSE],
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_EYE],
  [LANDMARK_INDEX.RIGHT_EYE, LANDMARK_INDEX.RIGHT_EAR],
];

/**
 * Returns a color based on the landmark's visibility confidence.
 *
 * This gives immediate visual feedback about detection quality:
 * - Green dots: the model is confident about this joint's position
 * - Yellow dots: moderate confidence, position might be slightly off
 * - Red dots: low confidence, likely occluded or at the frame edge
 *
 * During a workout, yellow/red landmarks on the joints being measured
 * would indicate the user should adjust their position relative to the camera.
 *
 * @param visibility - Confidence score from 0 (invisible) to 1 (certain)
 * @param config - Drawing configuration with color definitions
 * @returns CSS color string for rendering
 */
function getConfidenceColor(visibility: number, config: DrawConfig): string {
  if (visibility > 0.7) return config.highConfidenceColor;
  if (visibility > 0.4) return config.mediumConfidenceColor;
  return config.lowConfidenceColor;
}

/**
 * Converts a normalized landmark position to canvas pixel coordinates.
 *
 * MediaPipe returns landmark positions as values between 0 and 1:
 * - x: 0 = left edge of frame, 1 = right edge
 * - y: 0 = top edge of frame, 1 = bottom edge
 *
 * This function multiplies by canvas dimensions to get pixel positions.
 *
 * The x-axis is mirrored (1 - x) because:
 * - The front-facing camera produces a mirrored image
 * - Users expect to see themselves as in a mirror (raise left hand → left side moves)
 * - Without mirroring, movements appear reversed and feel unnatural
 * - The camera feed itself is already mirrored via CSS transform,
 *   so the landmarks must be mirrored to match
 *
 * Note: We use the 2D normalized landmarks (not worldLandmarks) for drawing
 * because they map directly to the image coordinates. The worldLandmarks
 * are in 3D meter-space and are used for angle calculations, not rendering.
 *
 * @param landmark - The landmark with normalized x, y coordinates
 * @param canvasWidth - Width of the canvas in pixels
 * @param canvasHeight - Height of the canvas in pixels
 * @returns Pixel coordinates { x, y } for drawing on the canvas
 */
function toCanvasCoords(
  landmark: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: landmark.x * canvasWidth,
    y: landmark.y * canvasHeight,
  };
}

/**
 * Draws the complete skeleton overlay on a canvas.
 *
 * This is the main function called on every frame in the render loop.
 * It clears the previous frame's drawing, then renders fresh landmarks
 * and connections based on the latest pose detection results.
 *
 * Drawing order matters:
 * 1. Clear the canvas (remove previous frame's skeleton)
 * 2. Draw connection lines first (underneath the dots)
 * 3. Draw landmark dots on top (so they're always visible at joints)
 *
 * Performance:
 * - Canvas 2D drawing is very fast (~1ms for 33 dots and 22 lines)
 * - The bottleneck is always MediaPipe inference, not rendering
 * - No need for WebGL or other optimization for the skeleton overlay
 *
 * @param ctx - The 2D rendering context of the overlay canvas
 * @param poseLandmarks - The detected landmarks, or null if no detection.
 *   When null, the canvas is simply cleared (no skeleton shown).
 * @param normalizedLandmarks - The 2D image-space landmarks from MediaPipe.
 *   These are separate from worldLandmarks and map directly to the camera image.
 *   Pass null to skip drawing (canvas will be cleared).
 * @param config - Optional drawing configuration overrides
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  normalizedLandmarks: Array<{
    x: number;
    y: number;
    visibility?: number;
  }> | null,
  config: Partial<DrawConfig> = {},
): void {
  const finalConfig: DrawConfig = { ...DEFAULT_DRAW_CONFIG, ...config };
  const { width, height } = ctx.canvas;

  /**
   * Clear the entire canvas before drawing.
   * This removes the previous frame's skeleton so we don't get
   * overlapping skeletons building up.
   */
  ctx.clearRect(0, 0, width, height);

  /**
   * If no landmarks were detected this frame, stop here.
   * The canvas is now blank, which visually indicates
   * "no person detected" to the user.
   */
  if (!normalizedLandmarks || normalizedLandmarks.length === 0) {
    return;
  }

  /**
   * Phase 1: Draw connection lines between landmarks.
   *
   * Lines are drawn first so they appear BEHIND the landmark dots.
   * This makes joints clearly visible even where multiple lines converge
   * (like at the shoulders and hips).
   *
   * Each connection is only drawn if BOTH endpoints are visible enough.
   * Drawing a line to a low-confidence landmark would show a misleading
   * connection that jumps around erratically.
   */
  ctx.strokeStyle = finalConfig.connectionColor;
  ctx.lineWidth = finalConfig.connectionLineWidth;
  ctx.lineCap = "round";

  for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
    const startLandmark = normalizedLandmarks[startIdx];
    const endLandmark = normalizedLandmarks[endIdx];

    /** Skip if either landmark doesn't exist in the array */
    if (!startLandmark || !endLandmark) continue;

    /** Skip if either landmark has too low confidence */
    const startVisibility = startLandmark.visibility ?? 0;
    const endVisibility = endLandmark.visibility ?? 0;
    if (
      startVisibility < finalConfig.visibilityThreshold ||
      endVisibility < finalConfig.visibilityThreshold
    ) {
      continue;
    }

    /** Convert both endpoints to canvas coordinates and draw the line */
    const start = toCanvasCoords(startLandmark, width, height);
    const end = toCanvasCoords(endLandmark, width, height);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  /**
   * Phase 2: Draw landmark dots.
   *
   * Each landmark is a filled circle color-coded by confidence:
   * - Green: high confidence, position is reliable
   * - Yellow: moderate confidence, might be slightly off
   * - Red: low confidence, likely occluded or at frame edge
   *
   * A white border around each dot improves visibility against
   * both light and dark backgrounds in the camera feed.
   */
  for (let i = 0; i < normalizedLandmarks.length; i++) {
    const landmark = normalizedLandmarks[i];
    if (!landmark) continue;

    const visibility = landmark.visibility ?? 0;

    /** Don't draw landmarks below the visibility threshold */
    if (visibility < finalConfig.visibilityThreshold) continue;

    const pos = toCanvasCoords(landmark, width, height);

    /**
     * Draw the outer white border.
     * This ring makes the dot visible against any background color.
     * Without it, green dots would disappear against green clothing.
     */
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, finalConfig.landmarkRadius + 1, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();

    /**
     * Draw the inner colored circle.
     * The color reflects detection confidence for this specific joint.
     */
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, finalConfig.landmarkRadius, 0, 2 * Math.PI);
    ctx.fillStyle = getConfidenceColor(visibility, finalConfig);
    ctx.fill();
  }
}

/**
 * Draws the FPS counter on the canvas.
 *
 * Displayed in the top-left corner of the overlay. Shows:
 * - Current frames per second (how many detections per second)
 * - A visual indicator of performance quality
 *
 * FPS targets for Myonites:
 * - 15+ FPS: Excellent — smooth tracking, accurate form analysis
 * - 10-14 FPS: Good — acceptable for form analysis
 * - 5-9 FPS: Poor — form analysis may miss movements
 * - <5 FPS: Unusable — need to reduce resolution or switch to CPU/GPU
 *
 * @param ctx - The 2D rendering context of the overlay canvas
 * @param fps - Current frames per second
 */
export function drawFPS(ctx: CanvasRenderingContext2D, fps: number): void {
  const roundedFps = Math.round(fps);

  let color: string;
  if (roundedFps >= 15) {
    color = "#22c55e";
  } else if (roundedFps >= 10) {
    color = "#eab308";
  } else {
    color = "#ef4444";
  }

  /**
   * Save the current canvas state, then flip horizontally.
   * Since the entire canvas is mirrored via CSS scaleX(-1),
   * we mirror the FPS text again here so it appears normal.
   * Two mirrors cancel out → readable text.
   */
  ctx.save();
  ctx.scale(-1, 1);

  /**
   * Because we flipped the x-axis, x coordinates are now negative.
   * Drawing at -98 places the background 8px from the right edge
   * of the flipped canvas, which appears as the top-left corner
   * in the final mirrored output.
   */
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(-98, 8, 90, 32);

  ctx.fillStyle = color;
  ctx.font = "bold 16px monospace";
  ctx.fillText(`${roundedFps} FPS`, -90, 30);

  /** Restore the canvas to its normal state for landmark drawing */
  ctx.restore();
}
