import type { Tag, UserCard } from "./event";

// docs/api-spec.md §3。プロジェクトは一覧・詳細ともログイン必須なので、
// owner と participants は常に返る（未ログインではレスポンス自体が401）。
export type ProjectSummary = {
  id: number;
  title: string;
  description: string;
  activity_schedule: string | null;
  meeting_schedule: string | null;
  capacity: number | null;
  participants_count: number;
  status: "recruiting" | "in_progress" | "completed";
  tags: Tag[];
  owner?: UserCard | null;
  participants?: UserCard[];
  current_user_joined?: boolean;
};
