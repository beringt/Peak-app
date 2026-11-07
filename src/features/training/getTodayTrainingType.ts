import type { TrainingDay } from "../../types";
import { formatDateKey } from "../../utils/date";

export function getTodayTrainingType(
  trainingPlan: TrainingDay[],
  today: string = formatDateKey(new Date())
): TrainingDay["type"] {
  return trainingPlan.find((day) => day.date === today)?.type ?? "rest";
}
