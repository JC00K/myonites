/**
 * Test Setup File
 *
 * Runs before each test file in the app workspace.
 * Sets up global mocks for APIs that don't exist in jsdom:
 * - MediaDevices (camera)
 * - MediaPipe (pose estimation)
 * - React Native Platform
 */

import { vi } from "vitest";

/**
 * Mock navigator.mediaDevices for camera tests.
 * jsdom doesn't implement getUserMedia, so we provide a mock
 * that returns a fake MediaStream.
 */
Object.defineProperty(globalThis.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn(),
  },
  writable: true,
});

/**
 * Mock HTMLVideoElement properties that jsdom doesn't implement.
 * These are needed because our camera service creates video elements
 * and checks their dimensions.
 */
Object.defineProperty(HTMLVideoElement.prototype, "play", {
  value: vi.fn().mockResolvedValue(undefined),
});

/**
 * Mock canvas getContext for skeleton drawing tests.
 * jsdom doesn't implement the Canvas API, so we provide
 * mock drawing functions that track calls without rendering.
 */
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  canvas: { width: 640, height: 480 },
  set fillStyle(_val: string) {},
  set strokeStyle(_val: string) {},
  set lineWidth(_val: number) {},
  set lineCap(_val: string) {},
  set font(_val: string) {},
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;
