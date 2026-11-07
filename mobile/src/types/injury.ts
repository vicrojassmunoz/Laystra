// Espejo de backend/app/schemas/injury.py. Los valores de body_area y severity
// son un catálogo cerrado; "since" es AAAA-MM-DD.
export type BodyArea =
  | "hombro"
  | "codo"
  | "muñeca"
  | "espalda_alta"
  | "lumbar"
  | "cadera"
  | "rodilla"
  | "tobillo"
  | "cuello"
  | "otro";

export type Severity = "leve" | "moderada" | "grave";

export type InjuryInput = {
  title: string;
  body_area: BodyArea;
  severity: Severity;
  since: string;
  active: boolean;
  notes: string | null;
};

export type Injury = InjuryInput & { id: number };
