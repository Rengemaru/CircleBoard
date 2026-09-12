import type { Tag, UserCard } from "./event";

// 脱退の申請(docs/api-spec.md「プロジェクトの脱退」)。
// user は退会で null になりうる(ON DELETE SET NULL)
export type WithdrawalRequest = {
  id: number;
  user: UserCard | null;
};

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
  // 自分が脱退を申請しているか。未ログインには詳細自体が返らない
  current_user_withdrawal_requested?: boolean;
  // owner と管理者にだけ返る。**キーごと落ちる**ので undefined と空配列を区別する
  withdrawal_requests?: WithdrawalRequest[];
  participants?: UserCard[];
  current_user_joined?: boolean;
};
