import type { Exercise, MuscleGroup, Difficulty } from '../../types/exercise';

/**
 * Repository for the exercise library.
 */
export interface ExerciseRepository {
  getById(id: string): Promise<Exercise | null>;
  getAll(): Promise<Exercise[]>;
  getActive(): Promise<Exercise[]>;
  getByMuscleGroup(group: MuscleGroup): Promise<Exercise[]>;
  getByDifficulty(difficulty: Difficulty): Promise<Exercise[]>;
}
