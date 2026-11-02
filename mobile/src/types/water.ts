// Cantidades siempre en ml (enteros). container_name es una instantánea de texto
// del recipiente usado (null = cantidad directa), no una referencia: renombrar o
// borrar un recipiente no toca el histórico.
export type WaterContainer = {
  id: number;
  name: string;
  ml: number;
};

export type WaterContainerCreate = {
  name: string;
  ml: number;
};

export type WaterEntry = {
  id: number;
  date: string;
  ml: number;
  container_name: string | null;
};

export type WaterEntryCreate = {
  date: string;
  ml: number;
  container_name?: string | null;
};

export type WaterDay = {
  date: string;
  total_ml: number;
  goal_ml: number;
  entries: WaterEntry[];
};

export type WaterDayTotal = {
  date: string;
  total_ml: number;
};
