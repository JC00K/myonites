/**
 * A single 3D landmark from MediaPipe Pose (33 total).
 * These are the only data retained from camera frames —
 * raw frames are NEVER stored or transmitted.
 */
export interface Landmark {
  x: number;
  y: number;
  z: number;
  /** Confidence score 0-1 */
  visibility: number;
}

/**
 * Complete set of 33 pose landmarks from a single frame.
 * Indexed by the MediaPipe landmark enum.
 */
export interface PoseLandmarks {
  landmarks: Landmark[];
  /** Timestamp of the frame in milliseconds */
  timestamp: number;
}

/**
 * Named landmark indices matching the MediaPipe Pose model.
 * Use these to access specific body parts from the landmarks array.
 */
export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type LandmarkName = keyof typeof LANDMARK_INDEX;
