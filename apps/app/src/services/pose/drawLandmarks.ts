/**
 * Skeleton Drawing Utility
 *
 * Draws pose landmarks and connections on a canvas overlay.
 * Color-coded by confidence: green (high), yellow (medium), red (low).
 * Will be replaced by a polished overlay in Phase 3.
 */

import { LANDMARK_INDEX } from "@myonites/shared";

interface DrawConfig {
  landmarkRadius: number;
  connectionLineWidth: number;
  highConfidenceColor: string;
  mediumConfidenceColor: string;
  lowConfidenceColor: string;
  connectionColor: string;
  visibilityThreshold: number;
}

const DEFAULT_DRAW_CONFIG: DrawConfig = {
  landmarkRadius: 6,
  connectionLineWidth: 3,
  highConfidenceColor: "#22c55e",
  mediumConfidenceColor: "#eab308",
  lowConfidenceColor: "#ef4444",
  connectionColor: "rgba(255, 255, 255, 0.6)",
  visibilityThreshold: 0.3,
};

/* Each pair defines a line between two landmark indices */
const SKELETON_CONNECTIONS: [number, number][] = [
  /* Torso */
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],

  /* Arms */
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_ELBOW],
  [LANDMARK_INDEX.LEFT_ELBOW, LANDMARK_INDEX.LEFT_WRIST],
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_ELBOW],
  [LANDMARK_INDEX.RIGHT_ELBOW, LANDMARK_INDEX.RIGHT_WRIST],

  /* Legs */
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.LEFT_KNEE],
  [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],
  [LANDMARK_INDEX.RIGHT_HIP, LANDMARK_INDEX.RIGHT_KNEE],
  [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],

  /* Left foot */
  [LANDMARK_INDEX.LEFT_ANKLE, LANDMARK_INDEX.LEFT_HEEL],
  [LANDMARK_INDEX.LEFT_HEEL, LANDMARK_INDEX.LEFT_FOOT_INDEX],
  [LANDMARK_INDEX.LEFT_ANKLE, LANDMARK_INDEX.LEFT_FOOT_INDEX],

  /* Right foot */
  [LANDMARK_INDEX.RIGHT_ANKLE, LANDMARK_INDEX.RIGHT_HEEL],
  [LANDMARK_INDEX.RIGHT_HEEL, LANDMARK_INDEX.RIGHT_FOOT_INDEX],
  [LANDMARK_INDEX.RIGHT_ANKLE, LANDMARK_INDEX.RIGHT_FOOT_INDEX],

  /* Face */
  [LANDMARK_INDEX.LEFT_EAR, LANDMARK_INDEX.LEFT_EYE],
  [LANDMARK_INDEX.LEFT_EYE, LANDMARK_INDEX.NOSE],
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_EYE],
  [LANDMARK_INDEX.RIGHT_EYE, LANDMARK_INDEX.RIGHT_EAR],
];

function getConfidenceColor(visibility: number, config: DrawConfig): string {
  if (visibility > 0.7) return config.highConfidenceColor;
  if (visibility > 0.4) return config.mediumConfidenceColor;
  return config.lowConfidenceColor;
}

/* Converts normalized (0-1) landmark position to canvas pixels */
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
 * Draws skeleton overlay. Clears canvas first, then draws connections
 * (behind) followed by landmark dots (on top). Skips landmarks below
 * the visibility threshold.
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

  ctx.clearRect(0, 0, width, height);

  if (!normalizedLandmarks || normalizedLandmarks.length === 0) {
    return;
  }

  /* Draw connection lines first so dots render on top */
  ctx.strokeStyle = finalConfig.connectionColor;
  ctx.lineWidth = finalConfig.connectionLineWidth;
  ctx.lineCap = "round";

  for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
    const startLandmark = normalizedLandmarks[startIdx];
    const endLandmark = normalizedLandmarks[endIdx];

    if (!startLandmark || !endLandmark) continue;

    const startVisibility = startLandmark.visibility ?? 0;
    const endVisibility = endLandmark.visibility ?? 0;
    if (
      startVisibility < finalConfig.visibilityThreshold ||
      endVisibility < finalConfig.visibilityThreshold
    ) {
      continue;
    }

    const start = toCanvasCoords(startLandmark, width, height);
    const end = toCanvasCoords(endLandmark, width, height);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  /* Draw landmark dots with white border for visibility on any background */
  for (let i = 0; i < normalizedLandmarks.length; i++) {
    const landmark = normalizedLandmarks[i];
    if (!landmark) continue;

    const visibility = landmark.visibility ?? 0;
    if (visibility < finalConfig.visibilityThreshold) continue;

    const pos = toCanvasCoords(landmark, width, height);

    /* White border ring */
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, finalConfig.landmarkRadius + 1, 0, 2 * Math.PI);
    ctx.fillStyle = "white";
    ctx.fill();

    /* Confidence-colored inner dot */
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, finalConfig.landmarkRadius, 0, 2 * Math.PI);
    ctx.fillStyle = getConfidenceColor(visibility, finalConfig);
    ctx.fill();
  }
}

/**
 * Draws FPS counter. Double-mirrors the text to counteract the
 * canvas CSS scaleX(-1) so it reads normally.
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

  ctx.save();
  ctx.scale(-1, 1);

  /* Negative x because axis is flipped — appears top-left in final output */
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(-98, 8, 90, 32);

  ctx.fillStyle = color;
  ctx.font = "bold 16px monospace";
  ctx.fillText(`${roundedFps} FPS`, -90, 30);

  ctx.restore();
}
