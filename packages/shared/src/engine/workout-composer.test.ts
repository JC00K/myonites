import { describe, it, expect, vi } from "vitest";
import { composeWorkout } from "./workout-composer";
import type { ComposerDependencies } from "./workout-composer";
import type { Exercise } from "../types/exercise";
import type { Session } from "../types/session";
import type { RotationEntry } from "../repositories/interfaces/RotationRepository";

/* ─── Test Fixtures ────────────────────────────────────────────────── */

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: `ex-${Math.random().toString(36).slice(2, 8)}`,
    name: "Test Exercise",
    description: "A test exercise",
    purpose: "Testing",
    muscleGroups: ["shoulders"],
    difficulty: "moderate",
    position: "seated",
    videoUrl: "https://cdn.example.com/video.mp4",
    videoDurationSeconds: 45,
    captionUrl: null,
    eventFileUrl: null,
    formCriteria: { angleRanges: [], expectedReps: 8, minimumScore: 60 },
    commonMistakes: null,
    proTips: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    userId: "user-1",
    scheduleId: "schedule-1",
    slotNumber: 1,
    sessionType: "physical",
    status: "confirmed",
    graded: true,
    scheduledTime: "2026-03-09T13:00:00Z",
    startedAt: null,
    completedAt: null,
    deferredFrom: null,
    skipReason: null,
    notificationToken: null,
    notificationSentAt: null,
    createdAt: "2026-03-09T00:00:00Z",
    ...overrides,
  };
}

function createRotationEntry(exerciseId: string, index: number): RotationEntry {
  return {
    id: `rot-${index}`,
    userId: "user-1",
    exerciseId,
    status: "available",
    lastUsedAt: null,
    timesUsedToday: 0,
  };
}

/* ─── Mock Dependencies ────────────────────────────────────────────── */

function createMockDeps(exercises: Exercise[]): ComposerDependencies {
  const rotationEntries: RotationEntry[] = exercises.map((e, i) =>
    createRotationEntry(e.id, i),
  );

  return {
    exerciseRepo: {
      getById: vi.fn(),
      getAll: vi.fn().mockResolvedValue(exercises),
      getActive: vi.fn().mockResolvedValue(exercises),
      getByMuscleGroup: vi.fn(),
      getByDifficulty: vi.fn(),
    },
    sessionRepo: {
      getById: vi.fn(),
      getBySchedule: vi.fn(),
      getTodaySessions: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
      create: vi.fn(),
    },
    rotationRepo: {
      getAvailable: vi.fn().mockResolvedValue(rotationEntries),
      markUsed: vi.fn(),
      resetQueue: vi.fn(),
      getTodayUsageCount: vi.fn().mockResolvedValue(0),
      isSequenceUnique: vi.fn().mockResolvedValue(true),
      recordSequence: vi.fn(),
    },
  };
}

/* ─── Tests ────────────────────────────────────────────────────────── */

describe("composeWorkout", () => {
  const exercises = [
    createExercise({
      id: "ex-1",
      name: "Neck Rolls",
      muscleGroups: ["neck"],
      videoDurationSeconds: 40,
    }),
    createExercise({
      id: "ex-2",
      name: "Shoulder Shrugs",
      muscleGroups: ["shoulders"],
      videoDurationSeconds: 45,
    }),
    createExercise({
      id: "ex-3",
      name: "Back Stretch",
      muscleGroups: ["upper_back"],
      videoDurationSeconds: 50,
    }),
    createExercise({
      id: "ex-4",
      name: "Wrist Circles",
      muscleGroups: ["wrists"],
      videoDurationSeconds: 35,
    }),
    createExercise({
      id: "ex-5",
      name: "Hip Opener",
      muscleGroups: ["hips"],
      videoDurationSeconds: 45,
    }),
    createExercise({
      id: "ex-6",
      name: "Chest Opener",
      muscleGroups: ["chest"],
      videoDurationSeconds: 40,
    }),
    createExercise({
      id: "ex-7",
      name: "Core Twist",
      muscleGroups: ["core"],
      videoDurationSeconds: 50,
    }),
    createExercise({
      id: "ex-8",
      name: "Leg Stretch",
      muscleGroups: ["legs"],
      videoDurationSeconds: 45,
    }),
  ];

  it("selects 4 exercises for a standard workout", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    expect(result.workout.exercises).toHaveLength(4);
  });

  it("assigns sequential order indices starting at 1", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    result.workout.exercises.forEach((e, index) => {
      expect(e.orderIndex).toBe(index + 1);
    });
  });

  it("includes no duplicate exercises in a single workout", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    const ids = result.workout.exercises.map((e) => e.exercise.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("generates a sequence hash from exercise IDs", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    expect(result.sequenceHash).toBeTruthy();
    expect(result.sequenceHash).toContain(":");
  });

  it("includes video URLs from selected exercises", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    result.workout.exercises.forEach((e) => {
      expect(e.videoUrl).toBe(e.exercise.videoUrl);
    });
  });

  it("includes a meditation config", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    expect(result.workout.meditationConfig).toBeDefined();
    expect(result.workout.meditationConfig.durationSeconds).toBeGreaterThan(0);
    expect(
      result.workout.meditationConfig.breathingPattern.cycles,
    ).toBeGreaterThanOrEqual(3);
  });

  it("respects the daily usage cap", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    /* First 4 exercises have hit the daily cap */
    vi.mocked(deps.rotationRepo.getTodayUsageCount).mockImplementation(
      async (_userId: string, exerciseId: string) => {
        const capped = ["ex-1", "ex-2", "ex-3", "ex-4"];
        return capped.includes(exerciseId) ? 2 : 0;
      },
    );

    const result = await composeWorkout(session, deps);

    const selectedIds = result.workout.exercises.map((e) => e.exercise.id);
    expect(selectedIds).not.toContain("ex-1");
    expect(selectedIds).not.toContain("ex-2");
    expect(selectedIds).not.toContain("ex-3");
    expect(selectedIds).not.toContain("ex-4");
  });

  it("prioritizes uncovered muscle groups", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    /* Simulate that shoulders and neck were already covered today */
    const completedSession = createSession({
      id: "session-0",
      status: "completed",
      completedAt: "2026-03-09T11:00:00Z",
    });
    vi.mocked(deps.sessionRepo.getTodaySessions).mockResolvedValue([
      completedSession,
      session,
    ]);

    const result = await composeWorkout(session, deps);

    expect(result.workout.exercises).toHaveLength(4);
  });

  it("resets rotation queue when exhausted", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    /* First call returns empty, second returns full pool */
    vi.mocked(deps.rotationRepo.getAvailable)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        exercises.map((e, i) => createRotationEntry(e.id, i)),
      );

    const result = await composeWorkout(session, deps);

    expect(deps.rotationRepo.resetQueue).toHaveBeenCalledWith("user-1");
    expect(result.workout.exercises.length).toBeGreaterThan(0);
  });

  it("retries when sequence hash is not unique", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    /* First attempt not unique, second attempt unique */
    vi.mocked(deps.rotationRepo.isSequenceUnique)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await composeWorkout(session, deps);

    expect(deps.rotationRepo.isSequenceUnique).toHaveBeenCalledTimes(2);
    expect(result.workout.exercises.length).toBeGreaterThan(0);
  });

  it("throws when no active exercises exist", async () => {
    const deps = createMockDeps([]);
    const session = createSession();

    await expect(composeWorkout(session, deps)).rejects.toThrow(
      "No active exercises available.",
    );
  });

  it("respects time budget constraints", async () => {
    const longExercises = [
      createExercise({
        id: "long-1",
        videoDurationSeconds: 120,
        muscleGroups: ["neck"],
      }),
      createExercise({
        id: "long-2",
        videoDurationSeconds: 120,
        muscleGroups: ["shoulders"],
      }),
      createExercise({
        id: "long-3",
        videoDurationSeconds: 120,
        muscleGroups: ["chest"],
      }),
      createExercise({
        id: "long-4",
        videoDurationSeconds: 120,
        muscleGroups: ["core"],
      }),
    ];
    const deps = createMockDeps(longExercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    const totalExerciseTime = result.workout.exercises.reduce(
      (sum, e) => sum + e.exercise.videoDurationSeconds + 10,
      0,
    );
    const totalTime =
      totalExerciseTime + result.workout.meditationConfig.durationSeconds;

    /* Should stay within 7 min +/- 1 min = 360-480 seconds */
    expect(totalTime).toBeLessThanOrEqual(480);
  });

  it("attaches the session to the composed workout", async () => {
    const deps = createMockDeps(exercises);
    const session = createSession();

    const result = await composeWorkout(session, deps);

    expect(result.workout.session).toBe(session);
  });
});
