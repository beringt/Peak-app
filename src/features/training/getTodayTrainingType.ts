import type { TrainingDay } from "../../types";
import { formatDateKey } from "../../utils/date";

export function getTodayTrainingType(
  trainingPlan: TrainingDay[]
): TrainingDay["type"] {
  const today = formatDateKey(new Date());
  return trainingPlan.find((day) => day.date === today)?.type ?? "rest";
}
