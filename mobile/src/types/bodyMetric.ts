// Sin PUT en el backend -- alta/lista/borrado solamente, corregir un registro
// se hace borrando y reañadiendo (mismo espíritu que "sin historial de
// ediciones" del resto del proyecto).
export type BodyMetric = {
  id: number;
  date: string;
  weight: number;
  body_fat_pct: number | null;
};

export type BodyMetricCreate = {
  date: string;
  weight: number;
  body_fat_pct?: number | null;
};
