export type Goal = {
  id: number;
  text: string;
  target_value: number | null;
  target_date: string | null;
  done: boolean;
};

export type GoalCreate = {
  text: string;
  target_value?: number | null;
  target_date?: string | null;
};

// PUT es reemplazo total (incluye "done"): así editar texto/objetivo y hacer
// toggle de "hecho" usan el mismo endpoint, sin un PATCH aparte.
export type GoalUpdate = {
  text: string;
  target_value: number | null;
  target_date: string | null;
  done: boolean;
};
