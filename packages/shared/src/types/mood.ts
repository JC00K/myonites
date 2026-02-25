/**
 * Mood entry recorded after each workout session.
 * Maps to the `mood_entries` table.
 */
export interface MoodEntry {
  id: string;
  userId: string;
  sessionId: string | null;
  label: MoodLabel;
  numericValue: MoodValue;
  createdAt: string;
}

/**
 * The 7 mood labels, ordered from highest to lowest energy.
 * Expanding this list requires only a code config change — no schema migration.
 */
export type MoodLabel =
  | 'Energized'
  | 'Focused'
  | 'Calm'
  | 'Neutral'
  | 'Tired'
  | 'Anxious'
  | 'Stressed';

/** Numeric value 1–7 mapped to mood labels */
export type MoodValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Lookup from label to numeric value */
export const MOOD_MAP: Record<MoodLabel, MoodValue> = {
  Energized: 7,
  Focused: 6,
  Calm: 5,
  Neutral: 4,
  Tired: 3,
  Anxious: 2,
  Stressed: 1,
} as const;

/** Ordered list for rendering mood cards in the UI */
export const MOOD_LABELS: MoodLabel[] = [
  'Energized',
  'Focused',
  'Calm',
  'Neutral',
  'Tired',
  'Anxious',
  'Stressed',
];
