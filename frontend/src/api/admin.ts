import { apiFetch } from "./client";

// docs/api-spec.md §6。すべて admin のみ。
// 未ログインは 401、admin 以外のログインユーザーは 403 が返る。
// フロントでメニューを隠すのは表示の話であって制限ではないので、
// ここで隠しても API 側の検証がある前提で書く。

export type SignageTokenRow = {
  id: number;
  name: string;
  token: string;
  url: string;
  revoked_at: string | null;
  created_at: string;
};

// ピン留め設定画面専用。spotlight_score は公開APIに載せていない
// (wireframes/wireframe-admin.html A2「一般ユーザーには見せない」)
export type AdminEventRow = {
  id: number;
  title: string;
  starts_at: string;
  location: string;
  participants_count: number;
  spotlight_score: number;
  pinned: boolean;
};

// ユーザー管理画面(wireframes/wireframe-admin-ver2.html ②)専用。
// 公開APIの UserSerializer は email を返さないので、形が違う
export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member" | "demo";
  enrollment_year: number;
  graduation_year: number;
  // 卒業したかどうかはサーバーが判断する。年度の切り替わり(4月始まり)を
  // 跨ぐ規則なので、画面ごとに計算しない(backend の User#graduated?)
  graduated: boolean;
  // NULL = 有効。時刻が入っていれば停止中(spec-v2.2.md §2.1)
  suspended: boolean;
  suspended_at: string | null;
};

// 管理者トップ(wireframes/wireframe-admin-ver2.html ①)。
export type DashboardStats = {
  member_count: number;
  graduate_count: number;
  active_project_count: number;
  recruiting_project_count: number;
  events_this_month_count: number;
  suspended_count: number;
  next_event: { id: number; title: string; days_until: number } | null;
};

export type ActivityRow = {
  id: number;
  kind: "event" | "project";
  title: string;
  status: string;
  // 投稿者は退会で null になりうる(ON DELETE SET NULL)
  owner_name: string | null;
  created_at: string;
};

export type Dashboard = {
  stats: DashboardStats;
  recent_activity: ActivityRow[];
};

export type NewUserInput = {
  name: string;
  email: string;
  password: string;
  enrollment_year: number;
  graduation_year: number;
  role: "admin" | "member";
};

export async function fetchAdminEvents(): Promise<AdminEventRow[]> {
  const data = await apiFetch<{ events: AdminEventRow[] }>("/api/admin/events");
  return data.events;
}

// 停止は表示上のラベルではない。止めた瞬間に相手のセッションが無効になる
// (backend の ApplicationController#current_user)
export async function suspendUser(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/admin/users/${id}/suspension`, { method: "PUT" });
}

export async function unsuspendUser(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/admin/users/${id}/suspension`, { method: "DELETE" });
}

export async function fetchDashboard(): Promise<Dashboard> {
  return apiFetch<Dashboard>("/api/admin/dashboard");
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const data = await apiFetch<{ users: AdminUserRow[] }>("/api/admin/users");
  return data.users;
}

// 物理削除。企画と参加記録は owner_id / user_id が null になって残る
// (docs/er.md の ON DELETE SET NULL)
export async function deleteUser(id: number): Promise<void> {
  await apiFetch<void>(`/api/admin/users/${id}`, { method: "DELETE" });
}

export async function fetchSignageTokens(): Promise<SignageTokenRow[]> {
  const data = await apiFetch<{ signage_tokens: SignageTokenRow[] }>("/api/admin/signage_tokens");
  return data.signage_tokens;
}

export async function createSignageToken(name: string): Promise<SignageTokenRow> {
  return apiFetch<SignageTokenRow>("/api/admin/signage_tokens", {
    method: "POST",
    body: JSON.stringify({ signage_token: { name } }),
  });
}

export async function revokeSignageToken(id: number): Promise<void> {
  await apiFetch<void>(`/api/admin/signage_tokens/${id}`, { method: "DELETE" });
}

export async function createUser(input: NewUserInput): Promise<{ id: number; name: string }> {
  const data = await apiFetch<{ user: { id: number; name: string } }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ user: input }),
  });
  return data.user;
}

export async function pinEvent(eventId: number): Promise<void> {
  await apiFetch<unknown>(`/api/admin/events/${eventId}/pin`, { method: "PUT" });
}

export async function unpinEvent(eventId: number): Promise<void> {
  await apiFetch<void>(`/api/admin/events/${eventId}/pin`, { method: "DELETE" });
}
