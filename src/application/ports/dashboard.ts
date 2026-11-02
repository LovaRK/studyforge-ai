import type { ItemStatus } from "@/domain/items/item";
export interface DashboardItem {
  id: string;
  sourceId: string;
  sourceTitle: string;
  tags: string[];
  status: ItemStatus;
  edited: boolean;
  repetitions: number | null;
  dueAt: Date | null;
}
export interface DashboardSnapshot {
  items: DashboardItem[];
  activity: { at: Date; kind: "card" | "quiz"; correct: boolean | null }[];
  extraction: { verified: number; rejected: number };
}
export interface DashboardStore {
  snapshot(): Promise<DashboardSnapshot>;
}
