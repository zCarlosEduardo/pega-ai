import { AppData } from "@/lib/types";

// Estado vazio inicial (antes de carregar do Supabase / antes de logar).
// Sem dados de exemplo — tudo vem do banco.
export const EMPTY_DATA: AppData = {
  space: { id: "", name: "", createdYear: new Date().getFullYear(), inviteCode: "" },
  people: [],
  lists: [],
  meds: [],
  dates: [],
  achievements: [],
  activity: [],
};
