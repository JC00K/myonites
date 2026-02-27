import { describe, it, expect, vi, beforeEach } from "vitest";
import { drawSkeleton, drawFPS } from "./drawLandmarks";

/**
 * Creates a mock canvas 2D rendering context.
 * Tracks all drawing calls so we can verify what was drawn.
 */
function createMockContext(width = 640, height = 480) {
  return {
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
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "" as CanvasLineCap,
    font: "",
    canvas: { width, height },
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Creates a minimal set of fake landmarks for testing.
 * Positions two visible landmarks and one invisible one.
 */
function createTestLandmarks(count = 33) {
  return Array.from({ length: count }, (_, i) => ({
    x: i / count,
    y: i / count,
    visibility: i < 2 ? 0.9 : 0.1,
  }));
}

describe("Skeleton Drawing", () => {
  describe("drawSkeleton", () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it("clears the canvas on every call", () => {
      drawSkeleton(ctx, null);
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    });

    it("draws nothing when landmarks are null", () => {
      drawSkeleton(ctx, null);

      /** Only clearRect should be called — no drawing operations */
      expect(ctx.arc).not.toHaveBeenCalled();
      expect(ctx.moveTo).not.toHaveBeenCalled();
    });

    it("draws nothing when landmarks array is empty", () => {
      drawSkeleton(ctx, []);

      expect(ctx.arc).not.toHaveBeenCalled();
      expect(ctx.moveTo).not.toHaveBeenCalled();
    });

    it("draws landmarks when valid data is provided", () => {
      const landmarks = createTestLandmarks();
      drawSkeleton(ctx, landmarks);

      /**
       * arc is called for each visible landmark (two circles per dot:
       * white border + colored fill). Only landmarks above the
       * visibility threshold (0.3) are drawn.
       */
      expect(ctx.arc).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it("skips landmarks below visibility threshold", () => {
      /** All landmarks have very low visibility */
      const landmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility: 0.1,
      }));

      drawSkeleton(ctx, landmarks);

      /**
       * No arcs should be drawn because all landmarks
       * are below the default 0.3 visibility threshold.
       */
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it("draws connections between visible landmarks", () => {
      /** Make shoulders highly visible so the shoulder connection draws */
      const landmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility: 0.9,
      }));

      drawSkeleton(ctx, landmarks);

      /** Lines should be drawn between connected landmarks */
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it("respects custom visibility threshold", () => {
      /** Landmarks at 0.5 visibility — above default but below custom */
      const landmarks = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        visibility: 0.5,
      }));

      drawSkeleton(ctx, landmarks, { visibilityThreshold: 0.8 });

      /** Nothing drawn because all are below the custom 0.8 threshold */
      expect(ctx.arc).not.toHaveBeenCalled();
    });
  });

  describe("drawFPS", () => {
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      ctx = createMockContext();
    });

    it("draws the FPS counter", () => {
      drawFPS(ctx, 30);

      /** Should save/restore context for the mirror flip */
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
      expect(ctx.restore).toHaveBeenCalled();

      /** Should draw background rectangle and text */
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith("30 FPS", -90, 30);
    });

    it("rounds the FPS value", () => {
      drawFPS(ctx, 29.7);
      expect(ctx.fillText).toHaveBeenCalledWith("30 FPS", -90, 30);
    });
  });
});
