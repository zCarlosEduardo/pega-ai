import { PersonColor } from "@/lib/cn";

export type Role = "admin" | "member";

export type Person = {
  id: string; // member id
  userId?: string; // auth user id
  name: string;
  email: string;
  color: PersonColor;
  role: Role;
  isMe?: boolean;
  notifyPrefs?: { med?: boolean; dates?: boolean; partner?: boolean; daily?: boolean };
};

export type ListItem = {
  id: string;
  text: string;
  done: boolean;
  assignee?: string; // member id (quando atribuído a uma pessoa)
  everyone?: boolean; // "Todos": cada pessoa marca a sua
  doneBy?: string[]; // member ids que já marcaram (modo "Todos")
};

export type List = {
  id: string;
  name: string;
  shared: boolean;
  dotColor: "success" | "accent" | "warning";
  ownerId?: string; // dono (listas "Minhas"); ausente em listas antigas
  position?: number;
  items: ListItem[];
};

export type MedFreq = "interval" | "daily" | "weekly" | "custom";

export type Med = {
  id: string;
  name: string;
  dose: string;
  assignee: string;
  freq: MedFreq;          // "interval" = a cada N horas
  everyXHours?: number;   // se freq === "interval"
  startHour: string;      // HH:MM — primeiro horário do dia
  durationHours?: number; // janela total (default 24h)
  times: string[];        // horários derivados (HH:MM[])
  notify: boolean;
  stock?: number;
  taken: Record<string, string>; // { "YYYY-MM-DD_HH:MM": ISO }
  createdAtISO?: string;
  // derivados (não persistidos):
  time: string;           // próximo horário do dia
  inLabel?: string;       // "em 2h"
  status: "tomado" | "pendente" | "agora";
  freqLabel: string;
  startLabel: string;
  adherence: number;
  last7: ("ok" | "miss" | "none")[];
};


export type DateType = "Viagem" | "Aniversário" | "Mensário" | "Férias" | "Outro";

export type ImportantDate = {
  id: string;
  title: string;
  dateLabel: string;
  daysAway: number;
  color: PersonColor;
  type: DateType;
  recurrence: string;
  reminder: string;
  startISO?: string; // YYYY-MM-DD
  endISO?: string;
};

export type Achievement = {
  id: string;
  title: string;
  icon: "star" | "check" | "heart" | "lock";
  unlocked: boolean;
};

export type Activity = {
  id: string;
  who?: string; // member id (uid) de quem fez
  text: string;
  when: string; // ISO
  done?: boolean;
};

export type Space = {
  id: string; name: string; createdYear: number; inviteCode: string;
  streak?: number; // dias seguidos com pelo menos 1 item concluído
  streakDay?: string; // YYYY-MM-DD do último dia contado
};

export type AppData = {
  space: Space;
  people: Person[];
  lists: List[];
  meds: Med[];
  dates: ImportantDate[];
  achievements: Achievement[];
  activity: Activity[];
};
