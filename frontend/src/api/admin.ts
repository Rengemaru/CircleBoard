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
  // 未入力は null。本人が /me/edit で書くもので、管理画面からは編集しない
  department: string | null;
  // 卒業したかどうかはサーバーが判断する。年度の切り替わり(4月始まり)を
  // 跨ぐ規則なので、画面ごとに計算しない(backend の User#graduated?)
  graduated: boolean;
  // 学年の表記(B3 / M1 …)。卒業生と10年目以降は null
  grade: string | null;
  // 在学何年目か。編集ダイアログが入力するのはこの数字(backend の User#grade_years)
  grade_years: number;
  // NULL = 有効。時刻が入っていれば停止中(spec-v2.2.md §2.1)
  suspended: boolean;
  suspended_at: string | null;
};

// 企画一覧・全件(wireframes/wireframe-admin-ver2.html ④)専用。
// 公開APIの一覧は論理削除済みを必ず外すので、この画面では使えない
export type PostKind = "event" | "project";

export type AdminPostRow = {
  id: number;
  kind: PostKind;
  title: string;
  // イベントは recruiting / completed の2値、プロジェクトは in_progress を含む3値
  status: "recruiting" | "in_progress" | "completed";
  // 論理削除済みかどうか。status とは別の列(visibility)なので独立して立つ。
  // 「削除済みの募集中」があり得る
  trashed: boolean;
  // 投稿者は退会で null になりうる(ON DELETE SET NULL)
  owner_name: string | null;
  // null は定員なし(spec-v2.2.md §2.2/§2.3)
  capacity: number | null;
  participants_count: number;
  created_at: string;
};

// URLの組み立てを1箇所に置く。`${kind}s` と綴ると、種別が増えたときに
// 壊れる場所が分からなくなる
const RESOURCE: Record<PostKind, string> = {
  event: "events",
  project: "projects",
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
  // 在学何年目か。入学年度と卒業年度はサーバーが逆算する(編集と同じ)
  grade_years: number;
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

// 権限と学年の変更(docs/spec-admin-operations.md §3.3)。
// 変えない項目は送らない。demo は選べない
export type UpdateUserInput = {
  role?: "admin" | "member";
  // 在学何年目か。入学年度と卒業年度はサーバーがここから逆算する
  grade_years?: number;
};

export async function updateUser(id: number, input: UpdateUserInput): Promise<void> {
  await apiFetch<unknown>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ user: input }),
  });
}

// 現役⇄卒業。卒業はフラグではなく卒業年度と今の年度の比較結果なので、
// 切り替えは年度の上書きになる。**元の卒業年度は戻らない**(backend の
// graduations_controller)。押す前に確認を挟むのは呼び出し側の責任
export async function graduateUser(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/admin/users/${id}/graduation`, { method: "PUT" });
}

export async function ungraduateUser(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/admin/users/${id}/graduation`, { method: "DELETE" });
}

// パスワードの再発行。現在の値は求めない(忘れた人が対象で、本人も知らない)。
// 設定した値は口頭かDMで本人に伝える運用(docs/spec-admin-operations.md §3.1)
export async function resetUserPassword(id: number, password: string): Promise<void> {
  await apiFetch<unknown>(`/api/admin/users/${id}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
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

export async function fetchAdminPosts(): Promise<AdminPostRow[]> {
  const data = await apiFetch<{ posts: AdminPostRow[] }>("/api/admin/posts");
  return data.posts;
}

// 削除は公開APIをそのまま使う。owner 本人も行える一般の操作なので、
// 同じことをする入口を管理者用にもう1本作らない。
// 物理削除ではなく visibility を trashed にするだけで、復旧できる
export async function trashPost(kind: PostKind, id: number): Promise<void> {
  await apiFetch<void>(`/api/${RESOURCE[kind]}/${id}`, { method: "DELETE" });
}

// 復旧は管理者だけ。公開APIは論理削除済みを必ず 404 にするので、
// admin 名前空間に置いている(backend の Api::Admin::TrashesController)
export async function restorePost(kind: PostKind, id: number): Promise<void> {
  await apiFetch<void>(`/api/admin/${RESOURCE[kind]}/${id}/trash`, { method: "DELETE" });
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

// タグ管理(docs/spec-tags.md §3.8)。作成は無い。タグは企画かプロフィールに
// 付ける過程で生まれるので、管理画面は「直す場所」に徹する
export type AdminTagRow = {
  id: number;
  name: string;
  category: "project_event" | "profile";
  usage_count: number;
};

export async function fetchAdminTags(): Promise<AdminTagRow[]> {
  const data = await apiFetch<{ tags: AdminTagRow[] }>("/api/admin/tags");
  return data.tags;
}

export async function renameAdminTag(id: number, name: string): Promise<AdminTagRow> {
  return apiFetch<AdminTagRow>(`/api/admin/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ tag: { name } }),
  });
}

export async function deleteAdminTag(id: number): Promise<void> {
  await apiFetch<void>(`/api/admin/tags/${id}`, { method: "DELETE" });
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
