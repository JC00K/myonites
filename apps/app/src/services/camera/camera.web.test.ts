import { describe, it, expect, vi, beforeEach } from "vitest";
import { startCamera, isCameraSupported } from "./camera.web";

describe("Camera Service (Web)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isCameraSupported", () => {
    it("returns true when mediaDevices.getUserMedia exists", () => {
      expect(isCameraSupported()).toBe(true);
    });

    it("returns false when mediaDevices is undefined", () => {
      const original = navigator.mediaDevices;
      Object.defineProperty(navigator, "mediaDevices", {
        value: undefined,
        writable: true,
      });

      expect(isCameraSupported()).toBe(false);

      Object.defineProperty(navigator, "mediaDevices", {
        value: original,
        writable: true,
      });
    });
  });

  describe("startCamera", () => {
    it("requests camera with correct default constraints", async () => {
      /**
       * Mock getUserMedia to return a fake stream.
       * The mock stream has a getTracks method that returns
       * stoppable tracks, simulating real MediaStream behavior.
       */
      const mockTrack = { stop: vi.fn() };
      const mockStream = { getTracks: () => [mockTrack] };

      const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });

      /**
       * Mock the video element's loadeddata event.
       * In real browsers this fires when the first frame is ready.
       * We trigger it immediately so startCamera resolves.
       */
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "video") {
          Object.defineProperty(el, "onloadeddata", {
            set(handler: (() => void) | null) {
              if (handler) handler();
            },
          });
        }
        return el;
      });

      const result = await startCamera();

      /** Verify getUserMedia was called with front camera and correct resolution */
      expect(getUserMediaMock).toHaveBeenCalledWith({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      /** Verify we got back a working CameraStream */
      expect(result.videoElement).toBeDefined();
      expect(result.stream).toBe(mockStream);
      expect(typeof result.stop).toBe("function");
    });

    it("accepts custom configuration", async () => {
      const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
      const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "video") {
          Object.defineProperty(el, "onloadeddata", {
            set(handler: (() => void) | null) {
              if (handler) handler();
            },
          });
        }
        return el;
      });

      await startCamera({
        width: 1280,
        height: 720,
        facingMode: "environment",
      });

      expect(getUserMediaMock).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: false,
      });
    });

    it("stop function releases all tracks and cleans up video", async () => {
      const mockTrack1 = { stop: vi.fn() };
      const mockTrack2 = { stop: vi.fn() };
      const mockStream = { getTracks: () => [mockTrack1, mockTrack2] };

      const getUserMediaMock = vi.fn().mockResolvedValue(mockStream);
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "video") {
          Object.defineProperty(el, "onloadeddata", {
            set(handler: (() => void) | null) {
              if (handler) handler();
            },
          });
        }
        return el;
      });

      const result = await startCamera();
      result.stop();

      /** Verify every track was stopped (releases camera hardware) */
      expect(mockTrack1.stop).toHaveBeenCalled();
      expect(mockTrack2.stop).toHaveBeenCalled();

      /** Verify video element was cleaned up */
      expect(result.videoElement.srcObject).toBeNull();
    });

    it("throws when getUserMedia rejects (e.g. permission denied)", async () => {
      const getUserMediaMock = vi
        .fn()
        .mockRejectedValue(
          new DOMException("Permission denied", "NotAllowedError"),
        );
      Object.defineProperty(navigator, "mediaDevices", {
        value: { getUserMedia: getUserMediaMock },
        writable: true,
      });

      await expect(startCamera()).rejects.toThrow("Permission denied");
    });
  });
});
