import type { MoodEntry } from "../../types/mood";

/**
 * Repository for mood tracking entries.
 */
export interface MoodRepository {
  create(entry: Omit<MoodEntry, "id" | "createdAt">): Promise<MoodEntry>;
  getBySession(sessionId: string): Promise<MoodEntry | null>;
  getByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<MoodEntry[]>;
  getAverageByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number>;
}
