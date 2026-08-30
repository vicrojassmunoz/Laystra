// muscle_group_primary/secondary vienen del backend (catálogo cerrado de 8
// valores, ver MUSCLE_GROUP_ORDER en utils/exercisePicker.ts), pero se
// declaran como posiblemente ausentes (`| null | undefined`) igual que ya se
// hizo con `superset_group` en su momento: durante una ventana de despliegue
// el cliente nuevo puede hablar con un backend viejo que todavía no manda
// estos campos, y el tipo de TS por sí solo no protege de eso en tiempo de
// ejecución.
export type Exercise = {
  id: number;
  name: string;
  unit: "kg" | "lb";
  muscle_group_primary?: string | null;
  muscle_group_secondary?: string[] | null;
};

export type ExerciseCreate = {
  name: string;
  unit: "kg" | "lb";
  muscle_group_primary: string;
  muscle_group_secondary: string[];
};
