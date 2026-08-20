import type { Tag } from "./event";

// サイネージ用のレスポンス(docs/api-spec.md §5)。
// 一覧・詳細APIとはキーの集合が違う。owner と participants は含まれない
// （トークン認証は通っているが current_user は nil のため）。
export type SignageEvent = {
  id: number;
  title: string;
  starts_at: string;
  days_until: number;
  location: string;
  description: string;
  tags: Tag[];
  pinned: boolean;
  detail_url: string;
};

export type SignageProject = {
  id: number;
  title: string;
  status: "recruiting" | "in_progress" | "completed";
  participants_count: number;
  capacity: number | null;
  meeting_schedule: string | null;
  tags: Tag[];
  detail_url: string;
};

export type SignageData = {
  spotlight_events: SignageEvent[];
  projects: SignageProject[];
};
