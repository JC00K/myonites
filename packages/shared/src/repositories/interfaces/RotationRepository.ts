/**
 * Repository for the exercise rotation queue.
 * Ensures full library rotation before repeats and daily caps.
 */
export interface RotationRepository {
  /** Get available exercises for a user (not yet 'seen' in current rotation) */
  getAvailable(userId: string): Promise<RotationEntry[]>;

  /** Mark an exercise as used in a session */
  markUsed(userId: string, exerciseId: string): Promise<void>;

  /** Reset the rotation queue when all exercises have been seen */
  resetQueue(userId: string): Promise<void>;

  /** Check how many times an exercise has been used today */
  getTodayUsageCount(userId: string, exerciseId: string): Promise<number>;

  /** Check sequence uniqueness against 7-day window */
  isSequenceUnique(
    userId: string,
    sequenceHash: string
  ): Promise<boolean>;

  /** Record a used sequence hash */
  recordSequence(userId: string, sequenceHash: string): Promise<void>;
}

export interface RotationEntry {
  id: string;
  userId: string;
  exerciseId: string;
  status: 'available' | 'seen';
  lastUsedAt: string | null;
  timesUsedToday: number;
}
