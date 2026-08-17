export type MuscleGroupVolume = {
  muscle_group: string;
  tonnage: number;
};

export type MuscleGroupGap = {
  muscle_group: string;
  // null = ese grupo muscular nunca se ha entrenado.
  days_since_trained: number | null;
};

export type AnalyticsSummary = {
  week_tonnage: number;
  // 8 entradas fijas (MUSCLE_GROUPS), mismo orden en las dos listas -- aun así
  // el frontend reordena por MUSCLE_GROUP_ORDER en vez de fiarse del orden de
  // la respuesta, ver AnalisisScreen.tsx.
  volume_by_muscle: MuscleGroupVolume[];
  days_since_trained: MuscleGroupGap[];
};
