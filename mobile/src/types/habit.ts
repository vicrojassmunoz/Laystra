export type HabitKind = "water" | "steps" | "check" | "count";

export type Habit = {
  id: number;
  name: string;
  kind: HabitKind;
  // null en check y water; en steps y count es > 0 o null.
  target: number | null;
  unit: string | null;
  reminder_time: string | null; // "HH:MM"
  active: boolean;
  position: number;
};

// PUT /habits/{id} y POST /habits: mismo cuerpo (reemplazo total, sin id).
export type HabitPayload = Omit<Habit, "id">;

export type HabitProgress = {
  habit: Habit;
  progress: number;
  target: number | null;
  done: boolean;
};
