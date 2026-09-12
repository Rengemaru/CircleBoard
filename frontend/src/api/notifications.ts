import { apiFetch } from "./client";
import type { UserCard } from "../types/event";

// アプリ内通知(docs/api-spec.md「アプリ内通知」)。自分が判断すべきものだけが返る。
// 誰に何を見せるかはサーバーが決めているので、画面側で絞らない(CLAUDE.md §3-2)。
//
// type は将来ここが増えたときの分岐点。いまは脱退申請だけ
export type NotificationItem = {
  type: "project_withdrawal";
  id: number;
  project: { id: number; title: string };
  // 退会で null になりうる(ON DELETE SET NULL)
  user: UserCard | null;
  requested_at: string;
};

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const data = await apiFetch<{ items: NotificationItem[] }>("/api/notifications");
  return data.items;
}
