import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the auth service before importing the store.
 * This replaces the real Supabase calls with controllable fakes.
 */
vi.mock("../services/auth", () => ({
  authService: {
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}));

import { useAuthStore } from "./authStore";
import { authService } from "../services/auth";

/** Type the mocked functions for proper IntelliSense */
const mockAuthService = authService as {
  signUp: ReturnType<typeof vi.fn>;
  signIn: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  resetPassword: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
};

describe("Auth Store", () => {
  beforeEach(() => {
    /** Reset store to initial state between tests */
    useAuthStore.setState({
      session: null,
      isLoading: true,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("signIn", () => {
    it("sets session on successful sign in", async () => {
      const mockSession = {
        userId: "123",
        email: "test@example.com",
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: 9999999999,
      };

      mockAuthService.signIn.mockResolvedValue({
        success: true,
        session: mockSession,
        error: null,
      });

      const result = await useAuthStore
        .getState()
        .signIn("test@example.com", "password");

      expect(result).toBe(true);
      expect(mockAuthService.signIn).toHaveBeenCalledWith(
        "test@example.com",
        "password",
      );
    });

    it("sets error on failed sign in", async () => {
      mockAuthService.signIn.mockResolvedValue({
        success: false,
        session: null,
        error: { code: "401", message: "Invalid credentials" },
      });

      const result = await useAuthStore
        .getState()
        .signIn("test@example.com", "wrong");

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("Invalid credentials");
    });

    it("clears previous error before attempting sign in", async () => {
      useAuthStore.setState({ error: "Old error" });

      mockAuthService.signIn.mockResolvedValue({
        success: true,
        session: {
          userId: "123",
          email: "test@example.com",
          accessToken: "",
          refreshToken: "",
          expiresAt: 0,
        },
        error: null,
      });

      await useAuthStore.getState().signIn("test@example.com", "password");

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe("signUp", () => {
    it("returns true on successful sign up", async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: true,
        session: null,
        error: null,
      });

      const result = await useAuthStore
        .getState()
        .signUp("new@example.com", "password");

      expect(result).toBe(true);
      expect(mockAuthService.signUp).toHaveBeenCalledWith(
        "new@example.com",
        "password",
      );
    });

    it("sets error on failed sign up", async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: false,
        session: null,
        error: { code: "422", message: "Email already registered" },
      });

      const result = await useAuthStore
        .getState()
        .signUp("existing@example.com", "password");

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("Email already registered");
    });
  });

  describe("signOut", () => {
    it("clears session on sign out", async () => {
      useAuthStore.setState({
        session: {
          userId: "123",
          email: "test@example.com",
          accessToken: "token",
          refreshToken: "refresh",
          expiresAt: 9999999999,
        },
      });

      mockAuthService.signOut.mockResolvedValue(undefined);

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().session).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("resetPassword", () => {
    it("returns true on successful reset", async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const result = await useAuthStore
        .getState()
        .resetPassword("test@example.com");

      expect(result).toBe(true);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        "test@example.com",
      );
    });

    it("sets error when reset fails", async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new Error("Rate limited"),
      );

      const result = await useAuthStore
        .getState()
        .resetPassword("test@example.com");

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("Rate limited");
    });
  });

  describe("clearError", () => {
    it("clears the error state", () => {
      useAuthStore.setState({ error: "Some error" });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe("initialize", () => {
    it("calls getSession and sets up auth state listener", () => {
      const mockUnsubscribe = vi.fn();
      mockAuthService.onAuthStateChange.mockReturnValue(mockUnsubscribe);
      mockAuthService.getSession.mockResolvedValue(null);

      const unsubscribe = useAuthStore.getState().initialize();

      expect(mockAuthService.onAuthStateChange).toHaveBeenCalled();
      expect(mockAuthService.getSession).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe("function");
    });
  });
});
