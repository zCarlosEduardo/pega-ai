export type PersonColor = "p1" | "p2" | "p3" | "p4";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// mapa de cor de pessoa -> hex (para usos que precisam do valor cru, ex: SVG/ring)
export const PERSON_HEX: Record<PersonColor, string> = {
  p1: "#9d8cf6",
  p2: "#f2a878",
  p3: "#5ec2e8",
  p4: "#e88ab8",
};

export const PERSON_BG: Record<PersonColor, string> = {
  p1: "bg-p1",
  p2: "bg-p2",
  p3: "bg-p3",
  p4: "bg-p4",
};

export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}
